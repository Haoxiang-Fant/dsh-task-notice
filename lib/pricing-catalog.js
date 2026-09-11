/**
 * 内置官方价格目录(0.3.5):主流 LLM 的官方 API 价格,单位「每 1M tokens」。
 *
 * 0.3.5 起默认价格基准为《大模型API定价对比(4).csv》(参考数据),列映射:
 *   输入价格 → cacheOut(缓外输入)、输出价格 → output、缓存命中输入 → cacheIn、
 *   缓存写入 → cacheWrite、推理过程 → reasoning;DeepSeek 官方 (空闲)/(高峰)
 *   成对行内嵌为 peak 子档(基础价 = 谷时价,按调用时刻取档)。
 * 本文件由 tools/build-catalog.mjs 生成 — 改价格请改 CSV 后重跑生成器。
 * 0.3.4 目录中 CSV 未收录的条目保留为补充(标「0.3.4 目录补充」)。
 * USD 价 = CNY ÷ 7.2 推导(目录只有人民币价)。本模块零外部依赖。
 */

export const CNY_PER_USD = 7.2

/** 官方价格来源(供文档引用)。 */
export const CATALOG_SOURCE_URLS = [
  '《大模型API定价对比(4).csv》(0.3.5 起插件内置目录默认价格基准)',
  'DeepSeek 官方: https://api-docs.deepseek.com/zh-cn/quick_start/pricing(峰谷计价)',
]

function mul(p, k) {
  const out = {}
  for (const key of Object.keys(p || {})) out[key] = round4(p[key] * k)
  return out
}
function round4(n) {
  return Math.round(n * 10000) / 10000
}

/**
 * 构造一条目录项。
 * @param {object} spec { cny?, usd?, match?, source?, peak?: { offPeak?, peak? } }
 *   至少给出 cny 或 usd 之一;缺失一侧按 CNY_PER_USD 折算。
 */
function entry(spec) {
  const cny = spec.cny ? { ...spec.cny } : mul(spec.usd, CNY_PER_USD)
  const usd = spec.usd ? { ...spec.usd } : mul(spec.cny, 1 / CNY_PER_USD)
  const e = { cny, usd, source: spec.source || '' }
  if (Array.isArray(spec.match) && spec.match.length > 0) e.match = spec.match
  if (spec.peak) {
    const peak = {}
    if (spec.peak.offPeak) {
      const o = spec.peak.offPeak
      peak.offPeak = { cny: o.cny ? { ...o.cny } : mul(o.usd, CNY_PER_USD), usd: o.usd ? { ...o.usd } : mul(o.cny, 1 / CNY_PER_USD) }
    }
    if (spec.peak.peak) {
      const p = spec.peak.peak
      peak.peak = { cny: p.cny ? { ...p.cny } : mul(p.usd, CNY_PER_USD), usd: p.usd ? { ...p.usd } : mul(p.cny, 1 / CNY_PER_USD) }
    }
    e.peak = peak
  }
  return e
}

