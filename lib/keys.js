/**
 * Resolve the "key" (API credential) label for a model call.
 *
 * DSH resolves provider API keys from environment-variable references
 * (credential refs) per provider route — e.g. the deepseek-official adapter
 * reads `llm-deepseek.apiKeyEnv` (default `DEEPSEEK_API_KEY`). This module
 * maps a provider route to its likely credential reference and verifies it
 * through the process environment or the settings seam, so every recorded
 * usage entry is attributed to the concrete key variable that was actually
 * configured.
 *
 * 安全启动:no external imports — the credentials seam is reached via ctx,
 * so a missing package can never break this module's evaluation.
 */

/**
 * provider route → [ settings namespace, default env-var name ].
 * Extend this table as more providers are configured. Unknown providers fall
 * back to the provider id as the label.
 */
const PROVIDER_KEY_HINTS = {
  'scnet': ['llm-deepseek', 'SCNET_API_KEY'],
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

function envConfigured(name) {
  try {
    return typeof process.env[name] === 'string' && process.env[name].trim() !== ''
  } catch {
    return false
  }
}

/**
 * Resolve the key label for one call.
 * @param {object} ctx - host context (settings service).
 * @param {string|null} provider - provider route id.
 * @returns {{key: string, source: string}}
 */
export function resolveKeyLabel(ctx, provider) {
  const route = typeof provider === 'string' ? provider : ''
  const hint = PROVIDER_KEY_HINTS[route]
  if (hint) {
    const [ns, defaultEnv] = hint
    // 1) settings namespace apiKeyEnv (e.g. llm-deepseek.apiKeyEnv)
    try {
      const settings = typeof ctx?.get === 'function' ? ctx.get('settings') : ctx?.settings
      if (settings && typeof settings.get === 'function') {
        const section = settings.get(ns)
        if (section && typeof section === 'object') {
          const envField = section.apiKeyEnv ?? section.apiKeyVar ?? section.envVar
          if (typeof envField === 'string' && envField.trim() !== '') {
            return { key: envField.trim(), source: 'settings' }
          }
        }
      }
    } catch {
      /* namespace not registered — fall through */
    }
    // 2) environment variable actually configured
    if (envConfigured(defaultEnv)) {
      return { key: defaultEnv, source: 'env' }
    }
    return { key: defaultEnv, source: 'default' }
  }
  return { key: route !== '' ? route : 'unknown', source: 'provider' }
}
