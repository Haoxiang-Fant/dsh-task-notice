/**
 * Provider directory (0.3.2):Key 身份 = Provider ID(全局模型设置里的 provider
 * 路由),显示名 = displayName,环境变量名(keyEnv)只作辅助展示。
 *
 * 目录数据来源(与 keys.js 同一读取姿势,逐层降级、绝不让插件崩溃):
 *   1) ctx.llm(可选):listProviders()(已注册适配器的路由)+
 *      listConfigurableProviders()(已声明可配置 provider 目录,含注册/休眠)+
 *      listModels(provider)(该 provider 所含模型名);「已配置好」= 已注册路由。
 *   2) ctx.settings(可选):llm-* 命名空间描述里的 providers dict/整段配置
 *      (displayName / apiKeyEnv / models),补 keyEnv 与未注册整段适配器行。
 *   3) 账本观测(mergeLedgerProviders):历史消耗里出现过的 provider/旧 key 标签
 *      补进目录,保证统计 Key 行永远可解析。
 *   4) PROVIDER_KEY_HINTS 兜底默认环境变量名 / 显示名。
 *
 * 持久化(插件配置):providerDirectory = { version, updatedAt, removed, list }
 *   - list = 最后一次抓取结果(settings/llm/账本合并后,去掉 removed);
 *   - removed = 用户手动删除的 Provider id(失效项,删除后不随重扫复活,
 *     除非「重置 Provider ID 管理」清空 removed 再重扫)。
 *
 * 本模块零 npm 外部依赖,只 import keys.js 的提示表。
 */
import { PROVIDER_KEY_HINTS } from './keys.js'

export const PROVIDER_DIRECTORY_VERSION = 1

/** 已知路由的显示名兜底(settings 未给出 displayName 时)。 */
const ROUTE_DISPLAY_FALLBACK = {
  'deepseek': 'DeepSeek',
  'deepseek-official': 'DeepSeek',
  'deepseek-oss': 'DeepSeek OSS',
  'openai': 'OpenAI',
  'anthropic': 'Anthropic',
  'claude': 'Anthropic',
  'google': 'Google',
  'gemini': 'Google Gemini',
  'moonshot': 'Kimi (Moonshot)',
  'kimi': 'Kimi (Moonshot)',
  'qwen': 'Qwen (DashScope)',
  'dashscope': 'Qwen (DashScope)',
  'z-ai': 'Z.AI',
  'zai': 'Z.AI',
  'glm': 'Z.AI',
  'minimax': 'MiniMax',
  'siliconflow': '硅基流动',
  'openrouter': 'OpenRouter',
  'pi-ai': 'Pi AI',
  'scnet': 'SCNet',
  'ten': '10dian',
}