export const OFFICIAL_PRICE_CATALOG = {
  // ── 《大模型API定价对比(4).csv》基准价(0.3.5) ────────────────────────
  'v4-flash-vision': entry({ cny: {"cacheIn":0.04,"cacheOut":2,"output":8,"cacheWrite":0,"reasoning":0}, source: "DeepSeek · 《大模型API定价对比(4).csv》", peak: { offPeak: { cny: {"cacheIn":0.04,"cacheOut":2,"output":8,"cacheWrite":0,"reasoning":0} }, peak: { cny: {"cacheIn":0.04,"cacheOut":2,"output":8,"cacheWrite":0,"reasoning":0} } } }),
  'deepseek-v4-flash': entry({ cny: {"cacheIn":0.02,"cacheOut":1,"output":4,"cacheWrite":0,"reasoning":0}, match: ["deepseek-chat","DeepSeek-V4-Flash-0731"], source: "DeepSeek · 《大模型API定价对比(4).csv》", peak: { offPeak: { cny: {"cacheIn":0.02,"cacheOut":1,"output":4,"cacheWrite":0,"reasoning":0} }, peak: { cny: {"cacheIn":0.04,"cacheOut":2,"output":8,"cacheWrite":0,"reasoning":0} } } }),
  'deepseek-v4-pro': entry({ cny: {"cacheIn":0.15,"cacheOut":4.5,"output":13.5,"cacheWrite":0,"reasoning":0}, match: ["deepseek-reasoner","DeepSeek-V4-Pro-0813"], source: "DeepSeek · 《大模型API定价对比(4).csv》", peak: { offPeak: { cny: {"cacheIn":0.15,"cacheOut":4.5,"output":13.5,"cacheWrite":0,"reasoning":0} }, peak: { cny: {"cacheIn":0.3,"cacheOut":9,"output":27,"cacheWrite":0,"reasoning":0} } } }),
  'gpt-5.6-sol': entry({ cny: {"cacheIn":9.06,"cacheOut":36.25,"output":217.5,"cacheWrite":45.31,"reasoning":0}, match: ["gpt-5-6-sol"], source: "OpenAI · 《大模型API定价对比(4).csv》" }),
  'gpt-5.6-sol-fast': entry({ cny: {"cacheIn":0,"cacheOut":72.5,"output":435,"cacheWrite":90.62,"reasoning":0}, match: ["gpt-5-6-sol-fast"], source: "OpenAI · 《大模型API定价对比(4).csv》" }),
  'gpt-5.6-terra': entry({ cny: {"cacheIn":1.81,"cacheOut":14.5,"output":87,"cacheWrite":18.12,"reasoning":0}, match: ["gpt-5-6-terra"], source: "OpenAI · 《大模型API定价对比(4).csv》" }),
  'gpt-5.6-luna': entry({ cny: {"cacheIn":0.18,"cacheOut":1.45,"output":8.7,"cacheWrite":1.81,"reasoning":0}, match: ["gpt-5-6-luna"], source: "OpenAI · 《大模型API定价对比(4).csv》" }),
  'gpt-5.5': entry({ cny: {"cacheIn":3.63,"cacheOut":36.25,"output":217.5,"cacheWrite":45.31,"reasoning":0}, match: ["gpt-5-5"], source: "OpenAI · 《大模型API定价对比(4).csv》" }),
  'gpt-5.4': entry({ cny: {"cacheIn":1.81,"cacheOut":18.13,"output":108.75,"cacheWrite":22.66,"reasoning":0}, match: ["gpt-5-4"], source: "OpenAI · 《大模型API定价对比(4).csv》" }),
  'gpt-5.4-mini': entry({ cny: {"cacheIn":0.54,"cacheOut":5.44,"output":32.63,"cacheWrite":6.8,"reasoning":0}, match: ["gpt-5-4-mini"], source: "OpenAI · 《大模型API定价对比(4).csv》" }),
  'gpt-4o': entry({ cny: {"cacheIn":0,"cacheOut":18.13,"output":72.5,"cacheWrite":22.66,"reasoning":0}, source: "OpenAI · 《大模型API定价对比(4).csv》" }),
  'gpt-4.1': entry({ cny: {"cacheIn":0,"cacheOut":14.5,"output":58,"cacheWrite":18.12,"reasoning":0}, match: ["gpt-4-1"], source: "OpenAI · 《大模型API定价对比(4).csv》" }),
  'gpt-4.1-mini': entry({ cny: {"cacheIn":0,"cacheOut":2.9,"output":11.6,"cacheWrite":3.62,"reasoning":0}, match: ["gpt-4-1-mini"], source: "OpenAI · 《大模型API定价对比(4).csv》" }),
  'o4-mini': entry({ cny: {"cacheIn":0,"cacheOut":7.98,"output":31.9,"cacheWrite":9.98,"reasoning":31.9}, source: "OpenAI · 《大模型API定价对比(4).csv》" }),
  'gpt-realtime-2-audio': entry({ cny: {"cacheIn":0,"cacheOut":232,"output":464,"cacheWrite":290,"reasoning":0}, source: "OpenAI · 《大模型API定价对比(4).csv》" }),
  'gpt-realtime-2-text': entry({ cny: {"cacheIn":0,"cacheOut":29,"output":174,"cacheWrite":36.25,"reasoning":0}, match: ["gpt-realtime-2"], source: "OpenAI · 《大模型API定价对比(4).csv》" }),
  'gpt-realtime-2-image': entry({ cny: {"cacheIn":0,"cacheOut":36.25,"output":0,"cacheWrite":45.31,"reasoning":0}, source: "OpenAI · 《大模型API定价对比(4).csv》" }),
  'gpt-image-2': entry({ cny: {"cacheIn":0,"cacheOut":58,"output":217.5,"cacheWrite":72.5,"reasoning":0}, source: "OpenAI · 《大模型API定价对比(4).csv》" }),
  'claude-fable-5': entry({ cny: {"cacheIn":7.25,"cacheOut":72.5,"output":362.5,"cacheWrite":90.62,"reasoning":0}, source: "Anthropic · 《大模型API定价对比(4).csv》" }),
  'claude-opus-4.8': entry({ cny: {"cacheIn":3.63,"cacheOut":36.25,"output":181.25,"cacheWrite":45.3125,"reasoning":0}, match: ["claude-opus-4-8"], source: "Anthropic · 《大模型API定价对比(4).csv》" }),
  'claude-opus-4.7': entry({ cny: {"cacheIn":3.63,"cacheOut":36.25,"output":181.25,"cacheWrite":45.31,"reasoning":0}, match: ["claude-opus-4-7"], source: "Anthropic · 《大模型API定价对比(4).csv》" }),
  'claude-opus-4.6': entry({ cny: {"cacheIn":3.63,"cacheOut":36.25,"output":181.25,"cacheWrite":45.31,"reasoning":0}, match: ["claude-opus-4-6"], source: "Anthropic · 《大模型API定价对比(4).csv》" }),
  'claude-opus-4.5': entry({ cny: {"cacheIn":3.63,"cacheOut":36.25,"output":181.25,"cacheWrite":45.31,"reasoning":0}, match: ["claude-opus-4-5"], source: "Anthropic · 《大模型API定价对比(4).csv》" }),
  'claude-opus-4.1': entry({ cny: {"cacheIn":0,"cacheOut":108.75,"output":543.75,"cacheWrite":135.94,"reasoning":0}, match: ["claude-opus-4-1"], source: "Anthropic · 《大模型API定价对比(4).csv》" }),
  'claude-opus-4': entry({ cny: {"cacheIn":0,"cacheOut":108.75,"output":543.75,"cacheWrite":135.94,"reasoning":0}, source: "Anthropic · 《大模型API定价对比(4).csv》" }),
  'claude-opus-3': entry({ cny: {"cacheIn":0,"cacheOut":108.75,"output":543.75,"cacheWrite":135.94,"reasoning":0}, source: "Anthropic · 《大模型API定价对比(4).csv》" }),
  'claude-sonnet-4.6': entry({ cny: {"cacheIn":2.18,"cacheOut":21.75,"output":108.75,"cacheWrite":27.19,"reasoning":0}, match: ["claude-sonnet-4-6"], source: "Anthropic · 《大模型API定价对比(4).csv》" }),
  'claude-sonnet-4.5': entry({ cny: {"cacheIn":2.18,"cacheOut":21.75,"output":108.75,"cacheWrite":27.19,"reasoning":0}, match: ["claude-sonnet-4-5"], source: "Anthropic · 《大模型API定价对比(4).csv》" }),
  'claude-sonnet-4': entry({ cny: {"cacheIn":2.18,"cacheOut":21.75,"output":108.75,"cacheWrite":27.19,"reasoning":0}, source: "Anthropic · 《大模型API定价对比(4).csv》" }),
  'claude-sonnet-3.7': entry({ cny: {"cacheIn":2.18,"cacheOut":21.75,"output":108.75,"cacheWrite":27.19,"reasoning":0}, match: ["claude-sonnet-3-7"], source: "Anthropic · 《大模型API定价对比(4).csv》" }),
  'claude-haiku-4.5': entry({ cny: {"cacheIn":0,"cacheOut":7.25,"output":36.25,"cacheWrite":9.06,"reasoning":0}, match: ["claude-haiku-4-5"], source: "Anthropic · 《大模型API定价对比(4).csv》" }),
  'claude-haiku-3.5': entry({ cny: {"cacheIn":0,"cacheOut":5.8,"output":29,"cacheWrite":7.25,"reasoning":0}, match: ["claude-haiku-3-5"], source: "Anthropic · 《大模型API定价对比(4).csv》" }),
  'gemini-3.8-flash': entry({ cny: {"cacheIn":0,"cacheOut":5.44,"output":27.19,"cacheWrite":0,"reasoning":0}, match: ["gemini-3-8-flash"], source: "Google · 《大模型API定价对比(4).csv》" }),
  'gemini-3.7-flash': entry({ cny: {"cacheIn":0,"cacheOut":5.44,"output":27.19,"cacheWrite":0,"reasoning":0}, match: ["gemini-3-7-flash"], source: "Google · 《大模型API定价对比(4).csv》" }),
  'gemini-3.6-flash': entry({ cny: {"cacheIn":0,"cacheOut":10.88,"output":54.38,"cacheWrite":0,"reasoning":0}, match: ["gemini-3-6-flash"], source: "Google · 《大模型API定价对比(4).csv》" }),
  'gemini-3.5-flash-lite': entry({ cny: {"cacheIn":0,"cacheOut":2.18,"output":18.13,"cacheWrite":0,"reasoning":0}, match: ["gemini-3-5-flash-lite"], source: "Google · 《大模型API定价对比(4).csv》" }),
  'gemini-3.1-flash-lite': entry({ cny: {"cacheIn":0,"cacheOut":1.81,"output":10.88,"cacheWrite":0,"reasoning":0}, match: ["gemini-3-1-flash-lite"], source: "Google · 《大模型API定价对比(4).csv》" }),
  'gemini-2.5-flash-lite': entry({ cny: {"cacheIn":0,"cacheOut":0.73,"output":2.9,"cacheWrite":0,"reasoning":0}, match: ["gemini-2-5-flash-lite"], source: "Google · 《大模型API定价对比(4).csv》" }),
  'gemini-2.5-flash': entry({ cny: {"cacheIn":0,"cacheOut":2.18,"output":18.13,"cacheWrite":0,"reasoning":0}, match: ["gemini-2-5-flash"], source: "Google · 《大模型API定价对比(4).csv》" }),
  'gemini-2.5-pro': entry({ cny: {"cacheIn":0,"cacheOut":9.06,"output":72.5,"cacheWrite":0,"reasoning":0}, match: ["gemini-2.5-pro","gemini-2-5-pro"], source: "Google · 《大模型API定价对比(4).csv》" }),
  'gemini-2.5-pro-long': entry({ cny: {"cacheIn":0,"cacheOut":18.13,"output":108.75,"cacheWrite":0,"reasoning":0}, match: ["gemini-2-5-pro-long"], source: "Google · 《大模型API定价对比(4).csv》" }),
  'gemini-3.1-pro': entry({ cny: {"cacheIn":0,"cacheOut":14.5,"output":87,"cacheWrite":0,"reasoning":0}, match: ["gemini-3.1-pro-preview","gemini-3-1-pro"], source: "Google · 《大模型API定价对比(4).csv》" }),
  'gemini-2.0-flash': entry({ cny: {"cacheIn":0,"cacheOut":1.09,"output":4.35,"cacheWrite":0,"reasoning":0}, match: ["gemini-2-0-flash"], source: "Google · 《大模型API定价对比(4).csv》" }),
  'gemini-2.0-pro': entry({ cny: {"cacheIn":0,"cacheOut":0,"output":0,"cacheWrite":0,"reasoning":0}, match: ["gemini-2-0-pro"], source: "Google · 《大模型API定价对比(4).csv》" }),
  'grok-4.6': entry({ cny: {"cacheIn":0,"cacheOut":14.5,"output":43.5,"cacheWrite":0,"reasoning":0}, match: ["grok-4-6"], source: "xAI · 《大模型API定价对比(4).csv》" }),
  'grok-4.5': entry({ cny: {"cacheIn":0,"cacheOut":14.5,"output":43.5,"cacheWrite":0,"reasoning":0}, match: ["grok-4-5"], source: "xAI · 《大模型API定价对比(4).csv》" }),
  'grok-4.3': entry({ cny: {"cacheIn":0,"cacheOut":0,"output":0,"cacheWrite":0,"reasoning":0}, match: ["grok-4-3"], source: "xAI · 《大模型API定价对比(4).csv》" }),
  'grok-4': entry({ cny: {"cacheIn":0,"cacheOut":14.5,"output":43.5,"cacheWrite":0,"reasoning":0}, source: "xAI · 《大模型API定价对比(4).csv》" }),
  'grok-3-beta': entry({ cny: {"cacheIn":0,"cacheOut":14.5,"output":72.5,"cacheWrite":0,"reasoning":0}, source: "xAI · 《大模型API定价对比(4).csv》" }),
  'grok-3-fast-beta': entry({ cny: {"cacheIn":0,"cacheOut":18.13,"output":90.63,"cacheWrite":0,"reasoning":0}, source: "xAI · 《大模型API定价对比(4).csv》" }),
  'grok-3-mini-beta': entry({ cny: {"cacheIn":0,"cacheOut":2.18,"output":3.63,"cacheWrite":0,"reasoning":0}, source: "xAI · 《大模型API定价对比(4).csv》" }),
  'grok-3-mini-fast-beta': entry({ cny: {"cacheIn":0,"cacheOut":3.63,"output":14.5,"cacheWrite":0,"reasoning":0}, source: "xAI · 《大模型API定价对比(4).csv》" }),
  'grok-2-1212': entry({ cny: {"cacheIn":0,"cacheOut":14.5,"output":72.5,"cacheWrite":0,"reasoning":0}, source: "xAI · 《大模型API定价对比(4).csv》" }),
  'grok-2-vision-1212': entry({ cny: {"cacheIn":0,"cacheOut":14.5,"output":72.5,"cacheWrite":0,"reasoning":0}, source: "xAI · 《大模型API定价对比(4).csv》" }),
  'qwen3.8-max': entry({ cny: {"cacheIn":0,"cacheOut":14.5,"output":43.5,"cacheWrite":0,"reasoning":0}, match: ["qwen3-8-max"], source: "阿里通义 · 《大模型API定价对比(4).csv》" }),
  'qwen3.7-max': entry({ cny: {"cacheIn":0,"cacheOut":6,"output":18,"cacheWrite":0,"reasoning":0}, match: ["qwen3-7-max"], source: "阿里通义 · 《大模型API定价对比(4).csv》" }),
  'qwen3-max': entry({ cny: {"cacheIn":0,"cacheOut":2.5,"output":10,"cacheWrite":0,"reasoning":0}, source: "阿里通义 · 《大模型API定价对比(4).csv》" }),
  'qwen3.5-plus': entry({ cny: {"cacheIn":0,"cacheOut":0.8,"output":4.8,"cacheWrite":0,"reasoning":0}, match: ["qwen3-5-plus"], source: "阿里通义 · 《大模型API定价对比(4).csv》" }),
  'qwen-plus': entry({ cny: {"cacheIn":0,"cacheOut":0.8,"output":2,"cacheWrite":0,"reasoning":0}, source: "阿里通义 · 《大模型API定价对比(4).csv》" }),
  'qwen3.5-flash': entry({ cny: {"cacheIn":0,"cacheOut":0.2,"output":2,"cacheWrite":0,"reasoning":0}, match: ["qwen3-5-flash"], source: "阿里通义 · 《大模型API定价对比(4).csv》" }),
  'qwen-flash': entry({ cny: {"cacheIn":0,"cacheOut":0.15,"output":1.5,"cacheWrite":0,"reasoning":0}, source: "阿里通义 · 《大模型API定价对比(4).csv》" }),
  'qwen-turbo': entry({ cny: {"cacheIn":0,"cacheOut":0.3,"output":0.6,"cacheWrite":0,"reasoning":0}, source: "阿里通义 · 《大模型API定价对比(4).csv》" }),
  'qwen-long': entry({ cny: {"cacheIn":0,"cacheOut":0.5,"output":2,"cacheWrite":0,"reasoning":0}, source: "阿里通义 · 《大模型API定价对比(4).csv》" }),
  'qwq-plus': entry({ cny: {"cacheIn":0,"cacheOut":1.6,"output":4,"cacheWrite":0,"reasoning":4}, source: "阿里通义 · 《大模型API定价对比(4).csv》" }),
  'qwen3-coder-plus': entry({ cny: {"cacheIn":0,"cacheOut":4,"output":16,"cacheWrite":0,"reasoning":0}, source: "阿里通义 · 《大模型API定价对比(4).csv》" }),
  'qwen3-coder-flash': entry({ cny: {"cacheIn":0,"cacheOut":1,"output":4,"cacheWrite":0,"reasoning":0}, source: "阿里通义 · 《大模型API定价对比(4).csv》" }),
  'qwen3-omni-flash': entry({ cny: {"cacheIn":0,"cacheOut":1.8,"output":6.9,"cacheWrite":0,"reasoning":0}, source: "阿里通义 · 《大模型API定价对比(4).csv》" }),
  'qwen-omni-turbo': entry({ cny: {"cacheIn":0,"cacheOut":0.4,"output":1.6,"cacheWrite":0,"reasoning":0}, source: "阿里通义 · 《大模型API定价对比(4).csv》" }),
  'qwen3.6-plus': entry({ cny: {"cacheIn":0,"cacheOut":2,"output":12,"cacheWrite":0,"reasoning":0}, match: ["qwen3-6-plus"], source: "阿里通义 · 《大模型API定价对比(4).csv》" }),
  'qwen-max': entry({ cny: {"cacheIn":0,"cacheOut":2.4,"output":9.6,"cacheWrite":0,"reasoning":0}, match: ["qwen-max","qwen-max-latest"], source: "阿里通义 · 《大模型API定价对比(4).csv》" }),
  'qwen2.5-72b-instruct': entry({ cny: {"cacheIn":0,"cacheOut":4,"output":12,"cacheWrite":0,"reasoning":0}, match: ["qwen2-5-72b-instruct"], source: "阿里通义 · 《大模型API定价对比(4).csv》" }),
  'qwen2.5-7b': entry({ cny: {"cacheIn":0,"cacheOut":0,"output":0,"cacheWrite":0,"reasoning":0}, match: ["qwen2-5-7b"], source: "阿里通义 · 《大模型API定价对比(4).csv》" }),
  'glm-5.2': entry({ cny: {"cacheIn":2,"cacheOut":8,"output":28,"cacheWrite":0,"reasoning":0}, match: ["glm-5-2"], source: "智谱AI · 《大模型API定价对比(4).csv》" }),
  'glm-5.1-pro': entry({ cny: {"cacheIn":1.3,"cacheOut":6,"output":24,"cacheWrite":0,"reasoning":0}, match: ["glm-5.1","glm-5-1-pro"], source: "智谱AI · 《大模型API定价对比(4).csv》" }),
  'glm-5.1-pro-long': entry({ cny: {"cacheIn":2,"cacheOut":8,"output":28,"cacheWrite":0,"reasoning":0}, match: ["glm-5-1-pro-long"], source: "智谱AI · 《大模型API定价对比(4).csv》" }),
  'glm-5-turbo': entry({ cny: {"cacheIn":1.2,"cacheOut":5,"output":22,"cacheWrite":0,"reasoning":0}, source: "智谱AI · 《大模型API定价对比(4).csv》" }),
  'glm-5-turbo-long': entry({ cny: {"cacheIn":1.8,"cacheOut":7,"output":26,"cacheWrite":0,"reasoning":0}, source: "智谱AI · 《大模型API定价对比(4).csv》" }),
  'glm-5': entry({ cny: {"cacheIn":1,"cacheOut":4,"output":18,"cacheWrite":0,"reasoning":0}, source: "智谱AI · 《大模型API定价对比(4).csv》" }),
  'glm-5-long': entry({ cny: {"cacheIn":1.5,"cacheOut":6,"output":22,"cacheWrite":0,"reasoning":0}, source: "智谱AI · 《大模型API定价对比(4).csv》" }),
  'glm-4.7': entry({ cny: {"cacheIn":0.4,"cacheOut":2,"output":8,"cacheWrite":0,"reasoning":0}, match: ["glm-4.7","glm-4-7"], source: "智谱AI · 《大模型API定价对比(4).csv》" }),
  'glm-4.7-long': entry({ cny: {"cacheIn":0.6,"cacheOut":3,"output":14,"cacheWrite":0,"reasoning":0}, match: ["glm-4-7-long"], source: "智谱AI · 《大模型API定价对比(4).csv》" }),
  'glm-4.7-longctx': entry({ cny: {"cacheIn":0.8,"cacheOut":4,"output":16,"cacheWrite":0,"reasoning":0}, match: ["glm-4-7-longctx"], source: "智谱AI · 《大模型API定价对比(4).csv》" }),
  'glm-4.5-air': entry({ cny: {"cacheIn":0.16,"cacheOut":0.8,"output":2,"cacheWrite":0,"reasoning":0}, match: ["glm-4.5-air","glm-4-5-air"], source: "智谱AI · 《大模型API定价对比(4).csv》" }),
  'glm-4.5-air-long': entry({ cny: {"cacheIn":0.16,"cacheOut":0.8,"output":6,"cacheWrite":0,"reasoning":0}, match: ["glm-4-5-air-long"], source: "智谱AI · 《大模型API定价对比(4).csv》" }),
  'glm-4.5-air-longctx': entry({ cny: {"cacheIn":0.24,"cacheOut":1.2,"output":8,"cacheWrite":0,"reasoning":0}, match: ["glm-4-5-air-longctx"], source: "智谱AI · 《大模型API定价对比(4).csv》" }),
  'glm-4.7-flashx': entry({ cny: {"cacheIn":0.1,"cacheOut":0.5,"output":3,"cacheWrite":0,"reasoning":0}, match: ["glm-4-7-flashx"], source: "智谱AI · 《大模型API定价对比(4).csv》" }),
  'glm-4.7-flash': entry({ cny: {"cacheIn":0,"cacheOut":0,"output":0,"cacheWrite":0,"reasoning":0}, match: ["glm-4-7-flash"], source: "智谱AI · 《大模型API定价对比(4).csv》" }),
  'glm-4-flash': entry({ cny: {"cacheIn":0,"cacheOut":0,"output":0,"cacheWrite":0,"reasoning":0}, source: "智谱AI · 《大模型API定价对比(4).csv》" }),
  'deepseek-v4-flash-vision': entry({ cny: {"cacheIn":0.02,"cacheOut":1,"output":4,"cacheWrite":0,"reasoning":0}, match: ["deepseek-v4-flash-vision-exp"], source: "DeepSeek · 《大模型API定价对比(4).csv》" }),
  'deepseek-v3': entry({ cny: {"cacheIn":0,"cacheOut":2,"output":8,"cacheWrite":0,"reasoning":0}, source: "DeepSeek · 《大模型API定价对比(4).csv》" }),
  'deepseek-r1': entry({ cny: {"cacheIn":0.25,"cacheOut":1,"output":4,"cacheWrite":0,"reasoning":4}, source: "DeepSeek · 《大模型API定价对比(4).csv》" }),
  'deepseek-r1-distill': entry({ cny: {"cacheIn":0,"cacheOut":0.5,"output":2,"cacheWrite":0,"reasoning":2}, source: "DeepSeek · 《大模型API定价对比(4).csv》" }),
  'deepseek-1.3b-7b': entry({ cny: {"cacheIn":0,"cacheOut":0.008,"output":0,"cacheWrite":0,"reasoning":0}, match: ["deepseek-1-3b-7b"], source: "DeepSeek · 《大模型API定价对比(4).csv》" }),
  'deepseek-coder-math': entry({ cny: {"cacheIn":0,"cacheOut":0.012,"output":0,"cacheWrite":0,"reasoning":0}, source: "DeepSeek · 《大模型API定价对比(4).csv》" }),
  'hunyuan-t1': entry({ cny: {"cacheIn":0,"cacheOut":1,"output":4,"cacheWrite":0,"reasoning":0}, match: ["hunyuan-t1"], source: "腾讯混元 · 《大模型API定价对比(4).csv》" }),
  'hunyuan-turbos': entry({ cny: {"cacheIn":0,"cacheOut":0.8,"output":2,"cacheWrite":0,"reasoning":0}, source: "腾讯混元 · 《大模型API定价对比(4).csv》" }),
  'hy2.0-instruct': entry({ cny: {"cacheIn":0,"cacheOut":0.004505,"output":0.01113,"cacheWrite":0,"reasoning":0}, match: ["hy2-0-instruct"], source: "腾讯混元 · 《大模型API定价对比(4).csv》" }),
  'hy2.0-think': entry({ cny: {"cacheIn":0,"cacheOut":0.0053,"output":0.0212,"cacheWrite":0,"reasoning":0}, match: ["hy2-0-think"], source: "腾讯混元 · 《大模型API定价对比(4).csv》" }),
  'hunyuan-standard': entry({ cny: {"cacheIn":0,"cacheOut":0.5,"output":1,"cacheWrite":0,"reasoning":0}, source: "腾讯混元 · 《大模型API定价对比(4).csv》" }),
  'hunyuan-lite': entry({ cny: {"cacheIn":0,"cacheOut":0,"output":0,"cacheWrite":0,"reasoning":0}, source: "腾讯混元 · 《大模型API定价对比(4).csv》" }),
  'hunyuan-a13b': entry({ cny: {"cacheIn":0,"cacheOut":0.5,"output":2,"cacheWrite":0,"reasoning":0}, source: "腾讯混元 · 《大模型API定价对比(4).csv》" }),
  'hunyuan-role-latest': entry({ cny: {"cacheIn":0,"cacheOut":2.4,"output":9.6,"cacheWrite":0,"reasoning":0}, source: "腾讯混元 · 《大模型API定价对比(4).csv》" }),
  'hunyuan-translation': entry({ cny: {"cacheIn":0,"cacheOut":1.2,"output":3.6,"cacheWrite":0,"reasoning":0}, source: "腾讯混元 · 《大模型API定价对比(4).csv》" }),
  'hunyuan-translation-lite': entry({ cny: {"cacheIn":0,"cacheOut":1,"output":3,"cacheWrite":0,"reasoning":0}, source: "腾讯混元 · 《大模型API定价对比(4).csv》" }),
  'hy-vision-1.5-instruct': entry({ cny: {"cacheIn":0,"cacheOut":3,"output":9,"cacheWrite":0,"reasoning":0}, match: ["hy-vision-1-5-instruct"], source: "腾讯混元 · 《大模型API定价对比(4).csv》" }),
  'hunyuan-turbos-vision': entry({ cny: {"cacheIn":0,"cacheOut":3,"output":9,"cacheWrite":0,"reasoning":0}, source: "腾讯混元 · 《大模型API定价对比(4).csv》" }),
  'hunyuan-t1-vision': entry({ cny: {"cacheIn":0,"cacheOut":3,"output":9,"cacheWrite":0,"reasoning":0}, source: "腾讯混元 · 《大模型API定价对比(4).csv》" }),
  'hunyuan-turbos-vision-video': entry({ cny: {"cacheIn":0,"cacheOut":3,"output":9,"cacheWrite":0,"reasoning":0}, source: "腾讯混元 · 《大模型API定价对比(4).csv》" }),
  'hunyuan-embedding': entry({ cny: {"cacheIn":0,"cacheOut":0.7,"output":0.7,"cacheWrite":0,"reasoning":0}, source: "腾讯混元 · 《大模型API定价对比(4).csv》" }),
  'hunyuan-hy3': entry({ cny: {"cacheIn":0.25,"cacheOut":1,"output":4,"cacheWrite":0,"reasoning":0}, source: "腾讯混元 · 《大模型API定价对比(4).csv》" }),
  'kimi-k3': entry({ cny: {"cacheIn":2,"cacheOut":20,"output":100,"cacheWrite":0,"reasoning":0}, match: ["k3"], source: "月之暗面(Kimi) · 《大模型API定价对比(4).csv》" }),
  'kimi-k2.7-code': entry({ cny: {"cacheIn":1.3,"cacheOut":6.5,"output":27,"cacheWrite":0,"reasoning":0}, match: ["kimi-k2-7-code"], source: "月之暗面(Kimi) · 《大模型API定价对比(4).csv》" }),
  'kimi-k2': entry({ cny: {"cacheIn":0,"cacheOut":4,"output":16,"cacheWrite":0,"reasoning":0}, source: "月之暗面(Kimi) · 《大模型API定价对比(4).csv》" }),
  'kimi-k2.6-pro': entry({ cny: {"cacheIn":1.1,"cacheOut":6.5,"output":27,"cacheWrite":0,"reasoning":0}, match: ["kimi-k2.6","k2.6","kimi-k2-6-pro"], source: "月之暗面(Kimi) · 《大模型API定价对比(4).csv》" }),
  'moonshot-v1-128k': entry({ cny: {"cacheIn":0,"cacheOut":5,"output":20,"cacheWrite":0,"reasoning":0}, source: "月之暗面(Kimi) · 《大模型API定价对比(4).csv》" }),
  'moonshot-v1-32k': entry({ cny: {"cacheIn":0,"cacheOut":2,"output":8,"cacheWrite":0,"reasoning":0}, source: "月之暗面(Kimi) · 《大模型API定价对比(4).csv》" }),
  'moonshot-v1-8k': entry({ cny: {"cacheIn":0,"cacheOut":1,"output":4,"cacheWrite":0,"reasoning":0}, source: "月之暗面(Kimi) · 《大模型API定价对比(4).csv》" }),
  'ernie-5.1': entry({ cny: {"cacheIn":0,"cacheOut":4,"output":18,"cacheWrite":0,"reasoning":0}, match: ["ernie-5-1"], source: "百度文心 · 《大模型API定价对比(4).csv》" }),
  'ernie-5.0': entry({ cny: {"cacheIn":0,"cacheOut":4,"output":8,"cacheWrite":0,"reasoning":0}, match: ["ernie-5-0"], source: "百度文心 · 《大模型API定价对比(4).csv》" }),
  'ernie-4.5': entry({ cny: {"cacheIn":0,"cacheOut":0.8,"output":2.4,"cacheWrite":0,"reasoning":0}, match: ["ernie-4-5"], source: "百度文心 · 《大模型API定价对比(4).csv》" }),
  'ernie-4.0-turbo': entry({ cny: {"cacheIn":0,"cacheOut":3,"output":9,"cacheWrite":0,"reasoning":0}, match: ["ernie-4-0-turbo"], source: "百度文心 · 《大模型API定价对比(4).csv》" }),
  'ernie-x1': entry({ cny: {"cacheIn":0,"cacheOut":0.2,"output":0.8,"cacheWrite":0,"reasoning":0.8}, source: "百度文心 · 《大模型API定价对比(4).csv》" }),
  'ernie-3.5': entry({ cny: {"cacheIn":0,"cacheOut":0.8,"output":2,"cacheWrite":0,"reasoning":0}, match: ["ernie-3-5"], source: "百度文心 · 《大模型API定价对比(4).csv》" }),
  'ernie-speed': entry({ cny: {"cacheIn":0,"cacheOut":0,"output":0,"cacheWrite":0,"reasoning":0}, source: "百度文心 · 《大模型API定价对比(4).csv》" }),
  'ernie-lite': entry({ cny: {"cacheIn":0,"cacheOut":0,"output":0,"cacheWrite":0,"reasoning":0}, source: "百度文心 · 《大模型API定价对比(4).csv》" }),
  'ernie-tiny': entry({ cny: {"cacheIn":0,"cacheOut":0,"output":0,"cacheWrite":0,"reasoning":0}, source: "百度文心 · 《大模型API定价对比(4).csv》" }),
  'minimax-m3': entry({ cny: {"cacheIn":0.84,"cacheOut":4.2,"output":16.8,"cacheWrite":0,"reasoning":0}, match: ["minimax-m3"], source: "MiniMax · 《大模型API定价对比(4).csv》" }),
  'minimax-m3-priority': entry({ cny: {"cacheIn":0.42,"cacheOut":2.1,"output":8.4,"cacheWrite":0,"reasoning":0}, source: "MiniMax · 《大模型API定价对比(4).csv》" }),
  'minimax-m3-long': entry({ cny: {"cacheIn":1.68,"cacheOut":8.4,"output":33.6,"cacheWrite":0,"reasoning":0}, source: "MiniMax · 《大模型API定价对比(4).csv》" }),
  'minimax-m3-priority-long': entry({ cny: {"cacheIn":0.84,"cacheOut":4.2,"output":16.8,"cacheWrite":0,"reasoning":0}, source: "MiniMax · 《大模型API定价对比(4).csv》" }),
  'minimax-m2.7': entry({ cny: {"cacheIn":0.42,"cacheOut":2.1,"output":8.4,"cacheWrite":2.625,"reasoning":0}, match: ["minimax-m2.7","minimax-m2-7"], source: "MiniMax · 《大模型API定价对比(4).csv》" }),
  'minimax-m2.7-highspeed': entry({ cny: {"cacheIn":0.42,"cacheOut":4.2,"output":16.8,"cacheWrite":0,"reasoning":0}, match: ["minimax-m2-7-highspeed"], source: "MiniMax · 《大模型API定价对比(4).csv》" }),
  'minimax-m2.5': entry({ cny: {"cacheIn":0.21,"cacheOut":2.1,"output":8.4,"cacheWrite":0,"reasoning":0}, match: ["minimax-m2.5","minimax-m2.1","minimax-m2","minimax-m2-5"], source: "MiniMax · 《大模型API定价对比(4).csv》" }),
  'minimax-m2.5-highspeed': entry({ cny: {"cacheIn":0.21,"cacheOut":4.2,"output":16.8,"cacheWrite":0,"reasoning":0}, match: ["minimax-m2.5-highspeed","minimax-m2.1-highspeed","minimax-m2-highspeed","minimax-m2-5-highspeed"], source: "MiniMax · 《大模型API定价对比(4).csv》" }),
  'abab7-chat': entry({ cny: {"cacheIn":0,"cacheOut":5,"output":20,"cacheWrite":0,"reasoning":0}, source: "MiniMax · 《大模型API定价对比(4).csv》" }),
  'abab6.5s': entry({ cny: {"cacheIn":0,"cacheOut":1,"output":1,"cacheWrite":0,"reasoning":0}, match: ["abab6-5s"], source: "MiniMax · 《大模型API定价对比(4).csv》" }),
  'abab5.5-chat': entry({ cny: {"cacheIn":0,"cacheOut":0.5,"output":0.5,"cacheWrite":0,"reasoning":0}, match: ["abab5-5-chat"], source: "MiniMax · 《大模型API定价对比(4).csv》" }),
  'm3-plus': entry({ cny: {"cacheIn":0,"cacheOut":5,"output":9,"cacheWrite":0,"reasoning":0}, source: "百川智能 · 《大模型API定价对比(4).csv》" }),
  'baichuan-4': entry({ cny: {"cacheIn":0,"cacheOut":3,"output":12,"cacheWrite":0,"reasoning":0}, source: "百川智能 · 《大模型API定价对比(4).csv》" }),
  'baichuan-3-turbo': entry({ cny: {"cacheIn":0,"cacheOut":2,"output":8,"cacheWrite":0,"reasoning":0}, source: "百川智能 · 《大模型API定价对比(4).csv》" }),
  'baichuan-2-turbo': entry({ cny: {"cacheIn":0,"cacheOut":0.8,"output":2,"cacheWrite":0,"reasoning":0}, source: "百川智能 · 《大模型API定价对比(4).csv》" }),
  'yi-lightning': entry({ cny: {"cacheIn":0,"cacheOut":0.99,"output":0.99,"cacheWrite":0,"reasoning":0}, source: "零一万物 · 《大模型API定价对比(4).csv》" }),
  'yi-medium': entry({ cny: {"cacheIn":0,"cacheOut":0.5,"output":0.5,"cacheWrite":0,"reasoning":0}, source: "零一万物 · 《大模型API定价对比(4).csv》" }),
  'yi-vision': entry({ cny: {"cacheIn":0,"cacheOut":1,"output":1,"cacheWrite":0,"reasoning":0}, source: "零一万物 · 《大模型API定价对比(4).csv》" }),
  'yi-large': entry({ cny: {"cacheIn":0,"cacheOut":2,"output":2,"cacheWrite":0,"reasoning":0}, source: "零一万物 · 《大模型API定价对比(4).csv》" }),
  'step-3.7-flash': entry({ cny: {"cacheIn":0.27,"cacheOut":1.35,"output":8.1,"cacheWrite":0,"reasoning":0}, match: ["step-3-7-flash"], source: "阶跃星辰 · 《大模型API定价对比(4).csv》" }),
  'step-3.5-flash': entry({ cny: {"cacheIn":0.14,"cacheOut":0.7,"output":2.1,"cacheWrite":0,"reasoning":2.1}, match: ["step-3-5-flash"], source: "阶跃星辰 · 《大模型API定价对比(4).csv》" }),
  'step-2': entry({ cny: {"cacheIn":0,"cacheOut":6,"output":18,"cacheWrite":0,"reasoning":0}, source: "阶跃星辰 · 《大模型API定价对比(4).csv》" }),
  'step-2-mini': entry({ cny: {"cacheIn":0,"cacheOut":1,"output":3,"cacheWrite":0,"reasoning":0}, source: "阶跃星辰 · 《大模型API定价对比(4).csv》" }),
  'step-1': entry({ cny: {"cacheIn":0,"cacheOut":4,"output":12,"cacheWrite":0,"reasoning":0}, source: "阶跃星辰 · 《大模型API定价对比(4).csv》" }),
  'step-1.5v': entry({ cny: {"cacheIn":0,"cacheOut":3,"output":9,"cacheWrite":0,"reasoning":0}, match: ["step-1-5v"], source: "阶跃星辰 · 《大模型API定价对比(4).csv》" }),
  'step-r': entry({ cny: {"cacheIn":0,"cacheOut":8,"output":24,"cacheWrite":0,"reasoning":24}, source: "阶跃星辰 · 《大模型API定价对比(4).csv》" }),
  'step-cc': entry({ cny: {"cacheIn":0,"cacheOut":1,"output":2,"cacheWrite":0,"reasoning":0}, source: "阶跃星辰 · 《大模型API定价对比(4).csv》" }),
  'step-1o-turbo-vision': entry({ cny: {"cacheIn":0.5,"cacheOut":2.5,"output":8,"cacheWrite":0,"reasoning":0}, source: "阶跃星辰 · 《大模型API定价对比(4).csv》" }),
  'stepaudio-2.5-realtime': entry({ cny: {"cacheIn":2,"cacheOut":10,"output":70,"cacheWrite":0,"reasoning":0}, match: ["stepaudio-2-5-realtime"], source: "阶跃星辰 · 《大模型API定价对比(4).csv》" }),
  'stepaudio-2.5-chat': entry({ cny: {"cacheIn":2,"cacheOut":10,"output":25,"cacheWrite":0,"reasoning":0}, match: ["stepaudio-2-5-chat"], source: "阶跃星辰 · 《大模型API定价对比(4).csv》" }),
  'step-1o-audio': entry({ cny: {"cacheIn":5,"cacheOut":25,"output":60,"cacheWrite":0,"reasoning":0}, source: "阶跃星辰 · 《大模型API定价对比(4).csv》" }),
  'step-audio-2': entry({ cny: {"cacheIn":2,"cacheOut":10,"output":70,"cacheWrite":0,"reasoning":0}, source: "阶跃星辰 · 《大模型API定价对比(4).csv》" }),
  'step-audio-r1.5': entry({ cny: {"cacheIn":2,"cacheOut":10,"output":105,"cacheWrite":0,"reasoning":105}, match: ["step-audio-r1-5"], source: "阶跃星辰 · 《大模型API定价对比(4).csv》" }),
  'step-2x-large': entry({ cny: {"cacheIn":0,"cacheOut":0.1,"output":0,"cacheWrite":0,"reasoning":0}, source: "阶跃星辰 · 《大模型API定价对比(4).csv》" }),
  'step-image-edit-2': entry({ cny: {"cacheIn":0,"cacheOut":0.02,"output":0,"cacheWrite":0,"reasoning":0}, source: "阶跃星辰 · 《大模型API定价对比(4).csv》" }),
  'sensenova-6.5': entry({ cny: {"cacheIn":0,"cacheOut":4.5,"output":9,"cacheWrite":0,"reasoning":0}, match: ["sensenova-6-5"], source: "商汤科技 · 《大模型API定价对比(4).csv》" }),
  'sensenova-5.5': entry({ cny: {"cacheIn":0,"cacheOut":2,"output":5,"cacheWrite":0,"reasoning":0}, match: ["sensenova-5-5"], source: "商汤科技 · 《大模型API定价对比(4).csv》" }),
  'sensechat': entry({ cny: {"cacheIn":0,"cacheOut":1,"output":3,"cacheWrite":0,"reasoning":0}, source: "商汤科技 · 《大模型API定价对比(4).csv》" }),
  'sensechat-5': entry({ cny: {"cacheIn":0,"cacheOut":0.12,"output":0.48,"cacheWrite":0,"reasoning":0}, source: "商汤科技 · 《大模型API定价对比(4).csv》" }),
  'spark-x2-flash': entry({ cny: {"cacheIn":0,"cacheOut":1,"output":2,"cacheWrite":0,"reasoning":0}, source: "科大讯飞 · 《大模型API定价对比(4).csv》" }),
  'spark-x2': entry({ cny: {"cacheIn":0,"cacheOut":3,"output":3,"cacheWrite":0,"reasoning":0}, source: "科大讯飞 · 《大模型API定价对比(4).csv》" }),
  'spark-4.0-ultra': entry({ cny: {"cacheIn":0,"cacheOut":5,"output":10,"cacheWrite":0,"reasoning":0}, match: ["spark-4-0-ultra"], source: "科大讯飞 · 《大模型API定价对比(4).csv》" }),
  'spark-4.0-pro': entry({ cny: {"cacheIn":0,"cacheOut":3,"output":6,"cacheWrite":0,"reasoning":0}, match: ["spark-4-0-pro"], source: "科大讯飞 · 《大模型API定价对比(4).csv》" }),
  'spark-max': entry({ cny: {"cacheIn":0,"cacheOut":2,"output":5,"cacheWrite":0,"reasoning":0}, source: "科大讯飞 · 《大模型API定价对比(4).csv》" }),
  'spark-pro': entry({ cny: {"cacheIn":0,"cacheOut":1,"output":3,"cacheWrite":0,"reasoning":0}, source: "科大讯飞 · 《大模型API定价对比(4).csv》" }),
  'spark-lite': entry({ cny: {"cacheIn":0,"cacheOut":0,"output":0,"cacheWrite":0,"reasoning":0}, source: "科大讯飞 · 《大模型API定价对比(4).csv》" }),
  'mimo-v2.5-pro': entry({ cny: {"cacheIn":0.025,"cacheOut":3,"output":6,"cacheWrite":0,"reasoning":0}, match: ["mimo-v2-5-pro"], source: "小米MiMo · 《大模型API定价对比(4).csv》" }),
  'mimo-v2.5-pro-ultraspeed': entry({ cny: {"cacheIn":0,"cacheOut":9,"output":18,"cacheWrite":0,"reasoning":0}, match: ["mimo-v2-5-pro-ultraspeed"], source: "小米MiMo · 《大模型API定价对比(4).csv》" }),
  'mimo-v2.5': entry({ cny: {"cacheIn":0.02,"cacheOut":1,"output":2,"cacheWrite":0,"reasoning":0}, match: ["mimo-v2-5"], source: "小米MiMo · 《大模型API定价对比(4).csv》" }),
  'mimo-v2.5-tts': entry({ cny: {"cacheIn":0,"cacheOut":0,"output":0,"cacheWrite":0,"reasoning":0}, match: ["mimo-v2-5-tts"], source: "小米MiMo · 《大模型API定价对比(4).csv》" }),
  'mimo-v2.5-asr': entry({ cny: {"cacheIn":0,"cacheOut":0,"output":0,"cacheWrite":0,"reasoning":0}, match: ["mimo-v2-5-asr"], source: "小米MiMo · 《大模型API定价对比(4).csv》" }),
  'mimo-v2-pro': entry({ cny: {"cacheIn":0,"cacheOut":7.25,"output":21.75,"cacheWrite":0,"reasoning":0}, source: "小米MiMo · 《大模型API定价对比(4).csv》" }),
  'mimo-v2-flash': entry({ cny: {"cacheIn":0,"cacheOut":0,"output":0,"cacheWrite":0,"reasoning":0}, source: "小米MiMo · 《大模型API定价对比(4).csv》" }),
  'seed-2.0-pro': entry({ cny: {"cacheIn":0,"cacheOut":3.2,"output":16,"cacheWrite":0,"reasoning":0}, match: ["seed-2-0-pro"], source: "字节跳动(豆包) · 《大模型API定价对比(4).csv》" }),
  'seed-2.0-pro-32k-128k': entry({ cny: {"cacheIn":0,"cacheOut":4.8,"output":24,"cacheWrite":0,"reasoning":0}, match: ["seed-2-0-pro-32k-128k"], source: "字节跳动(豆包) · 《大模型API定价对比(4).csv》" }),
  'seed-2.1-pro': entry({ cny: {"cacheIn":0,"cacheOut":6,"output":30,"cacheWrite":0,"reasoning":0}, match: ["seed-2-1-pro"], source: "字节跳动(豆包) · 《大模型API定价对比(4).csv》" }),
  'seed-2.1-turbo': entry({ cny: {"cacheIn":0,"cacheOut":3,"output":15,"cacheWrite":0,"reasoning":0}, match: ["seed-2-1-turbo"], source: "字节跳动(豆包) · 《大模型API定价对比(4).csv》" }),
  'doubao-pro-128k-32k': entry({ cny: {"cacheIn":0,"cacheOut":0.8,"output":2,"cacheWrite":0,"reasoning":0}, source: "字节跳动(豆包) · 《大模型API定价对比(4).csv》" }),
  'doubao-lite-128k-32k': entry({ cny: {"cacheIn":0,"cacheOut":0.1,"output":0.1,"cacheWrite":0,"reasoning":0}, source: "字节跳动(豆包) · 《大模型API定价对比(4).csv》" }),
  'seed-2.0-mini': entry({ cny: {"cacheIn":0,"cacheOut":0.2,"output":2,"cacheWrite":0,"reasoning":0}, match: ["seed-2-0-mini"], source: "字节跳动(豆包) · 《大模型API定价对比(4).csv》" }),
  'openpangu-2.0-pro': entry({ cny: {"cacheIn":0.8,"cacheOut":3.2,"output":14.5,"cacheWrite":0,"reasoning":0}, match: ["openpangu-2-0-pro"], source: "华为云 · 《大模型API定价对比(4).csv》" }),
  'openpangu-2.0-pro-long': entry({ cny: {"cacheIn":1.2,"cacheOut":4.8,"output":17.6,"cacheWrite":0,"reasoning":0}, match: ["openpangu-2-0-pro-long"], source: "华为云 · 《大模型API定价对比(4).csv》" }),
  'openpangu-basic': entry({ cny: {"cacheIn":0,"cacheOut":0.5,"output":2,"cacheWrite":0,"reasoning":0}, source: "华为云 · 《大模型API定价对比(4).csv》" }),
  'openpangu-flagship': entry({ cny: {"cacheIn":0,"cacheOut":3,"output":12,"cacheWrite":0,"reasoning":0}, source: "华为云 · 《大模型API定价对比(4).csv》" }),
  'deepseek-v3.2': entry({ cny: {"cacheIn":0.4,"cacheOut":4,"output":6,"cacheWrite":0,"reasoning":0}, match: ["deepseek-v3-2"], source: "硅基流动 · 《大模型API定价对比(4).csv》" }),
  'deepseek-v3.1-terminus': entry({ cny: {"cacheIn":0.4,"cacheOut":4,"output":12,"cacheWrite":0,"reasoning":0}, match: ["deepseek-v3-1-terminus"], source: "硅基流动 · 《大模型API定价对比(4).csv》" }),
  'qwen3.5-397b-a17b-128k': entry({ cny: {"cacheIn":0,"cacheOut":1.2,"output":7.2,"cacheWrite":0,"reasoning":0}, match: ["qwen3-5-397b-a17b-128k"], source: "硅基流动 · 《大模型API定价对比(4).csv》" }),
  'qwen3.5-397b-a17b-128k-long': entry({ cny: {"cacheIn":0,"cacheOut":3,"output":18,"cacheWrite":0,"reasoning":0}, match: ["qwen3-5-397b-a17b-128k-long"], source: "硅基流动 · 《大模型API定价对比(4).csv》" }),
  'qwen3.5-122b-a10b-128k': entry({ cny: {"cacheIn":0,"cacheOut":0.8,"output":6.4,"cacheWrite":0,"reasoning":0}, match: ["qwen3-5-122b-a10b-128k"], source: "硅基流动 · 《大模型API定价对比(4).csv》" }),
  'qwen3.5-122b-a10b-128k-long': entry({ cny: {"cacheIn":0,"cacheOut":2,"output":16,"cacheWrite":0,"reasoning":0}, match: ["qwen3-5-122b-a10b-128k-long"], source: "硅基流动 · 《大模型API定价对比(4).csv》" }),
  'qwen3.5-35b-a3b-128k': entry({ cny: {"cacheIn":0,"cacheOut":0.4,"output":3.2,"cacheWrite":0,"reasoning":0}, match: ["qwen3-5-35b-a3b-128k"], source: "硅基流动 · 《大模型API定价对比(4).csv》" }),
  'qwen3.5-35b-a3b-128k-long': entry({ cny: {"cacheIn":0,"cacheOut":1.6,"output":12.8,"cacheWrite":0,"reasoning":0}, match: ["qwen3-5-35b-a3b-128k-long"], source: "硅基流动 · 《大模型API定价对比(4).csv》" }),
  'glm-5.1-pro-32k': entry({ cny: {"cacheIn":1.3,"cacheOut":6,"output":24,"cacheWrite":0,"reasoning":0}, match: ["glm-5-1-pro-32k"], source: "硅基流动 · 《大模型API定价对比(4).csv》" }),
  'glm-5.1-pro-32k-long': entry({ cny: {"cacheIn":2,"cacheOut":8,"output":28,"cacheWrite":0,"reasoning":0}, match: ["glm-5-1-pro-32k-long"], source: "硅基流动 · 《大模型API定价对比(4).csv》" }),
  'longcat-2.0': entry({ cny: {"cacheIn":0.1,"cacheOut":5,"output":20,"cacheWrite":0,"reasoning":0}, match: ["longcat-2-0"], source: "硅基流动 · 《大模型API定价对比(4).csv》" }),
  'ling-mini-2.0': entry({ cny: {"cacheIn":0,"cacheOut":0.5,"output":2,"cacheWrite":0,"reasoning":0}, match: ["ling-mini-2-0"], source: "硅基流动 · 《大模型API定价对比(4).csv》" }),
  'glm-z1-9b-0414': entry({ cny: {"cacheIn":0,"cacheOut":0,"output":0,"cacheWrite":0,"reasoning":0}, source: "硅基流动 · 《大模型API定价对比(4).csv》" }),
  'paddleocr-vl-1.5': entry({ cny: {"cacheIn":0,"cacheOut":0,"output":0,"cacheWrite":0,"reasoning":0}, match: ["paddleocr-vl-1-5"], source: "硅基流动 · 《大模型API定价对比(4).csv》" }),
  'deepseek-v4.1-flash': entry({ cny: {"cacheIn":0.02,"cacheOut":1,"output":4,"cacheWrite":0,"reasoning":0}, match: ["deepseek-v4-1-flash"], source: "DeepSeek · 《大模型API定价对比(4).csv》" }),
  'glm-5.3-flash': entry({ cny: {"cacheIn":0.23,"cacheOut":0.8,"output":2.8,"cacheWrite":0,"reasoning":0}, match: ["glm-5-3-flash"], source: "智谱AI · 《大模型API定价对比(4).csv》" }),
  'glm-5.3': entry({ cny: {"cacheIn":0,"cacheOut":0,"output":0,"cacheWrite":0,"reasoning":0}, match: ["glm-5-3"], source: "智谱AI · 《大模型API定价对比(4).csv》" }),
  'gemini-3.5-flash': entry({ cny: {"cacheIn":0,"cacheOut":5.44,"output":27.19,"cacheWrite":0,"reasoning":0}, match: ["gemini-3-5-flash"], source: "Google · 《大模型API定价对比(4).csv》" }),
  'gpt-5.6-sol-272k': entry({ cny: {"cacheIn":9.06,"cacheOut":36.25,"output":217.5,"cacheWrite":45.31,"reasoning":0}, match: ["gpt-5-6-sol-272k"], source: "OpenAI · 《大模型API定价对比(4).csv》" }),
  'gpt-5.6-sol-272k-long': entry({ cny: {"cacheIn":18.13,"cacheOut":72.5,"output":435,"cacheWrite":90.62,"reasoning":0}, match: ["gpt-5-6-sol-272k-long"], source: "OpenAI · 《大模型API定价对比(4).csv》" }),
  'gpt-5.6-terra-272k': entry({ cny: {"cacheIn":1.81,"cacheOut":14.5,"output":87,"cacheWrite":18.12,"reasoning":0}, match: ["gpt-5-6-terra-272k"], source: "OpenAI · 《大模型API定价对比(4).csv》" }),
  'gpt-5.6-terra-272k-long': entry({ cny: {"cacheIn":3.63,"cacheOut":29,"output":174,"cacheWrite":36.25,"reasoning":0}, match: ["gpt-5-6-terra-272k-long"], source: "OpenAI · 《大模型API定价对比(4).csv》" }),
  'gpt-5.6-luna-272k': entry({ cny: {"cacheIn":0.18,"cacheOut":1.45,"output":8.7,"cacheWrite":1.81,"reasoning":0}, match: ["gpt-5-6-luna-272k"], source: "OpenAI · 《大模型API定价对比(4).csv》" }),
  'gpt-5.6-luna-272k-long': entry({ cny: {"cacheIn":0.36,"cacheOut":2.9,"output":17.4,"cacheWrite":3.62,"reasoning":0}, match: ["gpt-5-6-luna-272k-long"], source: "OpenAI · 《大模型API定价对比(4).csv》" }),

  // ── 0.3.4 目录补充(CSV 未收录) ────────────────────────────────────────
  'deepseek-v4-flash-vision-exp': entry({ cny: {"cacheIn":0.02,"cacheOut":1,"output":2}, usd: {"cacheIn":0.0028,"cacheOut":0.1389,"output":0.2778}, source: "DeepSeek 官方(峰谷;基准《主流大模型API官方价格汇总》2026-09)(0.3.4 目录补充)", peak: { offPeak: { cny: {"cacheIn":0.02,"cacheOut":1,"output":2}, usd: {"cacheIn":0.0028,"cacheOut":0.1389,"output":0.2778} }, peak: { cny: {"cacheIn":0.04,"cacheOut":2,"output":4}, usd: {"cacheIn":0.0056,"cacheOut":0.2778,"output":0.5556} } } }),
  'deepseek-v3.1': entry({ cny: {"cacheOut":2,"output":8}, usd: {"cacheOut":0.2778,"output":1.1111}, source: "DeepSeek 官方(峰谷;基准《主流大模型API官方价格汇总》2026-09)(0.3.4 目录补充)", peak: { offPeak: { cny: {"cacheOut":2,"output":8}, usd: {"cacheOut":0.2778,"output":1.1111} }, peak: { cny: {"cacheOut":4,"output":16}, usd: {"cacheOut":0.5556,"output":2.2222} } } }),
  'gpt-4o-mini': entry({ cny: {"cacheIn":0.54,"cacheOut":1.08,"output":4.32}, usd: {"cacheIn":0.075,"cacheOut":0.15,"output":0.6}, source: "OpenAI 官方(0.3.4 目录补充)" }),
  'o3': entry({ cny: {"cacheIn":3.6,"cacheOut":14.4,"output":57.6}, usd: {"cacheIn":0.5,"cacheOut":2,"output":8}, match: ["gpt-5-o3"], source: "OpenAI 官方(0.3.4 目录补充)" }),
  'gpt-5': entry({ cny: {"cacheIn":0.9,"cacheOut":9,"output":72}, usd: {"cacheIn":0.125,"cacheOut":1.25,"output":10}, match: ["gpt-5.1"], source: "OpenAI 官方(0.3.4 目录补充)" }),
  'gpt-5-mini': entry({ cny: {"cacheIn":0.18,"cacheOut":1.8,"output":14.4}, usd: {"cacheIn":0.025,"cacheOut":0.25,"output":2}, source: "OpenAI 官方(0.3.4 目录补充)" }),
  'gpt-5-nano': entry({ cny: {"cacheIn":0.036,"cacheOut":0.36,"output":2.88}, usd: {"cacheIn":0.005,"cacheOut":0.05,"output":0.4}, source: "OpenAI 官方(0.3.4 目录补充)" }),
  'gpt-5.4-nano': entry({ cny: {"cacheIn":0.144,"cacheOut":1.44,"output":9}, usd: {"cacheIn":0.02,"cacheOut":0.2,"output":1.25}, source: "OpenAI 官方(基准《主流大模型API官方价格汇总》2026-09)(0.3.4 目录补充)" }),
  'claude-opus-4-7': entry({ cny: {"cacheIn":3.6,"cacheOut":36,"output":180}, usd: {"cacheIn":0.5,"cacheOut":5,"output":25}, source: "Anthropic 官方(0.3.4 目录补充)" }),
  'claude-opus-4-6': entry({ cny: {"cacheIn":3.6,"cacheOut":36,"output":180}, usd: {"cacheIn":0.5,"cacheOut":5,"output":25}, source: "Anthropic 官方(0.3.4 目录补充)" }),
  'claude-opus-4-5': entry({ cny: {"cacheIn":3.6,"cacheOut":36,"output":180}, usd: {"cacheIn":0.5,"cacheOut":5,"output":25}, match: ["claude-opus-4-1"], source: "Anthropic 官方(0.3.4 目录补充)" }),
  'claude-sonnet-4-6': entry({ cny: {"cacheIn":2.16,"cacheOut":21.6,"output":108}, usd: {"cacheIn":0.3,"cacheOut":3,"output":15}, source: "Anthropic 官方(基准《主流大模型API官方价格汇总》2026-09)(0.3.4 目录补充)" }),
  'claude-sonnet-4-5': entry({ cny: {"cacheIn":2.16,"cacheOut":21.6,"output":108}, usd: {"cacheIn":0.3,"cacheOut":3,"output":15}, match: ["claude-3-7-sonnet","claude-3-5-sonnet"], source: "Anthropic 官方(0.3.4 目录补充)" }),
  'claude-haiku-4-5': entry({ cny: {"cacheIn":0.72,"cacheOut":7.2,"output":36}, usd: {"cacheIn":0.1,"cacheOut":1,"output":5}, match: ["claude-3-5-haiku"], source: "Anthropic 官方(基准《主流大模型API官方价格汇总》2026-09)(0.3.4 目录补充)" }),
  'claude-opus-5': entry({ cny: {"cacheIn":3.6,"cacheOut":36,"output":180}, usd: {"cacheIn":0.5,"cacheOut":5,"output":25}, source: "Anthropic 官方(基准《主流大模型API官方价格汇总》2026-09)(0.3.4 目录补充)" }),
  'claude-sonnet-5': entry({ cny: {"cacheIn":2.16,"cacheOut":21.6,"output":72}, usd: {"cacheIn":0.3,"cacheOut":3,"output":10}, source: "Anthropic 官方(推广期;基准《主流大模型API官方价格汇总》2026-09)(0.3.4 目录补充)" }),
  'gemini-3-pro-preview': entry({ cny: {"cacheIn":2.88,"cacheOut":28.8,"output":129.6}, usd: {"cacheIn":0.4,"cacheOut":4,"output":18}, source: "Google 官方(0.3.4 目录补充)" }),
  'gemini-3.1-pro-preview': entry({ cny: {"cacheIn":3.6,"cacheOut":14.4,"output":86.4}, usd: {"cacheIn":0.5,"cacheOut":2,"output":12}, source: "Google 官方(基准《主流大模型API官方价格汇总》2026-09)(0.3.4 目录补充)" }),
  'gemini-3-flash-preview': entry({ cny: {"cacheIn":0.36,"cacheOut":3.6,"output":21.6}, usd: {"cacheIn":0.05,"cacheOut":0.5,"output":3}, source: "Google 官方(0.3.4 目录补充)" }),
  'gemini-1.5-flash': entry({ cny: {"cacheOut":0.54,"output":2.16}, usd: {"cacheOut":0.075,"output":0.3}, source: "Google 官方(0.3.4 目录补充)" }),
  'kimi-k2.6': entry({ cny: {"cacheIn":1.1,"cacheOut":6.5,"output":27}, usd: {"cacheIn":0.1528,"cacheOut":0.9028,"output":3.75}, source: "Kimi 官方(基准《主流大模型API官方价格汇总》2026-09)(0.3.4 目录补充)" }),
  'kimi-k2.5': entry({ cny: {"cacheIn":0.7,"cacheOut":4,"output":21}, usd: {"cacheIn":0.0972,"cacheOut":0.5556,"output":2.9167}, source: "Kimi 官方(基准《主流大模型API官方价格汇总》2026-09)(0.3.4 目录补充)" }),
  'kimi-k2-turbo-preview': entry({ cny: {"cacheIn":2,"cacheOut":8,"output":32}, usd: {"cacheIn":0.2778,"cacheOut":1.1111,"output":4.4444}, source: "Kimi 官方(特惠价,2026-09)(0.3.4 目录补充)" }),
  'qwen3.6-flash': entry({ cny: {"cacheOut":0.37,"output":2.9}, usd: {"cacheOut":0.0514,"output":0.4028}, source: "百炼官方(¥0.37~1.2 / ¥2.9~7.2 区间取基础价;基准《主流大模型API官方价格汇总》2026-09)(0.3.4 目录补充)" }),
  'qwen-vl-max': entry({ cny: {"cacheOut":1.5,"output":4.5}, usd: {"cacheOut":0.2083,"output":0.625}, source: "百炼官方(0.3.4 目录补充)" }),
  'qwen-vl-plus': entry({ cny: {"cacheOut":0.75,"output":2.25}, usd: {"cacheOut":0.1042,"output":0.3125}, source: "百炼官方(0.3.4 目录补充)" }),
  'seed-2.0-lite': entry({ cny: {"cacheOut":0.6,"output":3.66}, usd: {"cacheOut":0.0833,"output":0.5083}, source: "火山方舟官方(基准《主流大模型API官方价格汇总》2026-09)(0.3.4 目录补充)" }),
  'seed-1.6-flash': entry({ cny: {"cacheOut":0.075,"output":0.75}, usd: {"cacheOut":0.0104,"output":0.1042}, source: "火山方舟官方(基准《主流大模型API官方价格汇总》2026-09)(0.3.4 目录补充)" }),
  'doubao-lite': entry({ cny: {"cacheOut":0.1,"output":0.1}, usd: {"cacheOut":0.0139,"output":0.0139}, source: "火山方舟官方(基准《主流大模型API官方价格汇总》2026-09)(0.3.4 目录补充)" }),
  'glm-5.1': entry({ cny: {"cacheOut":6,"output":24}, usd: {"cacheOut":0.8333,"output":3.3333}, source: "Z.AI 官方(≤32K 价 ¥6/¥24;基准《主流大模型API官方价格汇总》2026-09)(0.3.4 目录补充)" }),
  'glm-4-plus': entry({ cny: {"cacheOut":5,"output":5}, usd: {"cacheOut":0.6944,"output":0.6944}, source: "Z.AI 官方(基准《主流大模型API官方价格汇总》2026-09)(0.3.4 目录补充)" }),
  'glm-4-air': entry({ cny: {"cacheOut":0.6,"output":0.6}, usd: {"cacheOut":0.0833,"output":0.0833}, source: "Z.AI 官方(¥0.6~1 / ¥0.6~2 区间取基础价;基准《主流大模型API官方价格汇总》2026-09)(0.3.4 目录补充)" }),
  'glm-4.6': entry({ cny: {"cacheIn":0.792,"cacheOut":4.32,"output":15.84}, usd: {"cacheIn":0.11,"cacheOut":0.6,"output":2.2}, source: "Z.AI 官方(0.3.4 目录补充)" }),
  'glm-4.5': entry({ cny: {"cacheIn":0.792,"cacheOut":4.32,"output":15.84}, usd: {"cacheIn":0.11,"cacheOut":0.6,"output":2.2}, source: "Z.AI 官方(0.3.4 目录补充)" }),
  'glm-4.5-x': entry({ cny: {"cacheIn":3.24,"cacheOut":15.84,"output":64.08}, usd: {"cacheIn":0.45,"cacheOut":2.2,"output":8.9}, source: "Z.AI 官方(0.3.4 目录补充)" }),
  'glm-4.5-airx': entry({ cny: {"cacheIn":1.584,"cacheOut":7.92,"output":32.4}, usd: {"cacheIn":0.22,"cacheOut":1.1,"output":4.5}, source: "Z.AI 官方(0.3.4 目录补充)" }),
  'ernie-4.5-turbo': entry({ cny: {"cacheOut":0.8,"output":3.2}, usd: {"cacheOut":0.1111,"output":0.4444}, source: "百度智能云官方(基准《主流大模型API官方价格汇总》2026-09)(0.3.4 目录补充)" }),
  'MiniMax-M3': entry({ cny: {"cacheIn":0.42,"cacheOut":2.1,"output":8.4,"cacheWrite":2.625}, usd: {"cacheIn":0.0583,"cacheOut":0.2917,"output":1.1667,"cacheWrite":0.3646}, source: "MiniMax 官方(基准《主流大模型API官方价格汇总》2026-09)(0.3.4 目录补充)" }),
  'MiniMax-M2.7': entry({ cny: {"cacheIn":0.42,"cacheOut":2.1,"output":8.4,"cacheWrite":2.625}, usd: {"cacheIn":0.0583,"cacheOut":0.2917,"output":1.1667,"cacheWrite":0.3646}, source: "MiniMax 官方(基准《主流大模型API官方价格汇总》2026-09)(0.3.4 目录补充)" }),
  'MiniMax-M2.7-highspeed': entry({ cny: {"cacheIn":0.42,"cacheOut":2.1,"output":16.8,"cacheWrite":2.625}, usd: {"cacheIn":0.0583,"cacheOut":0.2917,"output":2.3333,"cacheWrite":0.3646}, source: "MiniMax 官方(0.3.4 目录补充)" }),
  'MiniMax-M2.5': entry({ cny: {"cacheIn":0.21,"cacheOut":2.1,"output":8.4,"cacheWrite":2.625}, usd: {"cacheIn":0.0292,"cacheOut":0.2917,"output":1.1667,"cacheWrite":0.3646}, source: "MiniMax 官方(0.3.4 目录补充)" }),
  'MiniMax-M2.5-highspeed': entry({ cny: {"cacheIn":0.21,"cacheOut":2.1,"output":16.8,"cacheWrite":2.625}, usd: {"cacheIn":0.0292,"cacheOut":0.2917,"output":2.3333,"cacheWrite":0.3646}, source: "MiniMax 官方(0.3.4 目录补充)" }),
  'MiniMax-M2': entry({ cny: {"cacheIn":0.21,"cacheOut":2.1,"output":8.4,"cacheWrite":2.625}, usd: {"cacheIn":0.0292,"cacheOut":0.2917,"output":1.1667,"cacheWrite":0.3646}, source: "MiniMax 官方(0.3.4 目录补充)" }),
  'MiniMax-abab6.5s': entry({ cny: {"cacheOut":1,"output":1}, usd: {"cacheOut":0.1389,"output":0.1389}, source: "MiniMax 官方(基准《主流大模型API官方价格汇总》2026-09)(0.3.4 目录补充)" }),
  'baichuan-m3-plus': entry({ cny: {"cacheOut":5,"output":9}, usd: {"cacheOut":0.6944,"output":1.25}, source: "百川智能官方(基准《主流大模型API官方价格汇总》2026-09)(0.3.4 目录补充)" }),
}

