/**
 * 0.3.7 旧版本价格数据迁移(独立脚本)。
 *
 * 升级到 0.3.7 后的第一次启动自动把 0.3.5/0.3.6 的价格配置应用到新版本结构:
 *   - 旧主体峰谷规则 { windows, weekdaysOnly, multiplier } →
 *     v2 { dayScope: 'weekday'|'everyday', days, windows, mode: 'multiplier', multiplier }
 *     (weekdaysOnly=true → 工作日,false → 每天;峰时价格方式缺省为倍率);
 *   - 旧规则主体的高峰时段原按 **UTC 小时** 解释(0.3.5 文案「峰时段(UTC 小时)」),
 *     v2 起按主体时区解释——为保持旧规则计费行为不变,携带旧规则的主体的时区
 *     固定为 0(UTC),用户可在峰谷规则页改为本地时区;新配置的时区缺省 UTC+8;
 *   - 模型 / Provider 行补齐 0.3.7 倍率字段(mode='custom'、multiplier=1、
 *     providers[pid].multiplier=1)——旧的自定义价原样保留,倍率缺省 1
 *     (实际价 = 默认价 × 1 = 原价,行为不变)。
 *
 * 幂等:迁移 = 预变换(旧结构识别)+ normalizePricing 的 v2 归一(单一事实来源),
 * 可重复执行;是否需要执行由 config.json 顶层 pricingVersion 标记决定(首次升级后
 * 写入),因此每个安装只真正落盘一次。迁移失败只告警,不影响插件运行(读取侧
 * normalizePricing 兼容旧结构,统计照常)。
 */

import { normalizePricing } from './pricing.js'

/** 当前价格配置结构版本(0.3.7 = 2)。 */
export const PRICING_VERSION = 2

/** 是否需要执行迁移:config.json 顶层缺少 pricingVersion === 2 标记时执行一次。 */
export function needsPricingMigration(overrides) {
  return !(overrides !== null && typeof overrides === 'object' && overrides.pricingVersion === PRICING_VERSION)
}

function isObj(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/** 规则是否为旧格式(缺 dayScope 字段)。 */
function isLegacyRule(r) {
  return isObj(r) && r.dayScope === undefined
}

/** 旧格式规则的主体:时区固定 0(UTC),保持旧「峰时段(UTC 小时)」语义不变。 */
function preserveLegacyTz(peak) {
  if (!isObj(peak) || !Array.isArray(peak.rules)) return peak
  if (!peak.rules.some(isLegacyRule)) return peak
  const tz = Number(peak.tz)
  return { ...peak, tz: Number.isFinite(tz) && tz >= -12 && tz <= 14 ? tz : 0 }
}

/**
 * 预变换:把旧结构中需要保持旧行为的部分标记出来(旧规则主体 tz=0),
 * 其余交给 normalizePricing 归一(补齐 mode/multiplier/dayScope/days 等缺省)。
 */
function preTransform(rawPricing) {
  const src = isObj(rawPricing) ? rawPricing : {}
  if (!isObj(src.models)) return src
  const models = { ...src.models }
  for (const name of Object.keys(models)) {
    const row = models[name]
    if (!isObj(row)) continue
    const next = { ...row }
    if (isObj(next.peak)) next.peak = preserveLegacyTz(next.peak)
    if (isObj(next.providers)) {
      const providers = { ...next.providers }
      for (const pid of Object.keys(providers)) {
        const prow = providers[pid]
        if (!isObj(prow)) continue
        if (isObj(prow.peak)) providers[pid] = { ...prow, peak: preserveLegacyTz(prow.peak) }
      }
      next.providers = providers
    }
    models[name] = next
  }
  return { ...src, models }
}

/**
 * 把旧版本 pricing 配置归一到 v2 结构(峰谷规则 / 倍率字段补齐)。
 * @returns {{ pricing: object, changed: boolean }} changed = 归一结果与输入不同(确有旧结构被改写)。
 */
export function migratePricingV2(rawPricing) {
  let before = ''
  try { before = JSON.stringify(rawPricing ?? null) } catch { before = '' }
  const pricing = normalizePricing(preTransform(rawPricing))
  let after = ''
  try { after = JSON.stringify(pricing) } catch { after = '' }
  return { pricing, changed: before !== after }
}
