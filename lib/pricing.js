/**
 * 价格计算(0.3.7):按「模型」聚合的自定义价格把 Token 消耗折算成金额。
 *
 * 配置结构(存放在 config.json 覆盖层,经设置页「价格编辑」页面编辑):
 *   pricing: {
 *     currency: '¥' | '$',                          // 金额币种
 *     default:  { cacheIn, cacheOut, output, cacheWrite, reasoning },  // 全局默认价(每 1M tokens)
 *     models: {                                     // 跨 Key 合并的模型价格(0.3.1)
 *       'DeepSeek-V4-Flash-0731': {
 *         enabled: true,                            // 已激活:用户自定义价格生效
 *         mode: 'custom' | 'multiplier',            // 0.3.7 自定义方式:逐字段价 / 倍率
 *         multiplier: 1,                            // 0.3.7 倍率(实际价 = 默认价 × 倍率)
 *         price: { cacheIn, ..., peak?: { offPeak, peak } },
 *       },
 *     },
 *   }
 *   plans: {                                        // Token Plan 订阅(按 Key)
 *     'DEEPSEEK_API_KEY': { enabled: true, fee: 200, credits: 2000 },
 *   }
 *   0.3.4 追加:plan.tid = 当前周期唯一身份;plan.cycles = { tid: { start, end,
 *   fee, tokens, cost } } 已冻结的历史周期;plan.pending = { at } 429/402 后
 *   待用户确认续费的标记(期间的消耗计入临时账本,回应后并入原周期)。
 *   peak: {                                         // 峰谷计价
 *     enabled: true,
 *     windows: [{ start: 1, end: 4 }, { start: 6, end: 10 }],  // 峰时段(UTC 小时)
 *     weekdaysOnly: true,                           // 仅工作日(周一至周五,北京时间)计峰
 *     boundaryMs: 1755360000000,                    // 峰谷时代分界(此前的调用按基础价)
 *   }
 *
 * 价格解析(priceFor):Provider ID 专属价(models[model].providers[pid],取消
 * 「使用集体价格」后生效)→ 已激活的模型集体价 → **默认官方价**(内置目录,按
 * 当前币种),目录未收录时回退全局默认价;字段级继承 专属价/集体价 → 全局默认价。
 * 0.3.7:模型名查找**不区分大小写**(价格表大小写不同也能命中);模型自定义
 * mode='multiplier' 时实际价 = 该模型默认价(官方价,无官方价用全局默认价)× 倍率;
 * Provider ID 子卡倍率 providers[pid].multiplier(默认 1)对该 Provider 的最终价整体缩放。
 *
 * 峰谷(0.3.5 → 0.3.7):主体(模型集体 / 模型×Provider)可配置峰谷规则列表
 * models[model].peak / .providers[pid].peak = { enabled, tz, rules: [...] },
 * 条件格式式——自上而下,首个命中时刻的规则生效。0.3.7 规则结构:
 *   { dayScope: 'weekday'|'everyday'|'custom', days: [0..6],   // 生效日(工作日/每天/自定义)
 *     windows: [{ start, end }],                               // 高峰时段(主体时区小时)
 *     mode: 'multiplier'|'custom',                             // 峰时价格:倍率 / 自定义价
 *     multiplier, peakPrice: { cacheIn, ... } }                // custom 时缺失字段 = 原价
 * peak.tz = 时区(UTC 偏移小时,默认 8 = UTC+8),时刻与星期都按它判定。
 * 旧结构(weekdaysOnly + multiplier)读取时自动归一(仅工作日→weekday,否则 everyday)。
 * 主体规则优先于价内嵌 peak 子档(DeepSeek 官方目录档),Provider 规则优先于集体规则。
 *
 * 金额口径:每次调用 usage 的各类 tokens × 对应单价 / 1e6(价格按每 1M tokens)。
 * 本模块仅依赖本地 pricing-catalog.js(纯数据),无 npm 外部依赖。
 */

import { lookupCatalogModel, catalogPriceFor, catalogPeakFor } from './pricing-catalog.js'

export const PRICE_KEYS = ['cacheIn', 'cacheOut', 'output', 'cacheWrite', 'reasoning']

