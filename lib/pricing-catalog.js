/**
 * 内置官方价格目录(0.3.1):主流 LLM 的官方 API 价格,单位「每 1M tokens」。
 *
 * 默认价格基准:《主流大模型API官方价格汇总.xlsx》(2026-09)——目录中表格已收录的
 * 模型,其默认价一律按表格取值:
 *   - 「输入价格」→ cacheOut(缓存未命中输入);
 *   - 「缓存命中价格」→ cacheIn(命中缓存输入;表格标「—」的海外模型按各厂商官方
 *     缓存折扣惯例补齐:OpenAI GPT-4.1 系列 25% / GPT-5.x 系列 10%,Anthropic
 *     缓存读取 0.1×,Gemini 25%;表格标「—」的国内模型不设缓存价);
 *   - 「输出价格」→ output;
 *   - 区间价(如 ¥8~10 / ¥28~31.7)取基础起步价(低值),来源注明区间;
 *   - 表格「分类=国内」的厂商(DeepSeek / 阿里云 / 字节跳动 / 智谱 / 月之暗面 /
 *     百度 / 腾讯 / MiniMax / 小米 / 零一万物 / 阶跃星辰 / 百川智能 / 科大讯飞)
 *     以 cny 为官方价;「分类=海外」的厂商(OpenAI / Anthropic / Google)以 usd
 *     为官方价;缺失一侧按固定汇率 7.2 折算;
 *   - DeepSeek 峰谷计价(工作日 9:00-12:00 / 14:00-18:00 价格翻倍):模型价内嵌
 *     peak.offPeak / peak.peak 子档,按调用时刻取档。
 * 表格未收录的既有官方价条目(如 GPT-4o / o3 / Claude 4.x / Gemini 2.5 / kimi-k2 /
 * qwen3-max / GLM-5.3 等)继续保留作为补充。本模块零外部依赖(纯数据 + 查询函数)。
 */

export const CNY_PER_USD = 7.2

