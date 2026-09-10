/**
 * taskNotice Typert service (host side, hand-written manifest in typert.host.js).
 *
 * Methods (all must exist on the object provided via ctx.provide('taskNotice', …)):
 *   getHealth()                          → HealthState
 *   getConfig()                          → ConfigState
 *   updateConfig(patch)                  → ConfigState
 *   getUsageStats(fromMs, toMs)          → UsageStats
 *   getUsageAnalysis(fromMs, toMs)       → UsageAnalysis(0.3.1 使用分析页)
 *   resetPlanCycle(key, fromMs, toMs)    → UsageAnalysis(Token Plan 手动重置当前计费周期)
 *   clearUsage()                         → ClearResult(清空全部消耗账目,仅统计数据的清除)
 *   getProviderDirectory()               → ProviderDirectory(0.3.2 插件自维护 Provider 目录)
 *   refreshProviderDirectory()           → ProviderDirectory(重新抓取全局设置并落盘)
 *   deleteProviderId(id)                 → ProviderDirectory(删除失效 Provider ID 及其 Token Plan)
 *   subscribeNotifications(signal)       → AsyncIterable<NotificationFrame>
 *
 * 0.3.2 Key 身份 = Provider ID(全局模型设置路由);旧 env 标签 key 只作辅助展示。
 * 本模块所有对 plans 的读取都先经 providerIO.migrate(把旧 env 键归一到 provider id),
 * 保证「Token Plan 按 Key(=Provider)设置」的口径一致。
 */

import { priceFor, costOf, tierForEntry, isLegacyEntry, planFor } from './pricing.js'
import { OFFICIAL_PRICE_CATALOG } from './pricing-catalog.js'
import { computeAnalysis, planCycleEnd } from './analysis.js'
import { identityOfEntry, displayNameOf, keyEnvOf } from './providers.js'

/** planFor 的兼容别名:优先 provider id 键,其次旧 env 标签键。 */
function planForRow(plans, key, keyEnv) {
  const hit = planFor(plans, key)
  if (hit !== null) return hit
  if (typeof keyEnv === 'string' && keyEnv !== '' && keyEnv !== key) return planFor(plans, keyEnv)
  return null
}

