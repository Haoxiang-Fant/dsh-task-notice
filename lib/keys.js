/**
 * Resolve the "key" (API credential) label for a model call.
 *
 * DSH resolves provider API keys from environment-variable references
 * (credential refs) per provider route — e.g. the pi-ai adapter reads
 * `llm-pi-ai.providers.scnet.apiKeyEnv` (default `SCNET_API_KEY`), the
 * deepseek adapter reads `llm-deepseek.apiKeyEnv` (default
 * `DEEPSEEK_API_KEY`). This module maps every recorded usage entry to the
 * concrete key variable the route actually configured.
 *
 * 0.3.1 归因修复:旧版按 provider 的硬编码命名空间提示取 apiKeyEnv,导致
 * scnet 等 provider 误命中共享的 `llm-deepseek` 默认段(DEEPSEEK_API_KEY),
 * 出现「A key 的消耗记到 B key 名下」。现按真实路由配置解析:
 *   1) 扫描 settings 中所有 `llm-*` 命名空间的 `providers[route].apiKeyEnv`
 *      (多 provider 适配器,如 llm-pi-ai.providers.scnet);
 *   2) 该路由专属命名空间 `llm-<route>.apiKeyEnv`(扁平适配器,如 llm-deepseek);
 *   3) 路由专属默认环境变量(如 SCNET_API_KEY);
 *   4) 兜底用 provider id 本身。
 * 解析结果按 (route) 短缓存,避免每次调用都枚举 settings。
 *
 * 安全启动:no external imports — the credentials seam is reached via ctx,
 * so a missing package can never break this module's evaluation.
 */

/**
 * provider route → [ settings namespace hint, default env-var name ].
 * 命名空间提示仅用于「扁平适配器」按路由名直查(llm-<route>);多 provider
 * 适配器(providers 映射)由 describe() 扫描自动发现,不在此表。
 * 未知 provider 回退 provider id 作为标签。
 */
const PROVIDER_KEY_HINTS = {
  'scnet': ['llm-scnet', 'SCNET_API_KEY'],
  'ten': ['llm-ten', 'TEN_API_KEY'],
  'deepseek-official': ['llm-deepseek', 'DEEPSEEK_API_KEY'],
  'deepseek': ['llm-deepseek', 'DEEPSEEK_API_KEY'],
  'openai': ['llm-openai', 'OPENAI_API_KEY'],
  'anthropic': ['llm-anthropic', 'ANTHROPIC_API_KEY'],
  'pi-ai': ['llm-pi-ai', 'PI_API_KEY'],
  'z-ai': ['llm-z-ai', 'ZAI_API_KEY'],
  'moonshot': ['llm-moonshot', 'MOONSHOT_API_KEY'],
  'kimi': ['llm-moonshot', 'MOONSHOT_API_KEY'],
  'qwen': ['llm-qwen', 'DASHSCOPE_API_KEY'],
  'gemini': ['llm-gemini', 'GEMINI_API_KEY'],
  'google': ['llm-gemini', 'GEMINI_API_KEY'],
  'siliconflow': ['llm-siliconflow', 'SILICONFLOW_API_KEY'],
  'minimax': ['llm-minimax', 'MINIMAX_API_KEY'],
  'openrouter': ['llm-openrouter', 'OPENROUTER_API_KEY'],
}

/** 解析结果缓存:route → { key, source, at }(60s TTL,settings 变化后自动刷新)。 */
const KEY_CACHE_TTL_MS = 60 * 1000
const keyCache = new Map()

function envConfigured(name) {
  try {
    return typeof process.env[name] === 'string' && process.env[name].trim() !== ''
  } catch {
    return false
  }
}

/** 从 provider 配置对象里取 apiKeyEnv / apiKeyVar / envVar 字段名。 */
function apiKeyEnvOf(cfg) {
  if (cfg === null || typeof cfg !== 'object') return null
  const v = cfg.apiKeyEnv ?? cfg.apiKeyVar ?? cfg.envVar
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}

/**
 * 在 settings 的 llm-* 命名空间里找 route 的 apiKeyEnv。
 * 只匹配「providers.<route> / routes.<route>」映射(多 provider 适配器),
 * 不做扁平兜底——扁平命名空间由 llm-<route> 直查处理,避免跨路由误命中。
 */
function scanRouteApiKeyEnv(settings, route) {
  if (route === '' || typeof settings.describe !== 'function') return null
  try {
    for (const descriptor of settings.describe({ redactSecrets: true })) {
      if (descriptor === null || typeof descriptor !== 'object') continue
      const ns = typeof descriptor.ns === 'string' ? descriptor.ns : ''
      if (!ns.startsWith('llm-')) continue
      const value = descriptor.value
      if (value === null || typeof value !== 'object') continue
      for (const key of ['providers', 'routes']) {
        const map = value[key]
        if (map === null || typeof map !== 'object') continue
        const env = apiKeyEnvOf(map[route])
        if (env !== null) return env
      }
    }
  } catch {
    /* settings 枚举不可用 → 走命名空间直查 / 环境变量 */
  }
  return null
}

/**
 * Resolve the key label for one call.
 * @param {object} ctx - host context (settings service).
 * @param {string|null} provider - provider route id.
 * @returns {{key: string, source: string}}
 */
export function resolveKeyLabel(ctx, provider) {
  const route = typeof provider === 'string' ? provider : ''

  // 短缓存:同一路由在 TTL 内复用解析结果
  const cached = keyCache.get(route)
  if (cached !== undefined && Date.now() - cached.at < KEY_CACHE_TTL_MS) {
    return { key: cached.key, source: cached.source }
  }

  let resolved = null
  try {
    const settings = typeof ctx?.get === 'function' ? ctx.get('settings') : ctx?.settings

    // 1) 真实路由配置:扫描 llm-* 命名空间的 providers[route].apiKeyEnv
    if (settings !== undefined && settings !== null) {
      const scanned = scanRouteApiKeyEnv(settings, route)
      if (scanned !== null) resolved = { key: scanned, source: 'settings' }
      // 2) 扁平适配器:该路由专属命名空间 llm-<route>.apiKeyEnv
      if (resolved === null && typeof settings.get === 'function') {
        try {
          const direct = apiKeyEnvOf(settings.get('llm-' + route))
          if (direct !== null) resolved = { key: direct, source: 'settings' }
        } catch { /* 命名空间未注册 → 回退 */ }
      }
    }
  } catch {
    /* 设置不可用 → 回退环境变量 */
  }

  // 3) 路由专属默认环境变量
  if (resolved === null) {
    const hint = PROVIDER_KEY_HINTS[route]
    if (hint) {
      const defaultEnv = hint[1]
      resolved = envConfigured(defaultEnv)
        ? { key: defaultEnv, source: 'env' }
        : { key: defaultEnv, source: 'default' }
    } else if (route !== '') {
      resolved = { key: route, source: 'provider' }
    } else {
      resolved = { key: 'unknown', source: 'provider' }
    }
  }

  keyCache.set(route, { key: resolved.key, source: resolved.source, at: Date.now() })
  return resolved
}

/** 清空解析缓存(测试 / settings 变更后调用)。 */
export function clearKeyCache() {
  keyCache.clear()
}