export const EMPTY_PRICE = { cacheIn: 0, cacheOut: 0, output: 0, cacheWrite: 0, reasoning: 0 }

/** 峰谷生效日范围(0.3.7):工作日 = 周一至周五;每天;自定义 = days 列表(0=周日)。 */
export const WEEKDAY_DAYS = [1, 2, 3, 4, 5]
export const EVERYDAY_DAYS = [0, 1, 2, 3, 4, 5, 6]
/** 峰谷默认时区:UTC+8(北京时间)。 */
export const DEFAULT_PEAK_TZ = 8

export const DEFAULT_PRICING = {
  currency: '¥',
  default: { cacheIn: 0, cacheOut: 0, output: 0, cacheWrite: 0, reasoning: 0 },
  models: {},
}

export const DEFAULT_PLANS = {}

/** 峰谷计价默认值(DeepSeek 官方规则):北京时间周一至周五 9:00-12:00、14:00-18:00
 *  = UTC 01:00-04:00、06:00-10:00;2026-08-16 16:00 UTC 之前按基础价。 */
export const DEFAULT_PEAK = {
  enabled: true,
  windows: [{ start: 1, end: 4 }, { start: 6, end: 10 }],
  weekdaysOnly: true,
  boundaryMs: Date.parse('2026-08-16T16:00:00Z'),
}

/** 记账时写入本插件的条目版本(3 = 0.3 起的价格语义;低于 3 或无 ver 视为 0.1/0.2 旧数据)。 */
export const ENTRY_VERSION = 3

function numOrZero(v) {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : 0
}

/**
 * 归一化一份单价:只保留显式设置过的价格键(合法非负数字)。
 * 未设置的键不出现 → priceFor 合并时回退到全局默认价。
 */
export function normalizePrices(v) {
  const src = v !== null && typeof v === 'object' ? v : {}
  const out = {}
  for (const k of PRICE_KEYS) {
    if (src[k] === undefined || src[k] === null || src[k] === '') continue
    const n = numOrZero(src[k])
    if (n >= 0) out[k] = n
  }
  return out
}

/** 归一化一份「单价条目」:5 个价格键 + 可选峰谷子档(peak.offPeak / peak.peak)。 */
export function normalizePriceEntry(v) {
  const base = normalizePrices(v)
  const peak = v !== null && typeof v === 'object' && v.peak !== null && typeof v.peak === 'object'
    ? v.peak
    : null
  if (peak !== null) {
    const sub = {}
    if (peak.offPeak !== null && typeof peak.offPeak === 'object') sub.offPeak = normalizePrices(peak.offPeak)
    if (peak.peak !== null && typeof peak.peak === 'object') sub.peak = normalizePrices(peak.peak)
    if (sub.offPeak !== undefined || sub.peak !== undefined) base.peak = sub
  }
  return base
}

/** 归一化峰谷计价配置。 */
export function normalizePeak(raw) {
  const src = raw !== null && typeof raw === 'object' ? raw : {}
  const windows = []
  if (Array.isArray(src.windows)) {
    for (const w of src.windows) {
      if (w === null || typeof w !== 'object') continue
      const start = Number(w.start)
      const end = Number(w.end)
      if (Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end >= 0 && start < 24 && end <= 24) {
        windows.push({ start, end })
      }
    }
  }
  const boundaryMs = Number(src.boundaryMs)
  return {
    enabled: src.enabled === true,
    windows,
    weekdaysOnly: src.weekdaysOnly !== false,
    boundaryMs: Number.isFinite(boundaryMs) && boundaryMs > 0 ? boundaryMs : 0,
  }
}

