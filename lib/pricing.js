/**
 * 价格计算(0.3.1 重做):按「模型」聚合的自定义价格把 Token 消耗折算成金额。
 *
 * 配置结构(存放在 config.json 覆盖层,经设置页「价格编辑」页面编辑):
 *   pricing: {
 *     currency: '¥' | '$',                          // 金额币种
 *     default:  { cacheIn, cacheOut, output, cacheWrite, reasoning },  // 全局默认价(每 1M tokens)
 *     models: {                                     // 跨 Key 合并的模型价格(0.3.1)
 *       'DeepSeek-V4-Flash-0731': {
 *         enabled: true,                            // 已激活:用户自定义价格生效
 *         price: { cacheIn, ..., peak?: { offPeak, peak } },
 *       },
 *     },
 *   }
 *   plans: {                                        // Token Plan 订阅(按 Key)
 *     'DEEPSEEK_API_KEY': { enabled: true, fee: 200, credits: 2000 },
 *   }
 *   peak: {                                         // 峰谷计价
 *     enabled: true,
 *     windows: [{ start: 1, end: 4 }, { start: 6, end: 10 }],  // 峰时段(UTC 小时)
 *     weekdaysOnly: true,                           // 仅工作日(周一至周五,北京时间)计峰
 *     boundaryMs: 1755360000000,                    // 峰谷时代分界(此前的调用按基础价)
 *   }
 *
 * 价格解析(priceFor):已激活的模型用 models[model].price,否则**默认使用官方价**
 * (内置官方价格目录,按当前币种),目录未收录时回退全局默认价;字段级继承
 * 模型价 → 全局默认价。
 *
 * 单价可内嵌峰谷子档(模型价 / 官方目录):{ cacheIn, ..., peak: { offPeak: {...}, peak: {...} } }。
 * tierForEntry() 按调用时刻(atMs)选择 基础价 / 峰时价 / 谷时价(基础价 = 非峰谷档);
 * 0.1/0.2 版本的旧账目(entry.ver < 3)一律按**低谷价**计费(旧数据没有峰谷语义,
 * 统一取最保守的谷时价,避免旧数据被按峰时价回溯计费)。
 *
 * 金额口径:每次调用 usage 的各类 tokens × 对应单价 / 1e6(价格按每 1M tokens)。
 * 本模块仅依赖本地 pricing-catalog.js(纯数据),无 npm 外部依赖。
 */

import { lookupCatalogModel, catalogPriceFor, catalogPeakFor } from './pricing-catalog.js'

export const PRICE_KEYS = ['cacheIn', 'cacheOut', 'output', 'cacheWrite', 'reasoning']

export const EMPTY_PRICE = { cacheIn: 0, cacheOut: 0, output: 0, cacheWrite: 0, reasoning: 0 }

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
      if (typeof v.enabled === 'boolean' || (v.price !== null && typeof v.price === 'object')) {
        // 新结构:{ enabled, price }
        models[model] = { enabled: v.enabled === true, price: normalizePriceEntry(v.price) }
      } else {
        // 旧 0.3 直接价条目 → 视为已激活自定义
        models[model] = { enabled: true, price: normalizePriceEntry(v) }
      }
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
          models[m] = { enabled: true, price: incoming }
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
          models[m] = { enabled: true, price: merged }
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
    }
  }
  return out
}
/**
 * 取某模型的单价(跨 Key 合并,0.3.1):已激活自定义 → 模型价;未激活 → 官方目录价;
 * 字段级继承 模型价/官方价 → 全局默认价。返回的价对象总包含全部 5 个键(缺失补 0)。
 * @param {object} pricing 归一化后的 pricing 配置
 * @param {string} [key] 兼容参数(0.3.1 起不再参与模型定价;仅保留签名兼容)
 * @param {string} [model] 模型名
 */
export function priceFor(pricing, key, model) {
  const p = pricing !== null && typeof pricing === 'object' ? pricing : DEFAULT_PRICING
  const def = p.default ?? EMPTY_PRICE
  const m = p.models !== null && typeof p.models === 'object' ? p.models[model ?? ''] : undefined
  let chosen = null
  if (m !== undefined && m !== null && m.enabled === true && m.price !== null && typeof m.price === 'object') {
    chosen = m.price
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
  const merged = { ...def, ...(chosen ?? {}) }
  const out = {}
  for (const k of PRICE_KEYS) out[k] = merged[k] ?? 0
  // 峰谷子档随价传递(取档 tierForEntry 依赖 price.peak)
  if (merged.peak !== undefined && merged.peak !== null) out.peak = merged.peak
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

/**
 * 取某时刻应使用的单价(含峰谷档):price 内嵌 peak 子档且峰谷计价开启时,
 * 峰时用 peak.peak、谷时用 peak.offPeak(缺省回退基础价);分界前一律基础价。
 * @param {boolean} [legacy] true = 0.1/0.2 旧账目:无视调用时刻,一律按低谷价(offPeak)计。
 */
export function tierForEntry(price, atMs, peakCfg, legacy) {
  if (price === null || typeof price !== 'object' || price.peak === undefined || price.peak === null) {
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