/**
 * 按模型名查官方价(不区分大小写):先精确匹配 id / 别名,再尝试子串包含。
 * @returns {object|null} 目录项(含 cny / usd / 可选 peak)
 */
export function lookupCatalogModel(model) {
  if (typeof model !== 'string' || model.trim() === '') return null
  const m = model.trim().toLowerCase()
  for (const [id, e] of Object.entries(OFFICIAL_PRICE_CATALOG)) {
    if (id.toLowerCase() === m) return e
    if (Array.isArray(e.match) && e.match.some((a) => String(a).toLowerCase() === m)) return e
  }
  if (m.length >= 5) {
    // 子串匹配优先更长的 id(更具体),避免 'gpt-5.6-sol' 被 'gpt-5' 抢先命中
    const cands = []
    for (const [id, e] of Object.entries(OFFICIAL_PRICE_CATALOG)) {
      if (id.length >= 5 && m.includes(id.toLowerCase())) cands.push([id, e])
    }
    if (cands.length > 0) {
      cands.sort((a, b) => b[0].length - a[0].length)
      return cands[0][1]
    }
  }
  return null
}

/** 取目录项在指定币种下的基础价(cny / usd)。 */
export function catalogPriceFor(entry, currency) {
  if (entry === null || typeof entry !== 'object') return null
  return currency === '$' ? (entry.usd ?? null) : (entry.cny ?? null)
}

/** 取目录项在指定币种下的峰谷子档 { offPeak?, peak? }。 */
export function catalogPeakFor(entry, currency) {
  if (entry === null || typeof entry !== 'object' || entry.peak === undefined) return null
  const side = currency === '$' ? 'usd' : 'cny'
  const out = {}
  if (entry.peak.offPeak) out.offPeak = entry.peak.offPeak[side] ?? null
  if (entry.peak.peak) out.peak = entry.peak.peak[side] ?? null
  return (out.offPeak || out.peak) ? out : null
}