/** 归一化生效日范围(0.3.7):'weekday' | 'everyday' | 'custom'(days 取 0..6)。 */
function normalizeDayScope(r) {
  const days = Array.isArray(r.days)
    ? [...new Set(r.days.map((d) => Number(d)).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
    : []
  if (r.dayScope === 'everyday') return { dayScope: 'everyday', days: [...EVERYDAY_DAYS] }
  if (r.dayScope === 'custom') return { dayScope: 'custom', days: days.length > 0 ? days : [...WEEKDAY_DAYS] }
  if (r.dayScope === 'weekday') return { dayScope: 'weekday', days: [...WEEKDAY_DAYS] }
  // 旧结构(0.3.5):weekdaysOnly = true(或缺省)→ 工作日;false → 每天
  return r.weekdaysOnly === false ? { dayScope: 'everyday', days: [...EVERYDAY_DAYS] } : { dayScope: 'weekday', days: [...WEEKDAY_DAYS] }
}

/** 归一化主体峰谷规则(0.3.5,条件格式式:自上而下,首个命中规则生效;0.3.7 v2 结构)。 */
export function normalizePeakRules(raw) {
  if (raw === null || typeof raw !== 'object') return undefined
  const rules = []
  if (Array.isArray(raw.rules)) {
    for (const r of raw.rules) {
      if (r === null || typeof r !== 'object') continue
      const windows = []
      if (Array.isArray(r.windows)) {
        for (const w of r.windows) {
          const start = Number(w && w.start)
          const end = Number(w && w.end)
          if (Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end >= 0 && start < 24 && end <= 24) {
            windows.push({ start, end })
          }
        }
      }
      const scope = normalizeDayScope(r)
      const multiplier = numOrZero(r.multiplier)
      const rule = {
        ...scope,
        windows,
        mode: r.mode === 'custom' ? 'custom' : 'multiplier',
        multiplier: multiplier > 0 ? Math.min(1000, Math.round(multiplier * 10000) / 10000) : 2,
      }
      // mode='custom':峰时自定义价(0.3.7),缺失字段按原价;只在有合法字段时写入
      if (rule.mode === 'custom') {
        const pp = normalizePrices(r.peakPrice)
        if (Object.keys(pp).length > 0) rule.peakPrice = pp
      }
      rules.push(rule)
    }
  }
  const tz = Number(raw.tz)
  return {
    enabled: raw.enabled === true,
    tz: Number.isFinite(tz) && tz >= -12 && tz <= 14 ? Math.round(tz * 4) / 4 : DEFAULT_PEAK_TZ,
    rules,
  }
}

/** 归一化整份 pricing 配置(0.3.1:模型聚合;兼容迁移 0.3 的 byKey 结构)。 */
export function normalizePricing(raw) {
  const src = raw !== null && typeof raw === 'object' ? raw : {}
  const currency = src.currency === '$' ? '$' : '¥'
  const def = normalizePrices(src.default)
  const models = {}
  if (src.models !== null && typeof src.models === 'object' && !Array.isArray(src.models)) {
    for (const model of Object.keys(src.models)) {
      const v = src.models[model]
      if (v === null || typeof v !== 'object') continue
      let row
      if (typeof v.enabled === 'boolean' || (v.price !== null && typeof v.price === 'object')) {
        // 新结构:{ enabled, price }
        row = { enabled: v.enabled === true, price: normalizePriceEntry(v.price) }
      } else {
        // 旧 0.3 直接价条目 → 视为已激活自定义
        row = { enabled: true, price: normalizePriceEntry(v) }
      }
      // 0.3.7:自定义方式(逐字段价 / 倍率)+ 倍率值(实际价 = 默认价 × 倍率)
      row.mode = v.mode === 'multiplier' ? 'multiplier' : 'custom'
      const mMult = numOrZero(v.multiplier)
      row.multiplier = mMult > 0 ? Math.min(1000, Math.round(mMult * 10000) / 10000) : 1
      // 0.3.5:Provider ID 子价(useCollective + 专属价)与主体峰谷规则
      if (v.providers !== null && typeof v.providers === 'object' && !Array.isArray(v.providers)) {
        const providers = {}
        for (const pid of Object.keys(v.providers)) {
          const pv = v.providers[pid]
          if (pv === null || typeof pv !== 'object') continue
          const prow = { useCollective: pv.useCollective !== false, price: normalizePriceEntry(pv.price) }
          // 0.3.7:该 Provider ID 的价格倍率(默认 1,对其最终价整体缩放)
          const pMult = numOrZero(pv.multiplier)
          prow.multiplier = pMult > 0 ? Math.min(1000, Math.round(pMult * 10000) / 10000) : 1
          const pPeak = normalizePeakRules(pv.peak)
          if (pPeak !== undefined) prow.peak = pPeak
          providers[pid] = prow
        }
        if (Object.keys(providers).length > 0) row.providers = providers
      }
      const mPeak = normalizePeakRules(v.peak)
      if (mPeak !== undefined) row.peak = mPeak
      models[model] = row
    }
  }
  // 0.3 byKey 迁移:不同 Key 的相同模型价格合并为一款模型价(同字段后写入者覆盖)
  if (src.byKey !== null && typeof src.byKey === 'object' && !Array.isArray(src.byKey)) {
    for (const key of Object.keys(src.byKey)) {
      const kc = src.byKey[key]
      if (kc === null || typeof kc !== 'object') continue
      const kModels = kc.models !== null && typeof kc.models === 'object' && !Array.isArray(kc.models) ? kc.models : {}
      for (const m of Object.keys(kModels)) {
        const incoming = normalizePriceEntry(kModels[m])
        if (models[m] === undefined) {
          models[m] = { enabled: true, price: incoming, mode: 'custom', multiplier: 1 }
        } else {
          // 字段级合并:已有字段保留,新字段补入;同一字段以后写入者为准
          const merged = { ...(models[m].price || {}) }
          for (const k of PRICE_KEYS) {
            if (incoming[k] !== undefined) merged[k] = incoming[k]
          }
          if (incoming.peak !== undefined && incoming.peak !== null) {
            merged.peak = merged.peak || {}
            for (const tier of ['offPeak', 'peak']) {
              const sub = incoming.peak[tier]
              if (sub !== undefined && sub !== null) {
                merged.peak[tier] = { ...(merged.peak[tier] || {}), ...sub }
              }
            }
          }
          models[m] = { enabled: true, price: merged, mode: 'custom', multiplier: 1 }
        }
      }
    }
  }
  return { currency, default: def, models }
}

/** 归一化 plans 配置:key → { enabled, fee, credits, startAt, periodDays, resetMode,
 *  cycleStart, cycleEnd, prevCycle }。0.3.1 使用分析:Token Plan 支持计费周期
 * (套餐起效时间 startAt + 有效期 periodDays,默认 31 天;或 resetMode='monthly'
 * 每月 1 号 UTC+0 自动重置),服务端维护当前周期 cycleStart/cycleEnd 与上一轮
 * prevCycle(手动重置后同样归档为上一轮)。 */
export function normalizePlans(raw) {
  const src = raw !== null && typeof raw === 'object' ? raw : {}
  const out = {}
  for (const key of Object.keys(src)) {
    const p = src[key]
    if (p === null || typeof p !== 'object') continue
    const prev = p.prevCycle !== null && typeof p.prevCycle === 'object'
      ? {
        start: numOrZero(p.prevCycle.start),
        end: numOrZero(p.prevCycle.end),
        fee: numOrZero(p.prevCycle.fee),
        tokens: numOrZero(p.prevCycle.tokens),
        cost: numOrZero(p.prevCycle.cost),
      }
      : null
    // 0.3.3:重置撤回快照(plan._undo)原样保留,供 undoPlanCycle 撤回
    const undo = p._undo !== null && typeof p._undo === 'object'
      ? {
        cycleStart: numOrZero(p._undo.cycleStart),
        cycleEnd: numOrZero(p._undo.cycleEnd),
        prevCycle: p._undo.prevCycle !== null && typeof p._undo.prevCycle === 'object'
          ? {
            start: numOrZero(p._undo.prevCycle.start),
            end: numOrZero(p._undo.prevCycle.end),
            fee: numOrZero(p._undo.prevCycle.fee),
            tokens: numOrZero(p._undo.prevCycle.tokens),
            cost: numOrZero(p._undo.prevCycle.cost),
          }
          : null,
        // 0.3.4:重置前的 TID(撤回时恢复周期身份)
        tid: typeof p._undo.tid === 'string' && p._undo.tid !== '' ? p._undo.tid : undefined,
      }
      : undefined
    // 0.3.4:周期唯一身份 TID + 冻结历史 cycles + 429/402 待确认标记 pending,
    // 全部随配置持久化(读取侧归一,不丢字段)。
    const cycles = {}
    if (p.cycles !== null && typeof p.cycles === 'object' && !Array.isArray(p.cycles)) {
      for (const tid of Object.keys(p.cycles)) {
        const c = p.cycles[tid]
        if (c === null || typeof c !== 'object') continue
        cycles[tid] = {
          start: numOrZero(c.start),
          end: numOrZero(c.end),
          fee: numOrZero(c.fee),
          tokens: numOrZero(c.tokens),
          cost: numOrZero(c.cost),
        }
      }
    }
    const pending = p.pending !== null && typeof p.pending === 'object' && numOrZero(p.pending.at) > 0
      ? { at: numOrZero(p.pending.at) }
      : undefined
    out[key] = {
      enabled: p.enabled === true,
      fee: numOrZero(p.fee),
      credits: numOrZero(p.credits),
      startAt: numOrZero(p.startAt),
      periodDays: numOrZero(p.periodDays) > 0 ? Math.min(3650, Math.round(numOrZero(p.periodDays))) : 31,
      resetMode: p.resetMode === 'monthly' ? 'monthly' : 'days',
      cycleStart: numOrZero(p.cycleStart),
      cycleEnd: numOrZero(p.cycleEnd),
      prevCycle: prev,
      tid: typeof p.tid === 'string' && p.tid !== '' ? p.tid : undefined,
      cycles,
      pending,
      _undo: undo,
    }
  }
  return out
}
/**
 * 模型行查找(0.3.7 不区分大小写):先精确键命中,再按小写匹配——
 * 价格表里保存的大小写与调用记录不同也能命中同一条价格。
 */
function modelRowOf(pricing, model) {
  const models = pricing !== null && typeof pricing === 'object' && pricing.models !== null && typeof pricing.models === 'object'
    ? pricing.models
    : null
  if (models === null) return undefined
  const name = typeof model === 'string' ? model : ''
  if (name !== '' && models[name] !== undefined) return models[name]
  const target = name.toLowerCase()
  if (target === '') return undefined
  for (const k of Object.keys(models)) {
    if (typeof k === 'string' && k.toLowerCase() === target) return models[k]
  }
  return undefined
}

/** 把 5 键价整体乘以倍率(0.3.7,保留 6 位小数)。 */
function scalePrice(price, k) {
  if (!(k > 0) || k === 1) return price
  const out = {}
  for (const key of PRICE_KEYS) out[key] = Math.round((price[key] ?? 0) * k * 1e6) / 1e6
  return out
}

/**
 * 取某模型的单价(0.3.7):Provider ID 专属价(取消「使用集体价格」时)→
 * 已激活集体价(或 倍率模式 = 默认价 × 倍率)→ 官方目录价;字段级继承 → 全局默认价。
 * key 参数 = Provider ID(账目归一身份,0.3.5 起参与专属价解析;旧调用传 env 标签时按集体价/官方价)。
 * 返回的价对象总包含全部 5 个键(缺失补 0),并随价携带峰谷信息:
 * peak = 内嵌峰谷子档(官方目录/自定义),peakRules = 主体峰谷规则(0.3.5),
 * peakTz = 主体峰谷时区(0.3.7,UTC 偏移小时,默认 8)。
 */
export function priceFor(pricing, key, model) {
  const p = pricing !== null && typeof pricing === 'object' ? pricing : DEFAULT_PRICING
  const def = p.default ?? EMPTY_PRICE
  const m = modelRowOf(p, model)
  // 0.3.5:Provider ID 专属价优先于集体价
  const prov = m !== undefined && m !== null && m.providers !== null && typeof m.providers === 'object'
    ? m.providers[key ?? '']
    : undefined
  const hasOwn = prov !== undefined && prov !== null && prov.useCollective === false
    && prov.price !== null && typeof prov.price === 'object' && Object.keys(prov.price).length > 0
  let chosen = null
  let modelMult = 1
  if (hasOwn) {
    chosen = prov.price
  } else if (m !== undefined && m !== null && m.enabled === true && m.price !== null && typeof m.price === 'object') {
    if (m.mode === 'multiplier') {
      // 0.3.7 倍率模式:实际价 = 该模型默认价 × 倍率(默认价 = 官方价,未收录回退全局默认价;
      // 与默认价的合并在下方 merge 后进行,保证默认价也参与倍率计算)
      const cur = p.currency === '$' ? '$' : '¥'
      const official = catalogPriceFor(lookupCatalogModel(model ?? ''), cur)
      if (official !== null) chosen = official
      const mult = Number(m.multiplier)
      modelMult = Number.isFinite(mult) && mult > 0 ? Math.min(1000, mult) : 1
    } else {
      chosen = m.price
    }
  } else {
    // 默认使用官方价(未激活自定义的模型)
    const cur = p.currency === '$' ? '$' : '¥'
    const entry = lookupCatalogModel(model ?? '')
    const official = catalogPriceFor(entry, cur)
    if (official !== null) chosen = official
    if (entry !== null && entry.peak !== undefined) {
      const pk = catalogPeakFor(entry, cur)
      if (pk !== null) {
        const withPeak = chosen !== null && typeof chosen === 'object' ? { ...chosen } : {}
        withPeak.peak = {}
        if (pk.offPeak !== null && pk.offPeak !== undefined) withPeak.peak.offPeak = pk.offPeak
        if (pk.peak !== null && pk.peak !== undefined) withPeak.peak.peak = pk.peak
        chosen = withPeak
      }
    }
  }
  let merged = { ...def, ...(chosen ?? {}) }
  // 0.3.7 倍率模式:合并默认价后对 5 键整体 × 倍率
  if (modelMult !== 1) {
    merged = { ...merged, ...scalePrice(merged, modelMult) }
  }
  // 0.3.7:Provider ID 倍率(默认 1)对该 Provider 的最终价整体缩放
  // # ponytail: 内嵌峰谷子档(merged.peak)不随倍率缩放——倍率场景基本都配主体峰谷规则;
  // 如需子档也缩放,把 scalePrice 扩展到 peak.offPeak/peak 子档即可
  const pMult = prov !== undefined && prov !== null ? Number(prov.multiplier) : NaN
  if (Number.isFinite(pMult) && pMult > 0 && pMult !== 1) {
    merged = { ...merged, ...scalePrice(merged, pMult) }
  }
  const out = {}
  for (const k of PRICE_KEYS) out[k] = merged[k] ?? 0
  // 峰谷子档随价传递(取档 tierForEntry 依赖 price.peak)
  if (merged.peak !== undefined && merged.peak !== null) out.peak = merged.peak
  // 0.3.5:主体峰谷规则随价传递(Provider 主体配置优先于模型集体配置);0.3.7:附带时区
  const subj = prov !== undefined && prov !== null && prov.peak !== undefined && prov.peak !== null
    ? prov.peak
    : (m !== undefined && m !== null && m.peak !== undefined && m.peak !== null ? m.peak : null)
  if (subj !== null && subj.enabled === true && Array.isArray(subj.rules) && subj.rules.length > 0) {
    out.peakRules = subj.rules
    const tz = Number(subj.tz)
    out.peakTz = Number.isFinite(tz) && tz >= -12 && tz <= 14 ? tz : DEFAULT_PEAK_TZ
  }
  return out
}

/**
 * 判断某时刻是否处于峰时段(windows 为 UTC 小时区间;weekdaysOnly 时仅工作日计峰,
 * 工作日按北京时间判定,与 DeepSeek 官方「周一至周五 9:00-12:00、14:00-18:00」一致)。
 */
export function isPeakAt(atMs, windows, weekdaysOnly) {
  if (!Number.isFinite(atMs)) return false
  if (!Array.isArray(windows) || windows.length === 0) return false
  if (weekdaysOnly !== false) {
    const bj = new Date(atMs + 8 * 3600000)
    const dow = bj.getUTCDay() // 0=Sun .. 6=Sat
    if (dow === 0 || dow === 6) return false
  }
  const hour = new Date(atMs).getUTCHours()
  return windows.some((w) => {
    const start = Number(w && w.start)
    const end = Number(w && w.end)
    if (!Number.isFinite(start) || !Number.isFinite(end)) return false
    return start < end ? hour >= start && hour < end : hour >= start || hour < end
  })
}

/** 规则生效日集合:工作日 / 每天 / 自定义(0.3.7;兼容旧 weekdaysOnly 布尔)。 */
export function ruleDaysOf(rule) {
  if (rule === null || typeof rule !== 'object') return []
  if (rule.dayScope === 'everyday') return EVERYDAY_DAYS
  if (rule.dayScope === 'custom') {
    const days = Array.isArray(rule.days) ? rule.days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : []
    return days.length > 0 ? days : [...WEEKDAY_DAYS]
  }
  if (rule.dayScope === 'weekday') return WEEKDAY_DAYS
  return rule.weekdaysOnly === false ? [...EVERYDAY_DAYS] : [...WEEKDAY_DAYS]
}

/**
 * 判断某时刻是否命中一条主体峰谷规则(0.3.7):
 * 生效日(dayScope/days)与高峰小时均按主体时区 tz(UTC 偏移小时,默认 8)判定。
 */
export function isPeakRuleAt(atMs, rule, tz) {
  if (!Number.isFinite(atMs)) return false
  if (rule === null || typeof rule !== 'object') return false
  const off = Number.isFinite(Number(tz)) ? Number(tz) : DEFAULT_PEAK_TZ
  const shifted = new Date(atMs + off * 3600000)
  const dow = shifted.getUTCDay() // 0=Sun .. 6=Sat
  if (!ruleDaysOf(rule).includes(dow)) return false
  const hour = shifted.getUTCHours()
  const windows = Array.isArray(rule.windows) ? rule.windows : []
  return windows.some((w) => {
    const start = Number(w && w.start)
    const end = Number(w && w.end)
    if (!Number.isFinite(start) || !Number.isFinite(end)) return false
    return start < end ? hour >= start && hour < end : hour >= start || hour < end
  })
}

/**
 * 取某时刻应使用的单价(含峰谷档)。
 * 0.3.5:价内携带主体峰谷规则(peakRules)时,条件格式式取档——自上而下首个
 * 命中调用时刻的规则生效,无命中按基础价;旧账目一律基础价。
 * 0.3.7:规则生效日/时刻按主体时区(peakTz,默认 UTC+8)判定;规则峰时价格
 * mode='multiplier' 按倍率缩放基础价,mode='custom' 用峰时自定义价(peakPrice,
 * 缺失字段回退基础价 = 原价)。
 * 否则沿用内嵌 peak 子档:峰时用 peak.peak、谷时用 peak.offPeak(缺省回退基础价)。
 * @param {boolean} [legacy] true = 0.1/0.2 旧账目:无视调用时刻,一律按最保守的基础(谷)价计。
 */
export function tierForEntry(price, atMs, peakCfg, legacy) {
  if (price === null || typeof price !== 'object') return price
  // 0.3.5:主体峰谷规则优先于内嵌峰谷子档(基础价 = 剥离峰谷信息的 5 键价)
  if (Array.isArray(price.peakRules) && price.peakRules.length > 0) {
    const base = {}
    for (const k of PRICE_KEYS) base[k] = price[k] ?? 0
    if (legacy === true) return base
    const hit = price.peakRules.find((r) => isPeakRuleAt(atMs, r, price.peakTz))
    if (hit === undefined) return base
    if (hit.mode === 'custom') {
      // 0.3.7 自定义峰时价:peakPrice 提供的字段覆盖,缺失字段保持原价
      const out = { ...base }
      const pp = hit.peakPrice !== null && typeof hit.peakPrice === 'object' ? hit.peakPrice : {}
      for (const k of PRICE_KEYS) {
        const v = Number(pp[k])
        if (Number.isFinite(v) && v >= 0) out[k] = v
      }
      return out
    }
    const mult = Number(hit.multiplier)
    const k = Number.isFinite(mult) && mult > 0 ? Math.min(1000, mult) : 1
    if (k === 1) return base
    for (const key of PRICE_KEYS) base[key] = Math.round(base[key] * k * 1e6) / 1e6
    return base
  }
  if (price.peak === undefined || price.peak === null) {
    return price
  }
  const peak = peakCfg !== null && typeof peakCfg === 'object' ? peakCfg : DEFAULT_PEAK
  if (legacy === true) {
    // 旧数据没有峰谷语义,统一按最保守的谷时价计费
    const off = price.peak.offPeak
    return off !== undefined && off !== null ? { ...price, ...off } : price
  }
  if (peak.enabled !== true) return price
  const t = typeof atMs === 'number' && Number.isFinite(atMs) ? atMs : Date.now()
  if (peak.boundaryMs > 0 && t < peak.boundaryMs) return price
  const sub = price.peak
  if (isPeakAt(t, peak.windows, peak.weekdaysOnly)) {
    return sub.peak !== undefined && sub.peak !== null ? { ...price, ...sub.peak } : price
  }
  return sub.offPeak !== undefined && sub.offPeak !== null ? { ...price, ...sub.offPeak } : price
}

/** 账目条目是否来自 0.1/0.2 旧版本(无 ver 或 ver < ENTRY_VERSION)。 */
export function isLegacyEntry(entry) {
  return !(entry !== null && typeof entry === 'object' && typeof entry.ver === 'number' && entry.ver >= ENTRY_VERSION)
}

/** 把一份 buckets(tokens)按单价折算为金额(价格按每 1M tokens)。 */
export function costOf(buckets, price) {
  const b = buckets !== null && typeof buckets === 'object' ? buckets : {}
  const p = price !== null && typeof price === 'object' ? price : EMPTY_PRICE
  return (
    (b.cacheIn ?? 0) * (p.cacheIn ?? 0) +
    (b.cacheOut ?? 0) * (p.cacheOut ?? 0) +
    (b.output ?? 0) * (p.output ?? 0) +
    (b.cacheWrite ?? 0) * (p.cacheWrite ?? 0) +
    (b.reasoning ?? 0) * (p.reasoning ?? 0)
  ) / 1e6
}

/** 取某 Key 的 Token Plan 订阅配置(未启用/未配置返回 null)。带计费周期字段。 */
export function planFor(plans, key) {
  const p = plans !== null && typeof plans === 'object' ? plans : {}
  const plan = p[key ?? '']
  if (plan === undefined || plan === null || plan.enabled !== true) return null
  return {
    enabled: true,
    fee: numOrZero(plan.fee),
    credits: numOrZero(plan.credits),
    startAt: numOrZero(plan.startAt),
    periodDays: numOrZero(plan.periodDays) > 0 ? Math.min(3650, Math.round(numOrZero(plan.periodDays))) : 31,
    resetMode: plan.resetMode === 'monthly' ? 'monthly' : 'days',
    cycleStart: numOrZero(plan.cycleStart),
    cycleEnd: numOrZero(plan.cycleEnd),
    prevCycle: plan.prevCycle !== null && typeof plan.prevCycle === 'object'
      ? {
        start: numOrZero(plan.prevCycle.start),
        end: numOrZero(plan.prevCycle.end),
        fee: numOrZero(plan.prevCycle.fee),
        tokens: numOrZero(plan.prevCycle.tokens),
        cost: numOrZero(plan.prevCycle.cost),
      }
      : null,
    // 0.3.4:TID(内部周期身份)/ cycles(冻结历史)/ pending(429/402 待确认)
    tid: typeof plan.tid === 'string' && plan.tid !== '' ? plan.tid : undefined,
    cycles: plan.cycles !== null && typeof plan.cycles === 'object' && !Array.isArray(plan.cycles)
      ? Object.keys(plan.cycles).reduce((out, tid) => {
        const c = plan.cycles[tid]
        if (c === null || typeof c !== 'object') return out
        out[tid] = {
          start: numOrZero(c.start),
          end: numOrZero(c.end),
          fee: numOrZero(c.fee),
          tokens: numOrZero(c.tokens),
          cost: numOrZero(c.cost),
        }
        return out
      }, {})
      : {},
    pending: plan.pending !== null && typeof plan.pending === 'object' && numOrZero(plan.pending.at) > 0
      ? { at: numOrZero(plan.pending.at) }
      : null,
  }
}

/** 金额显示:币种 + 4 位有效数字(兼顾极小金额与较大金额)。 */
export function fmtMoney(value, currency) {
  const cur = currency === '$' ? '$' : '¥'
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0
  try {
    return cur + new Intl.NumberFormat('en-US', { maximumSignificantDigits: 4 }).format(n)
  } catch {
    return cur + n.toFixed(4)
  }
}
