/**
 * 使用分析(0.3.1):从消耗账本计算「使用分析」页所需的数据。
 *
 * 纯计算模块(零外部依赖),只依赖 pricing.js 的价格口径:
 *  - 饼状图数据:跨 Key 按模型聚合的消耗金额(按模型价格/官方价现算,峰谷取档);
 *  - Key 消耗额度:范围内每个 Key 的 tokens / 调用次数 / 金额;
 *  - Token Plan 计费周期:套餐起效时间 startAt + 有效期 periodDays(默认 31 天),
 *    或 resetMode='monthly' 每月 1 号(UTC+0)自动重置;服务端惰性轮换周期,
 *    轮换后的周期边界经 applyConfigPatch 持久化(prevCycle 记录上一轮统计)。
 *    回本 = 当前周期内按模型价计算的消耗金额 ≥ 订阅费;重置 = 把当前周期归档为
 *    上一轮、从重置时刻开始新的周期(只影响 Token Plan 回本计算,不影响消耗总额);
 *  - 性价比:所有模型的 (Key · 模型) 一起排名比较;tokens ÷ 金额 = 1 CNY 能换
 *    多少 tokens。Token Plan 的模型按「订阅费 × 该模型 tokens ÷ 周期总 tokens」
 *    加权平均分配额度(基于 Tokens 消耗摊薄订阅费用),优先用上一轮周期,无上一轮
 *    数据时用当前周期并标注「正在统计」;
 *  - 每日消耗:按本地日期分桶,日期内按模型堆叠;Token Plan 的模型按加权平均
 *    计算金额(订阅费按周期内 tokens 摊薄:当天 tokens × 订阅费 ÷ 周期总 tokens)。
 */

import { priceFor, costOf, tierForEntry, isLegacyEntry } from './pricing.js'

export const DAY_MS = 24 * 60 * 60 * 1000

// ── 品牌归属(性价比按品牌分组比较) ──────────────────────────────────────────

const BRAND_TABLE = {
  'deepseek': 'DeepSeek',
  'deepseek-official': 'DeepSeek',
  'deepseek-oss': 'DeepSeek',
  'scnet': 'DeepSeek',
  'openai': 'OpenAI',
  'anthropic': 'Anthropic',
  'claude': 'Anthropic',
  'google': 'Google',
  'gemini': 'Google',
  'moonshot': 'Kimi',
  'kimi': 'Kimi',
  'qwen': 'Qwen',
  'dashscope': 'Qwen',
  'z-ai': 'Z.AI',
  'zai': 'Z.AI',
  'glm': 'Z.AI',
  'minimax': 'MiniMax',
  'siliconflow': '硅基流动',
  'openrouter': 'OpenRouter',
  'pi-ai': 'Pi',
}

const BRAND_PREFIX = [
  ['deepseek', 'DeepSeek'],
  ['gpt-', 'OpenAI'],
  ['o1', 'OpenAI'],
  ['o3', 'OpenAI'],
  ['o4', 'OpenAI'],
  ['claude', 'Anthropic'],
  ['gemini', 'Google'],
  ['kimi', 'Kimi'],
  ['moonshot', 'Kimi'],
  ['qwen', 'Qwen'],
  ['glm', 'Z.AI'],
  ['minimax', 'MiniMax'],
  ['ernie', '百度'],
  ['doubao', '字节'],
]

/** 推断模型的品牌:优先按 provider 路由,再按模型名前缀,最后回退 provider / 其他。 */
export function brandOf(provider, model) {
  const p = String(provider ?? '').toLowerCase()
  if (BRAND_TABLE[p] !== undefined) return BRAND_TABLE[p]
  const m = String(model ?? '').toLowerCase()
  for (const [prefix, brand] of BRAND_PREFIX) {
    if (m.startsWith(prefix)) return brand
  }
  for (const [prefix, brand] of BRAND_PREFIX) {
    if (m.includes(prefix)) return brand
  }
  return p !== '' ? p : '其他'
}

// ── Token Plan 计费周期 ──────────────────────────────────────────────────────