function isObj(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function strOrEmpty(v) {
  return typeof v === 'string' ? v.trim() : ''
}

/** 从 models 配置数组抽取模型 id / 名称(支持 [{id,name}...] 或 [id...])。 */
export function modelsFromConfig(models) {
  const out = []
  if (!Array.isArray(models)) return out
  for (const m of models) {
    if (typeof m === 'string') {
      const s = m.trim()
      if (s !== '' && !out.includes(s)) out.push(s)
    } else if (isObj(m)) {
      const id = strOrEmpty(m.id) || strOrEmpty(m.name)
      if (id !== '' && !out.includes(id)) out.push(id)
    }
  }
  return out
}

/** 从 provider 配置对象取 apiKeyEnv / apiKeyVar / envVar 字段名。 */
export function apiKeyEnvOf(cfg) {
  if (!isObj(cfg)) return ''
  for (const k of ['apiKeyEnv', 'apiKeyVar', 'envVar']) {
    const v = cfg[k]
    if (typeof v === 'string' && v.trim() !== '') return v.trim()
  }
  return ''
}

/** route → 默认环境变量名(未配置 apiKeyEnv 时的展示用 keyEnv)。 */
export function defaultEnvOfRoute(route) {
  const hint = PROVIDER_KEY_HINTS[route]
  return hint && typeof hint[1] === 'string' ? hint[1] : ''
}

/** 路由显示名兜底(settings 未提供时)。 */
export function fallbackDisplayNameOf(route) {
  const id = typeof route === 'string' ? route : ''
  if (id === '') return 'unknown'
  const hit = ROUTE_DISPLAY_FALLBACK[id] || ROUTE_DISPLAY_FALLBACK[id.toLowerCase()]
  return hit || id
}

/** 账目条目的 Key 身份(0.3.2):优先 provider 路由 id,缺省回退 key 标签。 */
export function identityOfEntry(e) {
  if (isObj(e)) {
    const p = typeof e.provider === 'string' ? e.provider.trim() : ''
    if (p !== '' && p !== 'unknown') return p
    const k = typeof e.key === 'string' ? e.key.trim() : ''
    if (k !== '') return k
  }
  return 'unknown'
}

/** 在目录中查某 provider id 的显示名(缺省回退 id 本身)。 */
export function displayNameOf(providerId, providerList) {
  const list = Array.isArray(providerList) ? providerList : []
  for (const p of list) {
    if (p && p.id === providerId && typeof p.displayName === 'string' && p.displayName !== '') return p.displayName
  }
  return typeof providerId === 'string' && providerId !== '' ? providerId : 'unknown'
}

/** 在目录中查某 provider id 的 keyEnv(辅助展示用,可空)。 */
export function keyEnvOf(providerId, providerList) {
  const list = Array.isArray(providerList) ? providerList : []
  for (const p of list) {
    if (p && p.id === providerId && typeof p.keyEnv === 'string' && p.keyEnv !== '') return p.keyEnv
  }
  return ''
}

/** 单条目录条目归一化。 */
export function normalizeProviderEntry(raw) {
  if (!isObj(raw)) return null
  const id = strOrEmpty(raw.id)
  if (id === '') return null
  const keyEnv = strOrEmpty(raw.keyEnv) || defaultEnvOfRoute(id)
  const models = Array.isArray(raw.models) ? raw.models.filter((x) => typeof x === 'string' && x !== '') : []
  const displayName = strOrEmpty(raw.displayName) || fallbackDisplayNameOf(id)
  const source = strOrEmpty(raw.source) || 'settings'
  return { id, displayName, keyEnv, models, source }
}

/**
 * 归一化整份目录(结构:{ version, updatedAt, removed, list: [...] })。
 * 兼容读入 { providers: [...] } 旧形。
 */
export function normalizeProviderDirectory(raw) {
  const src = isObj(raw) ? raw : {}
  const list = []
  if (Array.isArray(src.list)) {
    for (const itemRaw of src.list) {
      const item = normalizeProviderEntry(itemRaw)
      if (item) list.push(item)
    }
  } else if (Array.isArray(src.providers)) {
    for (const itemRaw of src.providers) {
      const item = normalizeProviderEntry(itemRaw)
      if (item) list.push(item)
    }
  } else if (isObj(src.providers)) {
    for (const id of Object.keys(src.providers)) {
      const item = normalizeProviderEntry(src.providers[id])
      if (item) list.push(item)
    }
  }
  const seen = new Set()
  const dedup = []
  for (const p of list) {
    if (seen.has(p.id)) continue
    seen.add(p.id)
    dedup.push(p)
  }
  const removed = Array.isArray(src.removed) ? src.removed.filter((x) => typeof x === 'string' && x.trim() !== '') : []
  const seenRemoved = new Set()
  const removedClean = []
  for (const r of removed) {
    if (seenRemoved.has(r)) continue
    seenRemoved.add(r)
    removedClean.push(r)
  }
  const removedSet = new Set(removedClean)
  const kept = dedup.filter((p) => !removedSet.has(p.id))
  kept.sort((a, b) => a.displayName.localeCompare(b.displayName) || a.id.localeCompare(b.id))
  return {
    version: Number(src.version) > 0 ? Number(src.version) : PROVIDER_DIRECTORY_VERSION,
    updatedAt: typeof src.updatedAt === 'number' && Number.isFinite(src.updatedAt) ? src.updatedAt : 0,
    removed: removedClean,
    list: kept,
  }
}

/**
 * 在 settings.describe() 里收集 llm-* 命名空间已配置 provider(含整段适配器)。
 * 返回 {id, displayName, keyEnv, models, source:'settings'} 的原始候选数组。
 */
function collectFromSettings(settings, llmDirectory) {
  const rows = []
  if (!settings || typeof settings.describe !== 'function') return rows
  let descriptors = []
  try {
    descriptors = settings.describe({ redactSecrets: true }) || []
  } catch {
    return rows
  }
  for (const d of descriptors) {
    if (!isObj(d)) continue
    const ns = typeof d.ns === 'string' ? d.ns : ''
    if (!ns.startsWith('llm-')) continue
    const value = d.value
    if (!isObj(value)) continue
    // 多 provider 适配器(providers dict)
    if (isObj(value.providers)) {
      for (const route of Object.keys(value.providers)) {
        const profile = value.providers[route]
        if (!isObj(profile)) continue
        rows.push({
          id: route,
          displayName: strOrEmpty(profile.displayName) || fallbackDisplayNameOf(route),
          keyEnv: apiKeyEnvOf(profile) || defaultEnvOfRoute(route),
          models: modelsFromConfig(profile.models),
          source: 'settings',
        })
      }
      continue
    }
    // 整段(whole-section)适配器:value 自身即配置;provider id 来自 llm 目录声明
    if (!Array.isArray(llmDirectory)) continue
    for (const entry of llmDirectory) {
      if (!isObj(entry) || entry.settingsNs !== ns) continue
      const path = Array.isArray(entry.settingsPath) ? entry.settingsPath : []
      if (path.length !== 0) continue
      const route = strOrEmpty(entry.provider) || ns.slice('llm-'.length)
      rows.push({
        id: route,
        displayName: strOrEmpty(entry.displayName) || fallbackDisplayNameOf(route),
        keyEnv: apiKeyEnvOf(value) || defaultEnvOfRoute(route),
        models: modelsFromConfig(value.models),
        source: 'settings',
      })
    }
  }
  return rows
}

/** 从 llm 服务收集已注册路由(可配置 provider 中「已注册」= 已配置好)。 */
function collectFromLlm(llm) {
  const rows = []
  const registered = new Map()
  if (!isObj(llm)) return rows
  try {
    const list = typeof llm.listProviders === 'function' ? llm.listProviders() : null
    if (Array.isArray(list)) {
      for (const p of list) {
        if (!isObj(p)) continue
        const id = strOrEmpty(p.id)
        if (id === '') continue
        registered.set(id, strOrEmpty(p.name) || fallbackDisplayNameOf(id))
        rows.push({ id, displayName: registered.get(id), keyEnv: defaultEnvOfRoute(id), models: [], source: 'llm' })
      }
    }
  } catch { /* llm 未就绪 → 忽略 */ }
  return rows
}

/**
 * 扫描当前 DSH 的 Provider 目录(逐层降级,永不抛出)。
 * @param {object} ctx 宿主上下文
 * @returns {Array<{id, displayName, keyEnv, models, source}>}
 */
export function scanProviderDirectory(ctx) {
  const ctxObj = isObj(ctx) ? ctx : {}
  const get = (name) => {
    try {
      if (typeof ctxObj.get === 'function') return ctxObj.get(name)
      return ctxObj[name]
    } catch {
      return undefined
    }
  }
  const settings = get('settings')
  const llm = get('llm')
  let llmDirectory = []
  try {
    if (isObj(llm) && typeof llm.listConfigurableProviders === 'function') {
      const dir = llm.listConfigurableProviders()
      if (Array.isArray(dir)) llmDirectory = dir
    }
  } catch { /* ignore */ }
  const rows = [...collectFromSettings(settings, llmDirectory), ...collectFromLlm(llm)]
  const byId = new Map()
  for (const row of rows) {
    const e = normalizeProviderEntry(row)
    if (!e) continue
    const cur = byId.get(e.id)
    if (!cur) {
      byId.set(e.id, { ...e, models: [...e.models] })
      continue
    }
    // 合并:显示名取 settings/llm 的非兜底值;models 取并集;keyEnv 优先非空
    if (cur.displayName === cur.id && e.displayName !== e.id) cur.displayName = e.displayName
    if (e.keyEnv && !cur.keyEnv) cur.keyEnv = e.keyEnv
    for (const m of e.models) if (!cur.models.includes(m)) cur.models.push(m)
    cur.source = 'settings' // settings 为优先来源
  }
  return [...byId.values()].sort((a, b) => a.displayName.localeCompare(b.displayName) || a.id.localeCompare(b.id))
}

/**
 * 账本观测补集:把 ledger 中出现的 provider(或其 key 标签)补进目录,
 * 保证「消耗统计里出现过的 Key」永远有目录行(即使已从全局设置删除)。
 */
export function mergeLedgerProviders(list, entries) {
  const byId = new Map(list.map((p) => [p.id, { ...p, models: [...(p.models || [])] }]))
  const seen = new Set(byId.keys())
  for (const e of Array.isArray(entries) ? entries : []) {
    if (!isObj(e)) continue
    const identity = identityOfEntry(e)
    if (identity === 'unknown' || seen.has(identity)) {
      if (seen.has(identity)) {
        const cur = byId.get(identity)
        const model = strOrEmpty(e.model)
        if (cur && model !== '' && !cur.models.includes(model)) cur.models.push(model)
      }
      continue
    }
    seen.add(identity)
    const model = strOrEmpty(e.model)
    byId.set(identity, {
      id: identity,
      displayName: fallbackDisplayNameOf(identity),
      keyEnv: typeof e.key === 'string' && e.key.trim() !== '' ? e.key.trim() : defaultEnvOfRoute(identity),
      models: model !== '' ? [model] : [],
      source: 'ledger',
    })
  }
  return [...byId.values()].sort((a, b) => a.displayName.localeCompare(b.displayName) || a.id.localeCompare(b.id))
}

/**
 * 把 plans 中旧 key 标签(env 名或 provider 名)归一为 Provider id。
 * 目录里 keyEnv===键 或 id===键 时归一到 provider id;查不到的键保留原样
 * (由 Token Plan Key 管理页手动删除原有 token-plan 属性)。
 * @returns {{ plans: object, changed: boolean, moved: number }}
 */
export function migratePlanKeysToProviders(plansRaw, providerList) {
  const plans = isObj(plansRaw) ? plansRaw : {}
  const byEnv = new Map()
  const byId = new Map()
  for (const p of providerList || []) {
    if (!isObj(p)) continue
    byId.set(p.id, p)
    if (p.keyEnv) byEnv.set(p.keyEnv, p)
  }
  // 提示表反向推导:env 名 → 唯一归属路由(目录未覆盖的已知适配器,如 deepseek-official)
  const envByHint = new Map()
  for (const route of Object.keys(PROVIDER_KEY_HINTS)) {
    const env = defaultEnvOfRoute(route)
    if (env === '') continue
    if (!envByHint.has(env)) envByHint.set(env, [])
    envByHint.get(env).push(route)
  }
  const out = {}
  let changed = false
  let moved = 0
  const targetOf = (k) => {
    if (byId.has(k)) return k
    const byEnvHit = byEnv.get(k)
    if (byEnvHit) return byEnvHit.id
    const hinted = envByHint.get(k)
    if (Array.isArray(hinted) && hinted.length === 1 && hinted[0] !== k) return hinted[0]
    return null
  }
  const planKeys = Object.keys(plans)
  // 第一遍:provider id 直键优先占位(新写法,字段冲突以此为准)
  for (const k of planKeys) {
    const v = plans[k]
    if (!isObj(v)) continue
    if (byId.has(k)) out[k] = { ...v }
  }
  // 第二遍:旧 env 别名/未知键并入;别名迁移到 provider id
  for (const k of planKeys) {
    const v = plans[k]
    if (!isObj(v)) continue
    const target = targetOf(k)
    if (target === null) {
      if (out[k] === undefined) out[k] = { ...v }
      continue
    }
    if (target !== k) {
      changed = true
      moved += 1
    }
    const exist = out[target]
    if (!exist) {
      out[target] = { ...v }
      continue
    }
    // 合并:enabled 任一为真则真;其余字段 target 直键优先(已占位),别名只补齐空缺
    const merged = { ...v, ...exist }
    merged.enabled = !!(exist.enabled || v.enabled)
    out[target] = merged
  }
  return { plans: out, changed, moved }
}