/** 官方价格来源(供文档引用)。 */
export const CATALOG_SOURCE_URLS = [
  '《主流大模型API官方价格汇总.xlsx》(2026-09,插件内置目录默认价格基准)',
  'DeepSeek 官方: https://api-docs.deepseek.com/zh-cn/quick_start/pricing(2026-08-16 起峰谷计价)',
  'OpenAI 官方: https://platform.openai.com/docs/pricing',
  'Anthropic 官方: https://docs.anthropic.com/en/docs/about-claude/pricing',
  'Google Gemini 官方: https://ai.google.dev/gemini-api/docs/pricing',
  '月之暗面 Kimi 官方: https://platform.moonshot.cn/docs/pricing/chat',
  '通义千问百炼官方: https://help.aliyun.com/zh/model-studio/model-pricing',
  '智谱 Z.AI 官方: https://docs.z.ai/guides/overview/pricing',
  'MiniMax 官方: https://platform.minimaxi.com/docs/llms-full.txt',
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
 * @param {object} spec { cny?, usd?, match?, source?, peak?: { offPeak?: {cny?, usd?}, peak?: {cny?, usd?} } }
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
  // ── DeepSeek(官方 CNY;工作日 9-12 / 14-18 点价格翻倍,基础价 = 谷时价) ───────
  'deepseek-v4-pro': entry({
    cny: { cacheIn: 0.03, cacheOut: 3, output: 6 },
    match: ['deepseek-reasoner', 'DeepSeek-V4-Pro-0813'],
    source: 'DeepSeek 官方(峰谷;基准《主流大模型API官方价格汇总》2026-09)',
    peak: {
      offPeak: { cny: { cacheIn: 0.03, cacheOut: 3, output: 6 } },
      peak: { cny: { cacheIn: 0.06, cacheOut: 6, output: 12 } },
    },
  }),
  'deepseek-v4-flash': entry({
    cny: { cacheIn: 0.02, cacheOut: 1, output: 2 },
    match: ['deepseek-chat', 'deepseek-v3', 'deepseek-v3.2', 'DeepSeek-V4-Flash-0731'],
    source: 'DeepSeek 官方(峰谷;基准《主流大模型API官方价格汇总》2026-09)',
    peak: {
      offPeak: { cny: { cacheIn: 0.02, cacheOut: 1, output: 2 } },
      peak: { cny: { cacheIn: 0.04, cacheOut: 2, output: 4 } },
    },
  }),
  'deepseek-v4-flash-vision-exp': entry({
    cny: { cacheIn: 0.02, cacheOut: 1, output: 2 },
    source: 'DeepSeek 官方(峰谷;基准《主流大模型API官方价格汇总》2026-09)',
    peak: {
      offPeak: { cny: { cacheIn: 0.02, cacheOut: 1, output: 2 } },
      peak: { cny: { cacheIn: 0.04, cacheOut: 2, output: 4 } },
    },
  }),
  'deepseek-v3.1': entry({
    cny: { cacheOut: 2, output: 8 },
    source: 'DeepSeek 官方(峰谷;基准《主流大模型API官方价格汇总》2026-09)',
    peak: {
      offPeak: { cny: { cacheOut: 2, output: 8 } },
      peak: { cny: { cacheOut: 4, output: 16 } },
    },
  }),
  'deepseek-r1': entry({
    cny: { cacheOut: 4, output: 16 },
    source: 'DeepSeek 官方(峰谷;基准《主流大模型API官方价格汇总》2026-09)',
    peak: {
      offPeak: { cny: { cacheOut: 4, output: 16 } },
      peak: { cny: { cacheOut: 8, output: 32 } },
    },
  }),

  // ── OpenAI(官方 USD;缓存输入按官方折扣:GPT-4.1 系列 25%、GPT-5.x 系列 10%) ──
  'gpt-4o': entry({ usd: { cacheIn: 1.25, cacheOut: 2.5, output: 10 }, source: 'OpenAI 官方' }),
  'gpt-4o-mini': entry({ usd: { cacheIn: 0.075, cacheOut: 0.15, output: 0.6 }, source: 'OpenAI 官方' }),
  'gpt-4.1': entry({ usd: { cacheIn: 0.5, cacheOut: 2, output: 8 }, source: 'OpenAI 官方(基准《主流大模型API官方价格汇总》2026-09)' }),
  'gpt-4.1-mini': entry({ usd: { cacheIn: 0.2, cacheOut: 0.8, output: 3.2 }, source: 'OpenAI 官方(基准《主流大模型API官方价格汇总》2026-09)' }),
  'o3': entry({ usd: { cacheIn: 0.5, cacheOut: 2, output: 8 }, match: ['gpt-5-o3'], source: 'OpenAI 官方' }),
  'o4-mini': entry({ usd: { cacheIn: 0.275, cacheOut: 1.1, output: 4.4 }, source: 'OpenAI 官方' }),
  'gpt-5': entry({ usd: { cacheIn: 0.125, cacheOut: 1.25, output: 10 }, match: ['gpt-5.1'], source: 'OpenAI 官方' }),
  'gpt-5-mini': entry({ usd: { cacheIn: 0.025, cacheOut: 0.25, output: 2 }, source: 'OpenAI 官方' }),
  'gpt-5-nano': entry({ usd: { cacheIn: 0.005, cacheOut: 0.05, output: 0.4 }, source: 'OpenAI 官方' }),
  'gpt-5.4': entry({ usd: { cacheIn: 0.25, cacheOut: 2.5, output: 15 }, source: 'OpenAI 官方(基准《主流大模型API官方价格汇总》2026-09)' }),
  'gpt-5.4-nano': entry({ usd: { cacheIn: 0.02, cacheOut: 0.2, output: 1.25 }, source: 'OpenAI 官方(基准《主流大模型API官方价格汇总》2026-09)' }),
  'gpt-5.5': entry({ usd: { cacheIn: 0.3, cacheOut: 3, output: 20 }, source: 'OpenAI 官方' }),
  'gpt-5.6-sol': entry({ usd: { cacheIn: 0.5, cacheOut: 5, output: 30 }, source: 'OpenAI 官方(基准《主流大模型API官方价格汇总》2026-09)' }),

  // ── Anthropic(官方 USD;缓存读取按官方 0.1× 输入) ─────────────────────────────
  'claude-opus-4-7': entry({ usd: { cacheIn: 0.5, cacheOut: 5, output: 25 }, source: 'Anthropic 官方' }),
  'claude-opus-4-6': entry({ usd: { cacheIn: 0.5, cacheOut: 5, output: 25 }, source: 'Anthropic 官方' }),
  'claude-opus-4-5': entry({ usd: { cacheIn: 0.5, cacheOut: 5, output: 25 }, match: ['claude-opus-4-1'], source: 'Anthropic 官方' }),
  'claude-sonnet-4-6': entry({ usd: { cacheIn: 0.3, cacheOut: 3, output: 15 }, source: 'Anthropic 官方(基准《主流大模型API官方价格汇总》2026-09)' }),
  'claude-sonnet-4-5': entry({ usd: { cacheIn: 0.3, cacheOut: 3, output: 15 }, match: ['claude-3-7-sonnet', 'claude-3-5-sonnet'], source: 'Anthropic 官方' }),
  'claude-haiku-4-5': entry({ usd: { cacheIn: 0.1, cacheOut: 1, output: 5 }, match: ['claude-3-5-haiku'], source: 'Anthropic 官方(基准《主流大模型API官方价格汇总》2026-09)' }),
  'claude-fable-5': entry({ usd: { cacheIn: 1, cacheOut: 10, output: 50 }, source: 'Anthropic 官方(基准《主流大模型API官方价格汇总》2026-09)' }),
  'claude-opus-5': entry({ usd: { cacheIn: 0.5, cacheOut: 5, output: 25 }, source: 'Anthropic 官方(基准《主流大模型API官方价格汇总》2026-09)' }),
  'claude-sonnet-5': entry({ usd: { cacheIn: 0.3, cacheOut: 3, output: 10 }, source: 'Anthropic 官方(推广期;基准《主流大模型API官方价格汇总》2026-09)' }),

  // ── Google Gemini(官方 USD;缓存输入按官方 25% 折扣) ─────────────────────────
  'gemini-3-pro-preview': entry({ usd: { cacheIn: 0.4, cacheOut: 4, output: 18 }, source: 'Google 官方' }),
  'gemini-3.1-pro-preview': entry({ usd: { cacheIn: 0.5, cacheOut: 2, output: 12 }, source: 'Google 官方(基准《主流大模型API官方价格汇总》2026-09)' }),
  'gemini-3-flash-preview': entry({ usd: { cacheIn: 0.05, cacheOut: 0.5, output: 3 }, source: 'Google 官方' }),
  'gemini-3.6-flash': entry({ usd: { cacheIn: 0.375, cacheOut: 1.5, output: 7.5 }, source: 'Google 官方(基准《主流大模型API官方价格汇总》2026-09)' }),
  'gemini-3.5-flash': entry({ usd: { cacheIn: 0.375, cacheOut: 1.5, output: 9 }, source: 'Google 官方(基准《主流大模型API官方价格汇总》2026-09)' }),
  'gemini-3.5-flash-lite': entry({ usd: { cacheIn: 0.075, cacheOut: 0.3, output: 2.5 }, source: 'Google 官方(基准《主流大模型API官方价格汇总》2026-09)' }),
  'gemini-2.5-pro': entry({ usd: { cacheIn: 0.31, cacheOut: 1.25, output: 10 }, source: 'Google 官方' }),
  'gemini-2.5-flash': entry({ usd: { cacheIn: 0.075, cacheOut: 0.3, output: 2.5 }, source: 'Google 官方' }),
  'gemini-2.5-flash-lite': entry({ usd: { cacheIn: 0.025, cacheOut: 0.1, output: 0.4 }, source: 'Google 官方(基准《主流大模型API官方价格汇总》2026-09)' }),
  'gemini-1.5-flash': entry({ usd: { cacheOut: 0.075, output: 0.3 }, source: 'Google 官方' }),

  // ── 月之暗面 Kimi(官方 CNY;基准《主流大模型API官方价格汇总》2026-09) ────────
  'kimi-k3': entry({ cny: { cacheIn: 2, cacheOut: 20, output: 100 }, source: 'Kimi 官方(基准《主流大模型API官方价格汇总》2026-09)' }),
  'kimi-k2.6': entry({ cny: { cacheIn: 1.1, cacheOut: 6.5, output: 27 }, source: 'Kimi 官方(基准《主流大模型API官方价格汇总》2026-09)' }),
  'kimi-k2.5': entry({ cny: { cacheIn: 0.7, cacheOut: 4, output: 21 }, source: 'Kimi 官方(基准《主流大模型API官方价格汇总》2026-09)' }),
  'moonshot-v1-128k': entry({ cny: { cacheOut: 10, output: 12 }, source: 'Kimi 官方(¥10~12 / ¥12~30 区间取基础价;基准《主流大模型API官方价格汇总》2026-09)' }),
  'kimi-k2-turbo-preview': entry({ cny: { cacheIn: 2, cacheOut: 8, output: 32 }, source: 'Kimi 官方(特惠价,2026-09)' }),
  'kimi-k2': entry({ cny: { cacheIn: 4, cacheOut: 16, output: 64 }, source: 'Kimi 官方(原价)' }),

  // ── 通义千问 Qwen(官方 CNY,百炼) ────────────────────────────────────────────
  'qwen3.7-max': entry({ cny: { cacheOut: 12, output: 36 }, source: '百炼官方(限时半价 ¥6/¥18,默认按原价;基准《主流大模型API官方价格汇总》2026-09)' }),
  'qwen3.6-flash': entry({ cny: { cacheOut: 0.37, output: 2.9 }, source: '百炼官方(¥0.37~1.2 / ¥2.9~7.2 区间取基础价;基准《主流大模型API官方价格汇总》2026-09)' }),
  'qwen3-max': entry({ cny: { cacheOut: 2.5, output: 10 }, source: '百炼官方' }),
  'qwen3.5-plus': entry({ cny: { cacheOut: 0.8, output: 4.8 }, source: '百炼官方(基准《主流大模型API官方价格汇总》2026-09)' }),
  'qwen3.5-flash': entry({ cny: { cacheOut: 0.2, output: 2 }, source: '百炼官方' }),
  'qwen-max': entry({ cny: { cacheOut: 20, output: 60 }, match: ['qwen-max-latest'], source: '百炼官方' }),
  'qwen-plus': entry({ cny: { cacheOut: 4, output: 12 }, source: '百炼官方' }),
  'qwen-turbo': entry({ cny: { cacheOut: 0.3, output: 0.6 }, source: '百炼官方(基准《主流大模型API官方价格汇总》2026-09)' }),
  'qwen-long': entry({ cny: { cacheOut: 0.5, output: 2 }, source: '百炼官方(基准《主流大模型API官方价格汇总》2026-09)' }),
  'qwen-vl-max': entry({ cny: { cacheOut: 1.5, output: 4.5 }, source: '百炼官方' }),
  'qwen-vl-plus': entry({ cny: { cacheOut: 0.75, output: 2.25 }, source: '百炼官方' }),

  // ── 字节跳动(火山方舟官方 CNY;基准《主流大模型API官方价格汇总》2026-09) ─────
  'seed-2.0-pro': entry({ cny: { cacheOut: 3.2, output: 16 }, source: '火山方舟官方(¥3.2 起,按上下文阶梯计价;基准《主流大模型API官方价格汇总》2026-09)' }),
  'seed-2.0-mini': entry({ cny: { cacheOut: 0.2, output: 2 }, source: '火山方舟官方(基准《主流大模型API官方价格汇总》2026-09)' }),
  'seed-2.0-lite': entry({ cny: { cacheOut: 0.6, output: 3.66 }, source: '火山方舟官方(基准《主流大模型API官方价格汇总》2026-09)' }),
  'seed-1.6-flash': entry({ cny: { cacheOut: 0.075, output: 0.75 }, source: '火山方舟官方(基准《主流大模型API官方价格汇总》2026-09)' }),
  'doubao-lite': entry({ cny: { cacheOut: 0.1, output: 0.1 }, source: '火山方舟官方(基准《主流大模型API官方价格汇总》2026-09)' }),

  // ── 智谱 GLM(表格人民币价 → 官方 CNY;区间取基础价) ─────────────────────────
  'glm-5.3-flash': entry({ usd: { cacheIn: 0.075, cacheOut: 0.15, output: 0.5 }, source: 'Z.AI 官方' }),
  'glm-5.3': entry({ usd: { cacheIn: 0.26, cacheOut: 1.4, output: 4.4 }, source: 'Z.AI 官方' }),
  'glm-5.2': entry({ cny: { cacheOut: 8, output: 28 }, source: 'Z.AI 官方(¥8~10 / ¥28~31.7 区间取基础价;基准《主流大模型API官方价格汇总》2026-09)' }),
  'glm-5.1': entry({ cny: { cacheOut: 6, output: 24 }, source: 'Z.AI 官方(≤32K 价 ¥6/¥24;基准《主流大模型API官方价格汇总》2026-09)' }),
  'glm-5': entry({ usd: { cacheIn: 0.2, cacheOut: 1, output: 3.2 }, source: 'Z.AI 官方' }),
  'glm-4-plus': entry({ cny: { cacheOut: 5, output: 5 }, source: 'Z.AI 官方(基准《主流大模型API官方价格汇总》2026-09)' }),
  'glm-4-air': entry({ cny: { cacheOut: 0.6, output: 0.6 }, source: 'Z.AI 官方(¥0.6~1 / ¥0.6~2 区间取基础价;基准《主流大模型API官方价格汇总》2026-09)' }),
  'glm-4.7-flash': entry({ cny: { cacheIn: 0, cacheOut: 0, output: 0, cacheWrite: 0, reasoning: 0 }, source: 'Z.AI 官方(完全免费;基准《主流大模型API官方价格汇总》2026-09)' }),
  'glm-4.7': entry({ usd: { cacheIn: 0.11, cacheOut: 0.6, output: 2.2 }, source: 'Z.AI 官方' }),
  'glm-4.6': entry({ usd: { cacheIn: 0.11, cacheOut: 0.6, output: 2.2 }, source: 'Z.AI 官方' }),
  'glm-4.5': entry({ usd: { cacheIn: 0.11, cacheOut: 0.6, output: 2.2 }, source: 'Z.AI 官方' }),
  'glm-4.5-x': entry({ usd: { cacheIn: 0.45, cacheOut: 2.2, output: 8.9 }, source: 'Z.AI 官方' }),
  'glm-4.5-air': entry({ usd: { cacheIn: 0.03, cacheOut: 0.2, output: 1.1 }, source: 'Z.AI 官方' }),
  'glm-4.5-airx': entry({ usd: { cacheIn: 0.22, cacheOut: 1.1, output: 4.5 }, source: 'Z.AI 官方' }),

  // ── 百度 ERNIE(官方 CNY;基准《主流大模型API官方价格汇总》2026-09) ───────────
  'ernie-5.1': entry({ cny: { cacheOut: 4, output: 18 }, source: '百度智能云官方(基准《主流大模型API官方价格汇总》2026-09)' }),
  'ernie-4.5-turbo': entry({ cny: { cacheOut: 0.8, output: 3.2 }, source: '百度智能云官方(基准《主流大模型API官方价格汇总》2026-09)' }),
  'ernie-speed': entry({ cny: { cacheIn: 0, cacheOut: 0, output: 0, cacheWrite: 0, reasoning: 0 }, source: '百度智能云官方(完全免费;基准《主流大模型API官方价格汇总》2026-09)' }),
  'ernie-lite': entry({ cny: { cacheIn: 0, cacheOut: 0, output: 0, cacheWrite: 0, reasoning: 0 }, source: '百度智能云官方(完全免费;基准《主流大模型API官方价格汇总》2026-09)' }),
  'ernie-tiny': entry({ cny: { cacheIn: 0, cacheOut: 0, output: 0, cacheWrite: 0, reasoning: 0 }, source: '百度智能云官方(完全免费;基准《主流大模型API官方价格汇总》2026-09)' }),

  // ── 腾讯混元(官方 CNY;基准《主流大模型API官方价格汇总》2026-09) ────────────
  'hunyuan-t1': entry({ cny: { cacheOut: 1, output: 4 }, source: '腾讯云官方(基准《主流大模型API官方价格汇总》2026-09)' }),
  'hunyuan-turbos': entry({ cny: { cacheOut: 0.8, output: 2 }, source: '腾讯云官方(基准《主流大模型API官方价格汇总》2026-09)' }),
  'hunyuan-standard': entry({ cny: { cacheOut: 0.5, output: 1 }, source: '腾讯云官方(基准《主流大模型API官方价格汇总》2026-09)' }),
  'hunyuan-lite': entry({ cny: { cacheIn: 0, cacheOut: 0, output: 0, cacheWrite: 0, reasoning: 0 }, source: '腾讯云官方(完全免费;基准《主流大模型API官方价格汇总》2026-09)' }),

  // ── MiniMax(官方 CNY;基准《主流大模型API官方价格汇总》2026-09) ──────────────
  'MiniMax-M3': entry({ cny: { cacheIn: 0.42, cacheOut: 2.1, output: 8.4, cacheWrite: 2.625 }, source: 'MiniMax 官方(基准《主流大模型API官方价格汇总》2026-09)' }),
  'MiniMax-M2.7': entry({ cny: { cacheIn: 0.42, cacheOut: 2.1, output: 8.4, cacheWrite: 2.625 }, source: 'MiniMax 官方(基准《主流大模型API官方价格汇总》2026-09)' }),
  'MiniMax-M2.7-highspeed': entry({ cny: { cacheIn: 0.42, cacheOut: 2.1, output: 16.8, cacheWrite: 2.625 }, source: 'MiniMax 官方' }),
  'MiniMax-M2.5': entry({ cny: { cacheIn: 0.21, cacheOut: 2.1, output: 8.4, cacheWrite: 2.625 }, source: 'MiniMax 官方' }),
  'MiniMax-M2.5-highspeed': entry({ cny: { cacheIn: 0.21, cacheOut: 2.1, output: 16.8, cacheWrite: 2.625 }, source: 'MiniMax 官方' }),
  'MiniMax-M2': entry({ cny: { cacheIn: 0.21, cacheOut: 2.1, output: 8.4, cacheWrite: 2.625 }, source: 'MiniMax 官方' }),
  'MiniMax-abab6.5s': entry({ cny: { cacheOut: 1, output: 1 }, source: 'MiniMax 官方(基准《主流大模型API官方价格汇总》2026-09)' }),

  // ── 其他国产模型(官方 CNY;基准《主流大模型API官方价格汇总》2026-09) ────────
  'mimo-v2-pro': entry({ cny: { cacheOut: 7, output: 21 }, source: '小米官方(¥7~14 / ¥21~42 区间取基础价;基准《主流大模型API官方价格汇总》2026-09)' }),
  'mimo-v2-flash': entry({ cny: { cacheOut: 0.7, output: 2.1 }, source: '小米官方(基准《主流大模型API官方价格汇总》2026-09)' }),
  'yi-lightning': entry({ cny: { cacheOut: 0.99, output: 0.99 }, source: '零一万物官方(基准《主流大模型API官方价格汇总》2026-09)' }),
  'step-3.7-flash': entry({ cny: { cacheOut: 1.35, output: 8.1 }, source: '阶跃星辰官方(基准《主流大模型API官方价格汇总》2026-09)' }),
  'baichuan-m3-plus': entry({ cny: { cacheOut: 5, output: 9 }, source: '百川智能官方(基准《主流大模型API官方价格汇总》2026-09)' }),
  'spark-4.0-ultra': entry({ cny: { cacheOut: 5, output: 10 }, source: '科大讯飞官方(约价;基准《主流大模型API官方价格汇总》2026-09)' }),
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