/** 计算周期结束时间:monthly = 下一个自然月 1 号 00:00(UTC+0);否则 start + 天数。 */
export function planCycleEnd(startMs, resetMode, periodDays) {
  const start = typeof startMs === 'number' && Number.isFinite(startMs) && startMs > 0 ? startMs : Date.now()
  if (resetMode === 'monthly') {
    const d = new Date(start)
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)
  }
  const days = typeof periodDays === 'number' && Number.isFinite(periodDays) && periodDays > 0 ? periodDays : 31
  return start + days * DAY_MS
}

/**
 * 惰性轮换计费周期:当前周期结束(now ≥ cycleEnd)时归档为 prevCycle 并开启新周期。
 * 返回 { plan: 更新后的周期配置, rotated: 是否发生了轮换(需要持久化) }。
 */
export function ensureCycle(plan, now) {
  const p = { ...plan }
  if (!(p.cycleStart > 0)) p.cycleStart = p.startAt > 0 ? p.startAt : now
  if (!(p.cycleEnd > 0)) p.cycleEnd = planCycleEnd(p.cycleStart, p.resetMode, p.periodDays)
  if (now >= p.cycleEnd) {
    p.prevCycle = {
      start: p.cycleStart,
      end: p.cycleEnd,
      fee: p.fee,
      tokens: 0,
      cost: 0,
    }
    p.cycleStart = p.cycleEnd
    p.cycleEnd = planCycleEnd(p.cycleStart, p.resetMode, p.periodDays)
    return { plan: p, rotated: true }
  }
  return { plan: p, rotated: false }
}

