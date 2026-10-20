/**
 * 使用分析(0.3.1):从消耗账本计算「使用分析」页所需的数据。
 *
 * 纯计算模块(零外部依赖),只依赖 pricing.js 的价格口径:
 *  - 饼状图数据:按 **(Key · 模型)** 聚合的消耗金额(按模型价格/官方价现算,峰谷
 *    取档;0.3.12 起不同 Key 的同名模型各成一条,不再跨 Key 合并);
 *  - Key 消耗额度:范围内每个 Key 的 tokens / 调用次数 / 金额;
 *  - Token Plan 计费周期:套餐起效时间 startAt + 有效期 periodDays(默认 31 天),
 *    或 resetMode='monthly' 每月 1 号(UTC+0)自动重置;服务端惰性轮换周期,
 *    轮换后的周期边界经 applyConfigPatch 持久化(prevCycle 只记上一轮窗口)。
 *    回本 = 当前周期内按模型价计算的消耗金额 ≥ 订阅费;重置 = 把当前周期归档为
 *    上一轮、从重置时刻开始新的周期(只影响 Token Plan 回本计算,不影响消耗总额);
 *  - 0.3.4 周期身份 TID:每个计费周期有唯一 TID(插件内部身份,不向用户显示)。
 *    当前周期数据(tid)参与回本 / 性价比计算;被重置 / 自动轮换的旧 TID 归档为
 *    固定窗口,经「历史」按钮查阅。**0.3.12:归档只存窗口 + 订阅费,tokens/cost
 *    每次读取都按账本 × 当前价格现算——改价后历史周期金额同步变化,不复用旧金额**;
 *  - 429/402 提示重置(0.3.4):plan.pending = { at } 时,at 之后的消耗进入临时
 *    账本(不计入当前周期回本 / 性价比,每日表按待确认展示);用户回应后:
 *    续费(重置)→ 临时账本并入归档窗口;未续费 → 临时账本并回当前周期;
 *  - 性价比:所有 **(Key · 模型)** 条目一起排名比较;tokens ÷ 金额 = 1 CNY 能换
 *    多少 tokens。0.3.7 修复 Token Plan 的 Provider ID:加权金额改按「各模型按
 *    模型价的消耗金额占比」摊薄订阅费(旧版按 tokens 占比摊薄,同计划所有模型
 *    性价比恒同、失去区分度),ratio = 该模型调用量 ÷ 加权后的使用金额,只统计
 *    当前生效 TID(当前周期),无数据时标注「正在统计」;
 *  - 每日消耗:按本地日期分桶,日期内按 **(Key · 模型)** 堆叠;Token Plan 的模型按
 *    加权平均计算金额,加权平均严格限定在同一 TID 内(各 TID 用各自的
 *    「订阅费 ÷ 该 TID 周期总 tokens」费率),同一天同一 Provider 出现在不同
 *    TID 时,当天各 TID 数据相加合并为同一 Provider 显示;
 *  - 0.3.12 消耗身份:聚合 Key 一律用**账本自己的身份**(identityOfEntry =
 *    调用路由 / Provider ID),不再按「模型归属目录」把条目改判到别的 Key——
 *    否则不同 Key 的同名模型会被并成一条(0.3.7 的目录归属只保留在品牌显示上);
 *  - 0.3.7 模型品牌不再绑定厂商:Provider ID 是用户自己设置的,品牌显示一律读
 *    本地数据 = 目录里归属 Provider 的显示名(不按模型名前缀硬编码厂商)。
 */

import { priceFor, costOf, callCostOf, tierForEntry, isLegacyEntry } from './pricing.js'
import { lookupCatalogModel, catalogPriceFor, catalogPeakFor } from './pricing-catalog.js'
import { providerOfModel, displayNameOf, identityOfEntry } from './providers.js'

export const DAY_MS = 24 * 60 * 60 * 1000

/** 生成一个周期唯一 TID(插件内部身份,不向用户显示)。 */
export function genTid() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

// ── 品牌归属(0.3.7:读本地数据,不绑定模型名与厂商)─────────────────────────

/**
 * 模型的品牌显示(0.3.7 修复):删除内置「模型名前缀 → 厂商」表——Provider ID
 * 是用户自己设置的,归属一律读本地数据(Provider 目录 = 全局模型设置 + 账本观测):
 * 目录声明了该模型的 Provider(其显示名)→ 运行时路由(其显示名)→「其他」。
 */