export function createTaskNoticeService({ health, config, store, hub, applyConfigPatch, providerIO }) {
  const dirState = () => {
    if (providerIO && typeof providerIO.get === 'function') return providerIO.get()
    const cfg = config() || {}
    return { version: 1, updatedAt: 0, removed: [], list: Array.isArray(cfg.providers) ? cfg.providers : [] }
  }
  const service = {
    getHealth() {
      return health()
    },
    getConfig() {
      return config()
    },
    updateConfig(patch) {
      if (typeof applyConfigPatch === 'function') applyConfigPatch(patch)
      return config()
    },
    getUsageStats(fromMs, toMs) {
      const from = typeof fromMs === 'number' && Number.isFinite(fromMs) ? fromMs : 0
      const to = typeof toMs === 'number' && Number.isFinite(toMs) ? toMs : Date.now()
      const empty = () => ({ fromMs: from, toMs: to, calls: 0, totals: { cacheIn: 0, cacheOut: 0, output: 0, cacheWrite: 0, reasoning: 0, cost: 0 }, keys: [] })
      if (store === null || store === undefined) return empty()
      try {
        const entries = store.query(from, to)
        // 价格、套餐、峰谷档按当前配置现算(改价后历史金额即时生效)
        const cfg = config()
        const pricing = cfg.pricing
        const plans = cfg.plans
        const peak = cfg.peak
        const dir = dirState().list
        const byKey = new Map()
        let calls = 0
        const totals = { cacheIn: 0, cacheOut: 0, output: 0, cacheWrite: 0, reasoning: 0, cost: 0 }
        for (const e of entries) {
          calls += 1
          totals.cacheIn += e.cacheIn ?? 0
          totals.cacheOut += e.cacheOut ?? 0
          totals.output += e.output ?? 0
          totals.cacheWrite += e.cacheWrite ?? 0
          totals.reasoning += e.reasoning ?? 0
          // 按调用时刻(e.at)取峰谷档,逐调用精确计费;0.1/0.2 旧账目一律按低谷价
          const tier = tierForEntry(priceFor(pricing, e.key, e.model), e.at, peak, isLegacyEntry(e))
          const cost = costOf(e, tier)
          totals.cost += cost
          // 0.3.2:行身份 = provider id;无 provider 的旧账目回退 key 标签
          const key = identityOfEntry(e)
          let row = byKey.get(key)
          if (row === undefined) {
            row = { key, provider: e.provider ?? '', keyEnv: e.key ?? '', calls: 0, cacheIn: 0, cacheOut: 0, output: 0, cacheWrite: 0, reasoning: 0, cost: 0, models: new Map() }
            byKey.set(key, row)
          }
          row.calls += 1
          row.cacheIn += e.cacheIn ?? 0
          row.cacheOut += e.cacheOut ?? 0
          row.output += e.output ?? 0
          row.cacheWrite += e.cacheWrite ?? 0
          row.reasoning += e.reasoning ?? 0
          row.cost += cost
          const model = typeof e.model === 'string' && e.model !== '' ? e.model : 'unknown'
          let m = row.models.get(model)
          if (m === undefined) {
            m = { provider: e.provider ?? '', model, calls: 0, cacheIn: 0, cacheOut: 0, output: 0, cacheWrite: 0, reasoning: 0, cost: 0 }
            row.models.set(model, m)
          }
          m.calls += 1
          m.cacheIn += e.cacheIn ?? 0
          m.cacheOut += e.cacheOut ?? 0
          m.output += e.output ?? 0
          m.cacheWrite += e.cacheWrite ?? 0
          m.reasoning += e.reasoning ?? 0
          m.cost += cost
        }
        const keys = [...byKey.values()].map((row) => ({
          key: row.key,
          provider: row.provider,
          keyEnv: row.keyEnv,
          providerName: displayNameOf(row.key, dir),
          calls: row.calls,
          cacheIn: row.cacheIn,
          cacheOut: row.cacheOut,
          output: row.output,
          cacheWrite: row.cacheWrite,
          reasoning: row.reasoning,
          cost: row.cost,
          plan: planForRow(plans, row.key, row.keyEnv),
          models: [...row.models.values()],
        }))
        return { fromMs: from, toMs: to, calls, totals, keys }
      } catch (error) {
        console.warn('[dsh-task-notice] 消耗统计查询失败: ' + String(error?.message ?? error))
        return empty()
      }
    },

    // ── 使用分析(0.3.1)──────────────────────────────────────────────────────
    // 分析查询以 0..now 全量账本为输入:Token Plan 计费周期统计(回本 / 上一轮
    // 性价比 / 加权平均摊薄)不受展示时间范围限制,展示部分(饼图 / Key 额度 /
    // 每日表)按 fromMs..toMs 过滤。计划周期惰性轮换(到期自动归档为上一轮),
    // 轮换结果经 applyConfigPatch 持久化到 config.json。
    getUsageAnalysis(fromMs, toMs) {
      const from = typeof fromMs === 'number' && Number.isFinite(fromMs) ? fromMs : 0
      const to = typeof toMs === 'number' && Number.isFinite(toMs) ? toMs : Date.now()
      const empty = () => ({ fromMs: from, toMs: to, currency: '¥', models: [], keys: [], rankings: [], daily: [], maxDailyCost: 0 })
      if (store === null || store === undefined) return empty()
      try {
        const now = Date.now()
        const cfg = config()
        // 身份归一:分析内部按 entry.key 分组/取计划,键改为 provider id
        const entries = store.query(0, now).map((e) => ({ ...e, key: identityOfEntry(e) }))
        const result = computeAnalysis({
          entries,
          pricing: cfg.pricing,
          plans: cfg.plans,
          peak: cfg.peak,
          fromMs: from,
          toMs: to,
          now,
        })
        // 惰性轮换:周期已到期 → 归档上一轮并持久化新的周期边界
        if (Array.isArray(result.rotations) && result.rotations.length > 0) {
          try {
            const nextPlans = { ...(cfg.plans || {}) }
            for (const r of result.rotations) nextPlans[r.key] = r.plan
            applyConfigPatch({ plans: nextPlans })
          } catch (error) {
            console.warn('[dsh-task-notice] Token Plan 周期轮换持久化失败: ' + String(error?.message ?? error))
          }
        }
        const dir = dirState().list
        return {
          fromMs: result.fromMs,
          toMs: result.toMs,
          currency: result.currency,
          models: result.models,
          keys: result.keys.map((k) => ({ ...k, keyEnv: keyEnvOf(k.key, dir), providerName: displayNameOf(k.key, dir) })),
          rankings: result.rankings,
          daily: result.daily,
          maxDailyCost: result.maxDailyCost,
        }
      } catch (error) {
        console.warn('[dsh-task-notice] 使用分析查询失败: ' + String(error?.message ?? error))
        return empty()
      }
    },

    // Token Plan 手动重置当前计费周期:把 [cycleStart, now] 归档为上一轮
    // (prevCycle),从 now 开始新周期。只影响 Token Plan 回本 / 性价比 / 每日
    // 摊薄计算,不影响消耗总额统计。
    resetPlanCycle(key, fromMs, toMs) {
      const k = typeof key === 'string' ? key : ''
      if (k !== '') {
        try {
          const now = Date.now()
          const cfg = config()
          const plans = cfg.plans || {}
          const plan = plans[k]
          if (plan !== undefined && plan !== null && plan.enabled === true) {
            const cycleStart = plan.cycleStart > 0 ? plan.cycleStart : (plan.startAt > 0 ? plan.startAt : now)
            const cycleEnd = plan.cycleEnd > 0 ? plan.cycleEnd : planCycleEnd(cycleStart, plan.resetMode, plan.periodDays)
            const end = Math.min(cycleEnd, now)
            let tokens = 0
            let cost = 0
            if (store !== null && store !== undefined && end > cycleStart) {
              for (const e of store.query(cycleStart, end)) {
                tokens += (e.cacheIn ?? 0) + (e.cacheOut ?? 0) + (e.output ?? 0) + (e.cacheWrite ?? 0) + (e.reasoning ?? 0)
                cost += costOf(e, tierForEntry(priceFor(cfg.pricing, e.key, e.model), e.at, cfg.peak, isLegacyEntry(e)))
              }
            }
            const updated = {
              ...plan,
              cycleStart: now,
              cycleEnd: planCycleEnd(now, plan.resetMode, plan.periodDays),
              prevCycle: { start: cycleStart, end, fee: plan.fee, tokens, cost },
            }
            applyConfigPatch({ plans: { ...plans, [k]: updated } })
          }
        } catch (error) {
          console.warn('[dsh-task-notice] Token Plan 周期重置失败: ' + String(error?.message ?? error))
        }
      }
      return service.getUsageAnalysis(fromMs, toMs)
    },

    async *subscribeNotifications(signal) {
      if (hub === null || hub === undefined) return
      yield* hub.subscribe(signal)
    },
    /** 内置官方价格目录(双币种 + 峰谷子档),供设置页「官方价」一键填充。 */
    getPriceCatalog() {
      return OFFICIAL_PRICE_CATALOG
    },
    /** 清除全部消耗账目(usage.json),返回被清除的条数。仅清除统计数据,
     * 价格 / 套餐 / 峰谷 / Provider 目录配置保留。调用前由前端完成滑条 + 验证码
     * + 双击确认的安全流程;服务端对 store 为空或不可用时安全返回 cleared: 0。 */
    clearUsage() {
      if (store === null || store === undefined || typeof store.clear !== 'function') return { cleared: 0 }
      try {
        return { cleared: store.clear() }
      } catch (error) {
        console.warn('[dsh-task-notice] 清除消耗账本失败: ' + String(error?.message ?? error))
        return { cleared: 0 }
      }
    },

    // ── Provider 目录(0.3.2)────────────────────────────────────────────────
    // 首次读取时目录尚未抓取(updatedAt=0 或 list 为空,如宿主服务晚于插件就绪,
    // 或首次启动还没有账目)→ 自动重扫一次,保证「首次启动/无数据时」能列出
    // 全局模型设置里已配置的 Provider(显示名 + 所含模型)。
    getProviderDirectory() {
      const first = dirState()
      if ((first.updatedAt === 0 || first.list.length === 0) && providerIO && typeof providerIO.refresh === 'function') {
        try { providerIO.refresh() } catch (error) { console.warn('[dsh-task-notice] Provider 目录自动抓取失败: ' + String(error?.message ?? error)) }
      }
      const d = dirState()
      return { version: d.version, updatedAt: d.updatedAt, removed: [...(d.removed || [])], list: d.list.map((p) => ({ ...p, models: [...(p.models || [])] })) }
    },
    /** 重扫全局模型设置 + 账本观测,持久化后返回最新目录。 */
    refreshProviderDirectory() {
      if (providerIO && typeof providerIO.refresh === 'function') providerIO.refresh()
      const d = dirState()
      return { version: d.version, updatedAt: d.updatedAt, removed: [...(d.removed || [])], list: d.list.map((p) => ({ ...p, models: [...(p.models || [])] })) }
    },
    /** 删除失效 Provider ID:目录移除 + 加入 removed(重扫不再复活)+ 删除其 Token Plan。 */
    deleteProviderId(id) {
      const pid = typeof id === 'string' ? id.trim() : ''
      if (pid !== '' && providerIO && typeof providerIO.remove === 'function') providerIO.remove(pid)
      const d = dirState()
      return { version: d.version, updatedAt: d.updatedAt, removed: [...(d.removed || [])], list: d.list.map((p) => ({ ...p, models: [...(p.models || [])] })) }
    },
  }
  // Hand-written typertRemote binding so the Gateway accepts the strict
  // descriptors from our manually registered manifest (same pattern as
  // dsh-cost-meter): value.service must reference this exact object.
  Object.defineProperty(service, 'typertRemote', {
    configurable: false,
    enumerable: false,
    writable: false,
    value: { service, serviceKey: 'taskNotice', namespace: 'taskNotice' },
  })
  return service
}