/** 本地日期键(YYYY-MM-DD),按运行机器本地时区(DSH 与本插件跑在用户机器上)。 */
export function localDayKey(ts) {
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

function tokensOf(e) {
  return (e.cacheIn ?? 0) + (e.cacheOut ?? 0) + (e.output ?? 0) + (e.cacheWrite ?? 0) + (e.reasoning ?? 0)
}

function listCostOf(e, pricing, peak) {
  const tier = tierForEntry(priceFor(pricing, e.key, e.model), e.at, peak, isLegacyEntry(e))
  return costOf(e, tier)
}

/** 按 Key 计算当前周期 / 上一轮周期的 tokens 与按模型价金额(全量账本)。
 * 返回 { planModelMap, planModelMapPrev }:当前周期与上一轮周期各自按 Key →
 * Map<model, {provider,calls,tokens,cost}> 的模型明细(性价比排名用)。 */
function collectCycleStats(entries, planCtx, today) {
  const planModelMap = new Map() // plan key → Map<model, {provider,calls,tokens,cost}>(当前周期)
  const planModelMapPrev = new Map() // plan key → Map<model, {provider,calls,tokens}>(上一轮)
  const ensureMap = (outer, key) => {
    let mm = outer.get(key)
    if (mm === undefined) {
      mm = new Map()
      outer.set(key, mm)
    }
    return mm
  }
  for (const e of entries) {
    if (e === null || typeof e !== 'object') continue
    const key = typeof e.key === 'string' && e.key !== '' ? e.key : 'unknown'
    const pc = planCtx.get(key)
    if (pc === undefined) continue
    const at = typeof e.at === 'number' ? e.at : 0
    const tok = tokensOf(e)
    const model = typeof e.model === 'string' && e.model !== '' ? e.model : 'unknown'
    const provider = typeof e.provider === 'string' ? e.provider : ''
    if (at >= pc.curStart && at <= Math.min(pc.curEnd, today)) {
      pc.curTokens += tok
      pc.curCost += listCostOf(e, pc.pricing, pc.peak)
      const mm = ensureMap(planModelMap, key)
      let m = mm.get(model)
      if (m === undefined) {
        m = { model, provider, calls: 0, tokens: 0, cost: 0 }
        mm.set(model, m)
      }
      m.provider = m.provider || provider
      m.calls += 1
      m.tokens += tok
      m.cost += listCostOf(e, pc.pricing, pc.peak)
    }
    if (pc.prev !== null && at >= pc.prev.start && at <= pc.prev.end) {
      pc.prevTokens += tok
      pc.prevCost += listCostOf(e, pc.pricing, pc.peak)
      const mm = ensureMap(planModelMapPrev, key)
      let m = mm.get(model)
      if (m === undefined) {
        m = { model, provider, calls: 0, tokens: 0 }
        mm.set(model, m)
      }
      m.provider = m.provider || provider
      m.calls += 1
      m.tokens += tok
    }
  }
  return { planModelMap, planModelMapPrev }
}

/**
 * 计算使用分析数据。
 * @param {object} args
 *   entries    - 账本条目(服务端以 0..now 全量查询,循环统计不受展示范围限制)
 *   pricing    - normalizePricing 后的价格配置
 *   plans      - normalizePlans 后的订阅配置
 *   peak       - 峰谷配置
 *   fromMs/toMs- 展示时间范围(饼图 / Key 额度 / 每日表)
 *   now        - 当前时刻
 * @returns {object} {
 *   fromMs, toMs, currency,
 *   models:  [{ brand, provider, model, calls, cacheIn, cacheOut, output, cacheWrite, reasoning, tokens, cost }],
 *   keys:    [{ key, provider, calls, tokens, cost, models: [{ model, provider, calls, tokens, cost }],
 *               plan: 计划信息|null }],
 *   rankings:  [{ key, model, brand, usingPrev, collecting, tokens, amount, ratio }], // 性价比排名(所有 Key·模型)
 *   daily:   [{ date, ts, tokens, cost, models: [{ model, tokens, cost, planWeighted }] }],
 *   maxDailyCost,
 *   rotations: [{ key, plan }]   // 发生了自动轮换的计划(服务端负责持久化)
 * }
 */
export function computeAnalysis({ entries, pricing, plans, peak, fromMs, toMs, now }) {
  const currency = pricing !== null && typeof pricing === 'object' && pricing.currency === '$' ? '$' : '¥'
  const today = typeof now === 'number' && Number.isFinite(now) ? now : Date.now()
  const from = typeof fromMs === 'number' && Number.isFinite(fromMs) ? fromMs : 0
  const to = typeof toMs === 'number' && Number.isFinite(toMs) ? toMs : today
  const list = (e) => listCostOf(e, pricing, peak)

  // ── 计划周期初始化(惰性轮换) ──────────────────────────────────────────────
  const planCtx = new Map() // key → { plan, rotated, pricing, peak, curStart, curEnd, prev, curTokens, curCost, prevTokens, prevCost }
  const rotations = []
  {
    const src = plans !== null && typeof plans === 'object' ? plans : {}
    for (const key of Object.keys(src)) {
      const p = src[key]
      if (p === null || typeof p !== 'object' || p.enabled !== true) continue
      const res = ensureCycle(p, today)
      planCtx.set(key, {
        plan: res.plan,
        rotated: res.rotated,
        pricing,
        peak,
        curStart: res.plan.cycleStart,
        curEnd: res.plan.cycleEnd,
        prev: res.plan.prevCycle !== null && typeof res.plan.prevCycle === 'object'
          ? { start: res.plan.prevCycle.start, end: res.plan.prevCycle.end, fee: res.plan.prevCycle.fee }
          : null,
        curTokens: 0,
        curCost: 0,
        prevTokens: 0,
        prevCost: 0,
      })
      if (res.rotated) rotations.push({ key, plan: res.plan })
    }
  }

  // 第 1 遍:计划周期统计(全量账本;当前周期 + 上一轮周期各自按模型的明细)
  const { planModelMap, planModelMapPrev } = collectCycleStats(entries, planCtx, today)

  // ── 第 2 遍:展示范围聚合(饼图 / Key 额度 / 每日) ─────────────────────────
  const modelMap = new Map()
  const keyMap = new Map()
  const dailyMap = new Map()

  const ensureModel = (map, model) => {
    let m = map.get(model)
    if (m === undefined) {
      m = { model, provider: '', calls: 0, cacheIn: 0, cacheOut: 0, output: 0, cacheWrite: 0, reasoning: 0, tokens: 0, cost: 0 }
      map.set(model, m)
    }
    return m
  }

  for (const e of entries) {
    if (e === null || typeof e !== 'object') continue
    const at = typeof e.at === 'number' ? e.at : 0
    if (at < from || at > to) continue
    const model = typeof e.model === 'string' && e.model !== '' ? e.model : 'unknown'
    const key = typeof e.key === 'string' && e.key !== '' ? e.key : 'unknown'
    const tok = tokensOf(e)
    const cost = list(e)
    const pc = planCtx.get(key)
    const dayKey = localDayKey(at)

    {
      const gm = ensureModel(modelMap, model)
      gm.provider = gm.provider || (typeof e.provider === 'string' ? e.provider : '')
      gm.calls += 1
      gm.cacheIn += e.cacheIn ?? 0
      gm.cacheOut += e.cacheOut ?? 0
      gm.output += e.output ?? 0
      gm.cacheWrite += e.cacheWrite ?? 0
      gm.reasoning += e.reasoning ?? 0
      gm.tokens += tok
      gm.cost += cost
    }
    {
      let row = keyMap.get(key)
      if (row === undefined) {
        row = { key, provider: typeof e.provider === 'string' ? e.provider : '', calls: 0, tokens: 0, cost: 0, models: new Map() }
        keyMap.set(key, row)
      }
      row.provider = row.provider || (typeof e.provider === 'string' ? e.provider : '')
      row.calls += 1
      row.tokens += tok
      row.cost += cost
      const km = ensureModel(row.models, model)
      km.provider = km.provider || row.provider
      km.calls += 1
      km.tokens += tok
      km.cost += cost
    }
    {
      let day = dailyMap.get(dayKey)
      if (day === undefined) {
        day = { date: dayKey, ts: new Date(at).setHours(0, 0, 0, 0), tokens: 0, cost: 0, models: new Map() }
        dailyMap.set(dayKey, day)
      }
      let m = day.models.get(model)
      if (m === undefined) {
        m = { model, tokens: 0, cost: 0, planWeighted: false }
        day.models.set(model, m)
      }
      // Token Plan 的模型按加权平均摊薄金额:当天 tokens × 订阅费 ÷ 周期总 tokens
      let dailyCost = cost
      let weighted = false
      if (pc !== undefined) {
        if (at >= pc.curStart && at <= Math.min(pc.curEnd, today)) {
          const rate = pc.curTokens > 0 ? pc.plan.fee / pc.curTokens : 0
          dailyCost = tok * rate
          weighted = true
        } else if (pc.prev !== null && at >= pc.prev.start && at <= pc.prev.end) {
          const rate = pc.prevTokens > 0 ? pc.prev.fee / pc.prevTokens : 0
          dailyCost = tok * rate
          weighted = true
        }
      }
      m.tokens += tok
      m.cost += dailyCost
      if (weighted) m.planWeighted = true
      day.tokens += tok
      day.cost += dailyCost
    }
  }

  // ── 输出组装 ───────────────────────────────────────────────────────────────
  const models = [...modelMap.values()]
    .map((m) => ({ ...m, brand: brandOf(m.provider, m.model) }))
    .sort((a, b) => b.cost - a.cost || b.tokens - a.tokens)

  const buildPlanInfo = (pc) => {
    const p = pc.plan
    return {
      enabled: true,
      fee: p.fee,
      credits: p.credits,
      startAt: p.startAt,
      periodDays: p.periodDays,
      resetMode: p.resetMode,
      cycleStart: pc.curStart,
      cycleEnd: pc.curEnd,
      cycleTokens: pc.curTokens,
      cycleCost: pc.curCost,
      brokenEven: p.fee > 0 && pc.curCost >= p.fee,
      tokensPerCredit: p.credits > 0 ? (pc.curTokens / p.credits) : null,
      effectiveRate: pc.curTokens > 0 ? (p.fee / pc.curTokens) : 0,
      prevCycle: pc.prev !== null
        ? { start: pc.prev.start, end: pc.prev.end, fee: pc.prev.fee, tokens: pc.prevTokens, cost: pc.prevCost }
        : null,
    }
  }

  // 展示范围的每个 Key 的模型明细(性价比排名回退用;计划 Key 的 models 会被
  // 替换为周期口径,展示范围明细必须单独保留)
  const displayModelMap = new Map()
  for (const [key, row] of keyMap) displayModelMap.set(key, [...row.models.values()])
  const keys = [...keyMap.values()].map((row) => {
    const pc = planCtx.get(row.key)
    let plan = pc !== undefined ? buildPlanInfo(pc) : null
    // 计划 Key 的按模型金额用当前周期口径(与回本一致);非计划 Key 用展示范围口径
    let cardModels = [...row.models.values()].sort((a, b) => b.cost - a.cost)
    if (pc !== undefined) {
      const pm = planModelMap.get(row.key)
      cardModels = pm ? [...pm.values()].sort((a, b) => b.cost - a.cost) : []
    }
    return { key: row.key, provider: row.provider, calls: row.calls, tokens: row.tokens, cost: row.cost, models: cardModels, plan }
  })
  // 展示范围内没有消耗的 Token Plan Key 也要出现在回本卡片里
  {
    const seen = new Set(keys.map((k) => k.key))
    for (const [key, pc] of planCtx) {
      if (seen.has(key)) continue
      const pm = planModelMap.get(key)
      const cardModels = pm ? [...pm.values()].sort((a, b) => b.cost - a.cost) : []
      keys.push({ key, provider: '', calls: 0, tokens: 0, cost: 0, models: cardModels, plan: buildPlanInfo(pc) })
    }
  }

  // 性价比排名:所有模型的 (Key · 模型) 一起比较(排名名 = key · model)。
  // Token Plan 的模型按「订阅费 × 该模型 tokens ÷ 周期总 tokens」加权平均分配额度
  // (基于 Tokens 消耗摊薄订阅费用):优先用上一轮计费周期,无上一轮数据时用当前周期
  // 并标注「正在统计」;计划尚无周期数据(如新配置未设起效时间)时回退到展示范围
  // 的消耗按同一加权规则分配,保证所有模型都进入比较。
  const rankings = []
  for (const row of keys) {
    const pc = planCtx.get(row.key)
    if (row.plan === null || pc === undefined) {
      // 非计划 Key:展示范围内按模型价计算的金额
      for (const m of row.models) {
        const tokens = m.tokens
        if (!(tokens > 0)) continue
        const amount = m.cost || 0
        rankings.push({
          key: row.key,
          model: m.model,
          brand: brandOf(row.provider, m.model),
          usingPrev: false,
          collecting: false,
          tokens,
          amount,
          ratio: amount > 0 ? tokens / amount : 0,
        })
      }
      continue
    }
    // 计划 Key:上一轮优先;无上一轮用当前周期(collecting)
    const usingPrev = pc.prev !== null && pc.prevTokens > 0
    let totalTokens = usingPrev ? pc.prevTokens : pc.curTokens
    let fee = usingPrev ? (pc.prev.fee > 0 ? pc.prev.fee : row.plan.fee) : (row.plan.fee > 0 ? row.plan.fee : pc.curCost)
    let collecting = !usingPrev
    let src = usingPrev ? planModelMapPrev.get(row.key) : planModelMap.get(row.key)
    if ((src === undefined || src === null) || !(totalTokens > 0)) {
      // 计划尚无周期数据:回退展示范围消耗,按同一加权规则分配订阅费,
      // 保证该 Key 的模型仍然进入排名
      src = new Map((displayModelMap.get(row.key) || []).map((m) => [m.model, m]))
      totalTokens = row.tokens
      collecting = true
    }
    for (const m of src.values()) {
      const tokens = m.tokens
      if (!(tokens > 0)) continue
      const amount = totalTokens > 0 ? fee * tokens / totalTokens : 0
      rankings.push({
        key: row.key,
        model: m.model,
        brand: brandOf(row.provider, m.model),
        usingPrev,
        collecting,
        tokens,
        amount,
        ratio: amount > 0 ? tokens / amount : 0,
      })
    }
  }
  rankings.sort((a, b) => (b.ratio - a.ratio) || (b.tokens - a.tokens))

  const daily = [...dailyMap.values()]
    .map((d) => ({ date: d.date, ts: d.ts, tokens: d.tokens, cost: d.cost, models: [...d.models.values()].sort((a, b) => b.cost - a.cost) }))
    .sort((a, b) => b.ts - a.ts)
  const maxDailyCost = daily.reduce((mx, d) => (d.cost > mx ? d.cost : mx), 0)

  return { fromMs: from, toMs: to, currency, models, keys, rankings, daily, maxDailyCost, rotations }
}