function brandLabelOf(providers, provider, model) {
  const owner = providerOfModel(providers, model, provider)
  const pid = owner !== null && owner !== '' ? owner : (typeof provider === 'string' ? provider.trim() : '')
  return pid === '' ? '其他' : displayNameOf(pid, providers)
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
 * 套餐更改「下次续费生效」:开启新周期时把待生效订阅信息提升为当前订阅信息。
 * (0.3.14:自动续费与手动续费都走这里;重置当前周期不提升。)
 */
export function applyNextPlan(plan) {
  if (plan === null || typeof plan !== 'object') return plan
  const np = plan.nextPlan
  if (np === null || typeof np !== 'object') return plan
  return {
    ...plan,
    fee: np.fee,
    credits: np.credits,
    periodDays: np.periodDays,
    resetMode: np.resetMode,
    nextPlan: null,
  }
}

/**
 * 惰性轮换计费周期(0.3.14 改):不再是「到期一律自动开新周期」。
 *  - autoRenew=true(连续订阅):到期按当前订阅信息自动开启下一轮(套餐更改的
 *    nextPlan 在每次续费时生效);
 *  - autoRenew=false(非连续):到期只保留窗口,**不开新周期**——只有 (a) 手动续费
 *    (service.renewPlanCycle)或 (b) 过期后仍检测到该 Key 的有效调用(latestAt >
 *    cycleEnd)时才开新周期,避免用户没续费却凭空多出订阅费。
 * 循环上限 400 轮:防止 startAt 极旧 + 每月重置时一次读取消耗过长时间
 * # ponytail: 一次补齐所有过期周期,若用户只要「只开一轮」,把 while 换成 if。
 * @param {number} [latestAt] 该 Key 最晚一次有效调用的时刻(全量账本)
 * @returns {{ plan: object, changed: boolean }}
 */
export function ensureCycle(plan, now, latestAt) {
  let p = { ...plan }
  let changed = false
  if (!(typeof p.tid === 'string' && p.tid !== '')) {
    p.tid = genTid()
    changed = true
  }
  if (!(p.cycleStart > 0)) p.cycleStart = p.startAt > 0 ? p.startAt : now
  if (!(p.cycleEnd > 0)) p.cycleEnd = planCycleEnd(p.cycleStart, p.resetMode, p.periodDays)
  const at = typeof latestAt === 'number' && Number.isFinite(latestAt) ? latestAt : 0
  const target = Math.max(now, at)
  // 连续订阅:到期就往目标时间补齐;非连续:只有「过期后仍有调用」才补
  for (let guard = 0; guard < 400 && p.cycleEnd <= target; guard += 1) {
    if (p.autoRenew !== true && !(at > p.cycleEnd)) break
    const cycles = p.cycles !== null && typeof p.cycles === 'object' && !Array.isArray(p.cycles) ? { ...p.cycles } : {}
    // 0.3.12:归档只保留「周期窗口 + 订阅费」;tokens/cost 每次读取按账本 × 当前
    // 价格现算——账本不可变,但价格可变,金额必须实时。
    if (typeof p.tid === 'string' && p.tid !== '' && cycles[p.tid] === undefined) {
      cycles[p.tid] = { start: p.cycleStart, end: p.cycleEnd, fee: p.fee }
    }
    p.cycles = cycles
    p.prevCycle = {
      start: p.cycleStart,
      end: p.cycleEnd,
      fee: p.fee,
    }
    // 新周期用当前订阅信息;若套餐更改选了「下次续费生效」则先提升
    p = applyNextPlan(p)
    p.cycleStart = p.cycleEnd
    p.cycleEnd = planCycleEnd(p.cycleStart, p.resetMode, p.periodDays)
    p.tid = genTid()
    changed = true
  }
  return { plan: p, changed }
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

function listPriceOf(e, pricing, peak) {
  // 0.3.14:身份在模块内归一(等价于旧服务层预先改写 key 后再解析价格)——Provider
  // 专属价 / 专属倍率 / 主体峰谷规则都按 Provider ID 取档,旧账目的 env 标签不参与。
  return tierForEntry(priceFor(pricing, identityOfEntry(e), e.model), e.at, peak, isLegacyEntry(e))
}
function listCostOf(e, pricing, peak) {
  return costOf(e, listPriceOf(e, pricing, peak))
}
function officialCostOf(e, currency, peakCfg) {
  const entry = lookupCatalogModel(e.model ?? '')
  const price = catalogPriceFor(entry, currency)
  if (price === null) return 0
  const peak = catalogPeakFor(entry, currency)
  const tier = peak ? tierForEntry({ ...price, peak }, e.at, peakCfg, isLegacyEntry(e)) : price
  return costOf(e, tier)
}

/**
 * 一次调用的三种金额(0.3.14):
 *  - token   : 按量计价金额(始终计算;按次付费模型也保留,用于判断本次调用是否划算);
 *  - call    : 按次计价金额(仅 billing='perCall' 时 > 0);
 *  - payable : 该次调用真正要付的钱 = 按次模型付按次价、其余付按量价。
 */
function listPayableOf(e, pricing, peak) {
  const tier = listPriceOf(e, pricing, peak)
  const token = costOf(e, tier)
  const call = callCostOf(tier)
  const perCall = tier.billing === 'perCall'
  return { token, call, payable: perCall ? call : token, perCall }
}

/** 按 Key 计算订阅窗口的 tokens 与按模型价金额(全量账本)。
 * 返回 { planModelTotalMap, cycleStats }:
 *  - planModelTotalMap:订阅 Key 的**累计口径**(当前周期 + 上一轮 + 全部历史窗口)
 *    → Map<model,{provider,calls,tokens,cost}>(回本卡片按模型明细 / 性价比排名,
 *    0.3.14 起按累计金额/累计 tokens 计算,不再只看本周期);
 *  - cycleStats:key → Map<tid, {tokens, cost}>(冻结历史周期的账本派生统计)。
 * 0.3.4:plan.pending 未回应时,at ≥ pending.at 的消耗进入临时账本
 * (pendingTokens/pendingCost),不计入当前/上一轮/历史/累计周期统计。 */
function collectCycleStats(entries, planCtx, today, keyOf) {
  const planModelTotalMap = new Map() // plan key → Map<model, {...}>(累计口径)
  const cycleStats = new Map() // plan key → Map<tid, {tokens, cost}>(冻结历史周期)
  const addModel = (key, model, provider, tok, cost) => {
    let mm = planModelTotalMap.get(key)
    if (mm === undefined) {
      mm = new Map()
      planModelTotalMap.set(key, mm)
    }
    let m = mm.get(model)
    if (m === undefined) {
      m = { model, provider, calls: 0, tokens: 0, cost: 0 }
      mm.set(model, m)
    }
    m.provider = m.provider || provider
    m.calls += 1
    m.tokens += tok
    m.cost += cost
  }
  for (const e of entries) {
    if (e === null || typeof e !== 'object') continue
    const key = keyOf(e)
    const pc = planCtx.get(key)
    if (pc === undefined) continue
    const at = typeof e.at === 'number' ? e.at : 0
    const tok = tokensOf(e)
    const model = typeof e.model === 'string' && e.model !== '' ? e.model : 'unknown'
    const provider = typeof e.provider === 'string' ? e.provider : ''
    // 0.3.14 性能:同一份价格配置下,该条目的按量金额在「待确认 / 当前周期 /
    // 上一轮 / 历史周期」四处口径完全相同 → 只解析一次。
    const cost = listCostOf(e, pc.pricing, pc.peak)
    // 429/402 待确认:at ≥ pending.at 的消耗进入临时账本,不进任何周期统计
    if (pc.pending !== null && at >= pc.pending.at) {
      pc.pendingTokens += tok
      pc.pendingCost += cost
      continue
    }
    const inCur = at >= pc.curStart && at <= Math.min(pc.curEnd, today)
    if (inCur) {
      pc.curTokens += tok
      pc.curCost += cost
    }
    const inPrev = pc.prev !== null && at >= pc.prev.start && at <= pc.prev.end
    if (inPrev) {
      pc.prevTokens += tok
      pc.prevCost += cost
    }
    // 冻结历史周期(0.3.4):命中窗口即累加,供「历史」按钮与每日表同 TID 加权
    let inArchive = false
    if (pc.cyclesWindows !== null) {
      for (const c of pc.cyclesWindows) {
        if (at >= c.start && at <= c.end) {
          let cs = cycleStats.get(key)
          if (cs === undefined) {
            cs = new Map()
            cycleStats.set(key, cs)
          }
          let s = cs.get(c.tid)
          if (s === undefined) {
            s = { tokens: 0, cost: 0 }
            cs.set(c.tid, s)
          }
          s.tokens += tok
          s.cost += cost
          inArchive = true
          break
        }
      }
    }
    // 累计口径:同一调用的订阅窗口只算一次(当前/上一轮/历史窗口互不重复计数)
    if (inCur || inPrev || inArchive) {
      pc.cumTokens += tok
      pc.cumCost += cost
      addModel(key, model, provider, tok, cost)
    }
  }
  return { planModelTotalMap, cycleStats }
}

/**
 * 计算使用分析数据。
 * @param {object} args
 *   entries    - 账本条目(服务端以 0..now 全量查询,循环统计不受展示范围限制);
 *                条目身份由 `identityOfEntry` 归一(Provider ID 优先,缺省回退 key 标签)
 *   pricing    - normalizePricing 后的价格配置
 *   plans      - normalizePlans 后的订阅配置
 *   peak       - 峰谷配置
 *   providers  - Provider 目录(只用于品牌显示;0.3.12 起不再改判条目的 Key)
 *   fromMs/toMs- 展示时间范围(饼图 / Key 额度 / 每日表)
 *   now        - 当前时刻
 * @returns {object} {
 *   fromMs, toMs, currency,
 *   models:  [{ key, brand, provider, model, calls, cacheIn, cacheOut, output, cacheWrite, reasoning, tokens, cost }],
 *            // 0.3.12:一条 = 一个 (Key · 模型),不同 Key 的同名模型各成一条
 *   keys:    [{ key, provider, calls, tokens, cost, models: [{ model, provider, calls, tokens, cost }],
 *               plan: 计划信息|null }],
 *           // 0.3.14 plan 增加:autoRenew / expired / nextPlan / mergedKeys /
 *           // cumulativeTokens / cumulativeCost / cumulativeFee(累计口径:当前周期
 *           // + 上一轮 + 全部历史窗口,tokens 与订阅费都累计)
 *   rankings:  [{ key, model, brand, usingPrev, collecting, tokens, amount, ratio }], // 性价比排名(所有 Key·模型)
 *           // 0.3.14:Token Plan Key 用累计口径(tokens ÷ 累计订阅费),usingPrev 恒 false
 *   daily:   [{ date, ts, tokens, cost, models: [{ key, model, tokens, cost, planWeighted }] }],
 *   maxDailyCost,
 *   rotations: [{ key, plan }]   // 发生了自动轮换/自动续期的计划(服务端负责持久化)
 * }
 */
export function computeAnalysis({ entries, pricing, plans, peak, fromMs, toMs, now, providers }) {
  const currency = pricing !== null && typeof pricing === 'object' && pricing.currency === '$' ? '$' : '¥'
  const today = typeof now === 'number' && Number.isFinite(now) ? now : Date.now()
  const from = typeof fromMs === 'number' && Number.isFinite(fromMs) ? fromMs : 0
  const to = typeof toMs === 'number' && Number.isFinite(toMs) ? toMs : today

  // 0.3.12:消耗身份一律用**账本自己的 Key**(= 调用路由 / Provider ID),不再按
  // 「模型归属目录」把条目改判到别的 Key——那会把不同 Key 的同名模型并成一条。
  // 品牌显示仍按目录判定(brandLabelOf,只影响展示文案)。
  const providerList = Array.isArray(providers) ? providers : []
  const ownedEntries = entries
  const planSrc = plans !== null && typeof plans === 'object' ? plans : {}

  // 0.3.14 订阅数据合并:目标 Key 的 plan.mergedKeys 里的来源 Key,其消耗/历史全部
  // 并入目标 Key(Key 重置后同一个 Token Plan 换了 Provider ID 的场景)。
  const mergeOf = new Map()
  for (const key of Object.keys(planSrc)) {
    const p = planSrc[key]
    if (p === null || typeof p !== 'object' || p.enabled !== true || !Array.isArray(p.mergedKeys)) continue
    for (const src of p.mergedKeys) {
      if (typeof src === 'string' && src !== '' && src !== key && !mergeOf.has(src)) mergeOf.set(src, key)
    }
  }
  const keyOf = mergeOf.size > 0
    ? (e) => {
      const id = identityOfEntry(e)
      const merged = mergeOf.get(id)
      return merged === undefined ? id : merged
    }
    : identityOfEntry

  // 待确认(402/429)起始时刻:该时刻之后的消耗是临时账本,不能当作「有效调用」
  // 触发自动续期/自动开新周期。
  const pendingAtOf = new Map()
  for (const key of Object.keys(planSrc)) {
    const p = planSrc[key]
    if (p === null || typeof p !== 'object' || p.enabled !== true || mergeOf.has(key)) continue
    const pend = p.pending !== null && typeof p.pending === 'object' ? Number(p.pending.at) : 0
    if (pend > 0) pendingAtOf.set(key, pend)
  }

  // 每个 Key 最晚一次有效调用(用于「非连续订阅过期后检测到调用 → 自动开新周期」)
  const latestAtOf = new Map()
  for (const e of ownedEntries) {
    if (e === null || typeof e !== 'object') continue
    const at = typeof e.at === 'number' ? e.at : 0
    const k = keyOf(e)
    const pend = pendingAtOf.get(k)
    if (pend !== undefined && at >= pend) continue
    if (at > (latestAtOf.get(k) ?? 0)) latestAtOf.set(k, at)
  }

  // ── 计划周期初始化(惰性轮换 + TID 分配) ────────────────────────────────
  const planCtx = new Map() // key → { plan, changed, pricing, peak, curStart, curEnd, prev, curTokens, curCost, prevTokens, prevCost, pendingTokens, pendingCost, pending, cyclesWindows, cumTokens, cumCost, cumFee }
  const rotations = []
  {
    const src = planSrc
    for (const key of Object.keys(src)) {
      const p = src[key]
      if (p === null || typeof p !== 'object' || p.enabled !== true) continue
      // 已合并掉的来源 Key:其 plan 不再单独生效(数据并入目标 Key)
      if (mergeOf.has(key)) continue
      const res = ensureCycle(p, today, latestAtOf.get(key) ?? 0)
      // 冻结历史周期窗口(0.3.4):cycles 里所有已归档 TID 的固定窗口
      const cyclesWindows = []
      {
        const cyc = res.plan.cycles !== null && typeof res.plan.cycles === 'object' && !Array.isArray(res.plan.cycles)
          ? res.plan.cycles
          : {}
        for (const tid of Object.keys(cyc)) {
          const c = cyc[tid]
          if (c === null || typeof c !== 'object' || !(c.start > 0) || !(c.end > 0)) continue
          cyclesWindows.push({ tid, start: c.start, end: c.end, fee: c.fee > 0 ? c.fee : res.plan.fee })
        }
      }
      const pend = res.plan.pending !== null && typeof res.plan.pending === 'object' && res.plan.pending.at > 0
        ? { at: res.plan.pending.at }
        : null
      const prev = res.plan.prevCycle !== null && typeof res.plan.prevCycle === 'object'
        ? { start: res.plan.prevCycle.start, end: res.plan.prevCycle.end, fee: res.plan.prevCycle.fee }
        : null
      // 累计订阅费:当前周期费 + 全部历史周期费 + 上一轮(若未被 cycles 归档覆盖)
      let cumFee = res.plan.fee > 0 ? res.plan.fee : 0
      for (const c of cyclesWindows) cumFee += c.fee > 0 ? c.fee : 0
      if (prev !== null && !cyclesWindows.some((c) => c.start === prev.start && c.end === prev.end)) {
        cumFee += prev.fee > 0 ? prev.fee : 0
      }
      planCtx.set(key, {
        plan: res.plan,
        changed: res.changed,
        pricing,
        peak,
        curStart: res.plan.cycleStart,
        curEnd: res.plan.cycleEnd,
        prev,
        curTokens: 0,
        curCost: 0,
        prevTokens: 0,
        prevCost: 0,
        pendingTokens: 0,
        pendingCost: 0,
        pending: pend,
        cyclesWindows: cyclesWindows.length > 0 ? cyclesWindows : null,
        cumTokens: 0,
        cumCost: 0,
        cumFee,
      })
      if (res.changed) rotations.push({ key, plan: res.plan })
    }
  }

  // 第 1 遍:计划周期统计(全量账本;当前周期 + 上一轮 + 冻结历史 + 临时账本 + 累计)
  const { planModelTotalMap, cycleStats } = collectCycleStats(ownedEntries, planCtx, today, keyOf)

  // ── 第 2 遍:展示范围聚合(饼图 / Key 额度 / 每日) ─────────────────────────
  const modelMap = new Map()
  const keyMap = new Map()
  const dailyMap = new Map()

  // 0.3.12:聚合身份 = (Key · 模型) —— 不同 Key 的同名模型、同一 Key 的不同模型
  // 一律各自成条,不混在一起算。
  const ensureModel = (map, key, model) => {
    const gk = key + '\u0000' + model
    let m = map.get(gk)
    if (m === undefined) {
      m = { key, model, provider: '', calls: 0, cacheIn: 0, cacheOut: 0, output: 0, cacheWrite: 0, reasoning: 0, tokens: 0, cost: 0, officialCost: 0, callCost: 0, payable: 0, perCall: false, actualCost: 0 }
      map.set(gk, m)
    }
    return m
  }

  for (const e of ownedEntries) {
    if (e === null || typeof e !== 'object') continue
    const at = typeof e.at === 'number' ? e.at : 0
    if (at < from || at > to) continue
    const model = typeof e.model === 'string' && e.model !== '' ? e.model : 'unknown'
    // 0.3.14:身份由模块自己归一(Provider ID 优先,缺省回退 key 标签),服务层
    // 不再需要把每条账目复制一遍再改 key;合并订阅的来源 Key 在这里并入目标 Key。
    const key = keyOf(e)
    const tok = tokensOf(e)
    const pay = listPayableOf(e, pricing, peak)
    const cost = pay.token
    const callCost = pay.call
    const pc = planCtx.get(key)
    const dayKey = localDayKey(at)

    {
      const gm = ensureModel(modelMap, key, model)
      gm.provider = gm.provider || (typeof e.provider === 'string' ? e.provider : '')
      gm.calls += 1
      gm.cacheIn += e.cacheIn ?? 0
      gm.cacheOut += e.cacheOut ?? 0
      gm.output += e.output ?? 0
      gm.cacheWrite += e.cacheWrite ?? 0
      gm.reasoning += e.reasoning ?? 0
      gm.tokens += tok
      gm.cost += cost
      gm.officialCost += officialCostOf(e, currency, peak)
      gm.callCost += callCost
      gm.payable += pay.payable
      gm.perCall = gm.perCall || pay.perCall
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
      const km = ensureModel(row.models, key, model)
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
      const dayModelKey = key + '\u0000' + model
      let m = day.models.get(dayModelKey)
      if (m === undefined) {
        m = { key, model, tokens: 0, cost: 0, planWeighted: false, pending: false }
        day.models.set(dayModelKey, m)
      }
      // 0.3.4 Token Plan 加权平均严格限定同一 TID:各 TID 用各自的
      // 「订阅费 ÷ 该 TID 周期总 tokens」费率;429/402 待确认的消耗(临时账本)
      // 不进任何 TID,按模型价原值展示并标 pending;同一天多 TID 自然相加合并。
      let dailyCost = cost
      let weighted = false
      if (pc !== undefined) {
        if (pc.pending !== null && at >= pc.pending.at) {
          // 临时账本:不归属任何 TID,按模型价原值,标记待确认
          m.pending = true
        } else if (at >= pc.curStart && at <= Math.min(pc.curEnd, today)) {
          const rate = pc.curTokens > 0 ? pc.plan.fee / pc.curTokens : 0
          dailyCost = tok * rate
          weighted = true
        } else if (pc.prev !== null && at >= pc.prev.start && at <= pc.prev.end) {
          const rate = pc.prevTokens > 0 ? pc.prev.fee / pc.prevTokens : 0
          dailyCost = tok * rate
          weighted = true
        } else if (pc.cyclesWindows !== null) {
          // 冻结历史周期:该 TID 的费率 = 周期订阅费 ÷ 该 TID 周期总 tokens
          for (const c of pc.cyclesWindows) {
            if (at >= c.start && at <= c.end) {
              const cs = cycleStats.get(key)
              const s = cs !== undefined ? cs.get(c.tid) : undefined
              const total = s !== undefined ? s.tokens : 0
              const rate = total > 0 ? c.fee / total : 0
              dailyCost = tok * rate
              weighted = true
              break
            }
          }
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
    .map((m) => ({ ...m, brand: brandLabelOf(providerList, m.provider, m.model) }))
    .sort((a, b) => b.cost - a.cost || b.tokens - a.tokens)
  // 实际金额(0.3.14)= 订阅 Key 只算该周期订阅费(套餐内消耗已含在订阅费里,不再
  // 按量计价);非订阅 Key = 应付费用(按量价或按次价)。订阅费按模型应付费用占比
  // 分摊到各模型便于展示,一个 Key 的分摊之和恰好等于订阅费。
  // 0.3.14 性能:先按 Key 归组(单遍),避免每个 Key 都过滤一遍全部模型。
  const modelsByKey = new Map()
  for (const m of models) {
    let own = modelsByKey.get(m.key)
    if (own === undefined) {
      own = []
      modelsByKey.set(m.key, own)
    }
    own.push(m)
  }
  for (const [key, own] of modelsByKey) {
    const plan = planCtx.get(key)
    const base = own.reduce((sum, m) => sum + m.payable, 0)
    const fee = plan !== undefined ? Math.max(0, plan.plan.fee) : 0
    for (const m of own) {
      // A subscription key always pays its subscription fee, including a free
      // plan. Only keys without a plan pay the effective token/per-call price.
      m.actualCost = plan !== undefined
        ? (base > 0 ? fee * m.payable / base : fee / Math.max(1, own.length))
        : m.payable
    }
  }
  for (const m of models) if (!(m.actualCost >= 0)) m.actualCost = m.payable
  // 按次付费模型的两种计价对比(0.3.14):同一条目同时给出按量价与按次价,
  // 供「按次调用回本提示」判断哪种计价更便宜(韦恩图:便宜的是贵的子集)。
  const perCallModels = models
    .filter((m) => m.callCost > 0)
    .map((m) => ({
      key: m.key,
      model: m.model,
      provider: m.provider,
      brand: m.brand,
      calls: m.calls,
      tokens: m.tokens,
      tokenCost: m.cost,
      callCost: m.callCost,
    }))

  const buildPlanInfo = (pc, key, cycStats) => {
    const p = pc.plan
    // 冻结历史周期(0.3.4):tokens/cost 由账本按固定窗口派生(账本不可变 → 冻结),
    // 最新在前;TID 本身不外传(内部身份,不向用户显示)。
    const cycles = pc.cyclesWindows !== null
      ? pc.cyclesWindows
        .map((c) => {
          const s = cycStats !== undefined && cycStats.get(key) !== undefined ? cycStats.get(key).get(c.tid) : undefined
          return {
            start: c.start,
            end: c.end,
            fee: c.fee,
            tokens: s !== undefined ? s.tokens : 0,
            cost: s !== undefined ? s.cost : 0,
          }
        })
        .sort((a, b) => b.start - a.start)
      : []
    return {
      enabled: true,
      fee: p.fee,
      credits: p.credits,
      startAt: p.startAt,
      periodDays: p.periodDays,
      resetMode: p.resetMode,
      // 0.3.14:连续订阅 / 到期状态 / 下次续费生效的套餐更改 / 合并进来的来源 Key
      autoRenew: p.autoRenew === true,
      expired: p.autoRenew !== true && pc.curEnd <= today,
      nextPlan: p.nextPlan ?? null,
      mergedKeys: Array.isArray(p.mergedKeys) ? p.mergedKeys : [],
      cycleStart: pc.curStart,
      cycleEnd: pc.curEnd,
      cycleTokens: pc.curTokens,
      cycleCost: pc.curCost,
      brokenEven: p.fee > 0 && pc.curCost >= p.fee,
      tokensPerCredit: p.credits > 0 ? (pc.curTokens / p.credits) : null,
      effectiveRate: pc.curTokens > 0 ? (p.fee / pc.curTokens) : 0,
      // 0.3.14 累计口径:性价比按「累计订阅费 ÷ 累计消耗 tokens」计算,不再只看本周期
      cumulativeTokens: pc.cumTokens,
      cumulativeCost: pc.cumCost,
      cumulativeFee: pc.cumFee,
      prevCycle: pc.prev !== null
        ? { start: pc.prev.start, end: pc.prev.end, fee: pc.prev.fee, tokens: pc.prevTokens, cost: pc.prevCost }
        : null,
      pending: pc.pending !== null
        ? { since: pc.pending.at, tokens: pc.pendingTokens, cost: pc.pendingCost }
        : null,
      cycles,
    }
  }

  // 展示范围的每个 Key 的模型明细(性价比排名回退用;计划 Key 的 models 会被
  // 替换为周期口径,展示范围明细必须单独保留)
  const displayModelMap = new Map()
  for (const [key, row] of keyMap) displayModelMap.set(key, [...row.models.values()])
  const keys = [...keyMap.values()].map((row) => {
    const pc = planCtx.get(row.key)
    let plan = pc !== undefined ? buildPlanInfo(pc, row.key, cycleStats) : null
    // 0.3.14:计划 Key 的按模型明细改用累计口径(与性价比一致,不再只显示本周期)
    let cardModels = [...row.models.values()].sort((a, b) => b.cost - a.cost)
    if (pc !== undefined) {
      const pm = planModelTotalMap.get(row.key)
      cardModels = pm ? [...pm.values()].sort((a, b) => b.cost - a.cost) : []
    }
    return { key: row.key, provider: row.provider, calls: row.calls, tokens: row.tokens, cost: row.cost, models: cardModels, plan }
  })
  // 展示范围内没有消耗的 Token Plan Key 也要出现在回本卡片里
  {
    const seen = new Set(keys.map((k) => k.key))
    for (const [key, pc] of planCtx) {
      if (seen.has(key)) continue
      const pm = planModelTotalMap.get(key)
      const cardModels = pm ? [...pm.values()].sort((a, b) => b.cost - a.cost) : []
      keys.push({ key, provider: '', calls: 0, tokens: 0, cost: 0, models: cardModels, plan: buildPlanInfo(pc, key, cycleStats) })
    }
  }

  // 性价比排名:所有模型的 (Key · 模型) 一起比较(排名名 = key · model)。
  // 0.3.14:Token Plan Key 改为**累计口径**——累计消耗 tokens ÷ 累计订阅金额
  // (当前周期 + 上一轮 + 全部历史周期的订阅费之和),不再只统计本周期,也不再
  // 标注「本周期 / 上一轮」;例:9.9/月的订阅用了两个月、共 800M tokens →
  // 800M ÷ 19.8;第二个月换成 49.9 档 → 800M ÷ 59.9。
  // 累计金额按各模型累计金额占比摊到模型上(同计划下仍能按模型价效率区分)。
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
          brand: brandLabelOf(providerList, row.provider, m.model),
          usingPrev: false,
          collecting: false,
          tokens,
          amount,
          ratio: amount > 0 ? tokens / amount : 0,
        })
      }
      continue
    }
    // 计划 Key:累计 tokens ÷ 累计订阅费
    let totalTokens = pc.cumTokens
    let fee = pc.cumFee > 0 ? pc.cumFee : (row.plan.fee > 0 ? row.plan.fee : pc.cumCost)
    let collecting = false
    let src = planModelTotalMap.get(row.key)
    if (src === undefined || src === null || !(totalTokens > 0)) {
      // 累计窗口内尚无数据(如新配置未设起效时间):回退展示范围消耗,按同一
      // 加权规则分配订阅费,保证该 Key 的模型仍然进入排名
      src = new Map((displayModelMap.get(row.key) || []).map((m) => [m.model, m]))
      totalTokens = row.tokens
      collecting = true
    }
    let srcCost = 0
    for (const m of src.values()) srcCost += m.cost || 0
    for (const m of src.values()) {
      const tokens = m.tokens
      if (!(tokens > 0)) continue
      const amount = srcCost > 0
        ? fee * (m.cost || 0) / srcCost
        : (totalTokens > 0 ? fee * tokens / totalTokens : 0)
      rankings.push({
        key: row.key,
        model: m.model,
        brand: brandLabelOf(providerList, row.provider, m.model),
        usingPrev: false,
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

  return { fromMs: from, toMs: to, currency, models, keys, rankings, daily, maxDailyCost, perCallModels, rotations }
}
