/**
 * taskNotice Typert service (host side, hand-written manifest in typert.host.js).
 *
 * Methods (all must exist on the object provided via ctx.provide('taskNotice', …)):
 *   getHealth()                          → HealthState
 *   getConfig()                          → ConfigState
 *   updateConfig(patch)                  → ConfigState
 *   getUsageStats(fromMs, toMs)          → UsageStats
 *   subscribeNotifications(signal)       → AsyncIterable<NotificationFrame>
 *
 * When the safe-start gate disabled the plugin the same service object is
 * provided with a null store and a live hub: getHealth reports the reasons,
 * getUsageStats returns an empty result, and the notification stream stays
 * silent — DSH itself keeps running untouched.
 */

export function createTaskNoticeService({ health, config, store, hub, applyConfigPatch }) {
  const service = {
    getHealth() {
      return health()
    },
    getConfig() {
      return config()
    },
    updateConfig(patch) {
      if (typeof applyConfigPatch === 'function') {
        applyConfigPatch(patch)
      }
      return config()
    },
    getUsageStats(fromMs, toMs) {
      const from = typeof fromMs === 'number' && Number.isFinite(fromMs) ? fromMs : 0
      const to = typeof toMs === 'number' && Number.isFinite(toMs) ? toMs : Date.now()
      const empty = () => ({ fromMs: from, toMs: to, calls: 0, totals: { cacheIn: 0, cacheOut: 0, output: 0, cacheWrite: 0, reasoning: 0 }, keys: [] })
      if (store === null || store === undefined) return empty()
      try {
        const entries = store.query(from, to)
        const byKey = new Map()
        let calls = 0
        const totals = { cacheIn: 0, cacheOut: 0, output: 0, cacheWrite: 0, reasoning: 0 }
        for (const e of entries) {
          calls += 1
          totals.cacheIn += e.cacheIn ?? 0
          totals.cacheOut += e.cacheOut ?? 0
          totals.output += e.output ?? 0
          totals.cacheWrite += e.cacheWrite ?? 0
          totals.reasoning += e.reasoning ?? 0
          const key = typeof e.key === 'string' && e.key !== '' ? e.key : 'unknown'
          let row = byKey.get(key)
          if (row === undefined) {
            row = { key, provider: e.provider ?? '', calls: 0, cacheIn: 0, cacheOut: 0, output: 0, cacheWrite: 0, reasoning: 0, models: new Map() }
            byKey.set(key, row)
          }
          row.calls += 1
          row.cacheIn += e.cacheIn ?? 0
          row.cacheOut += e.cacheOut ?? 0
          row.output += e.output ?? 0
          row.cacheWrite += e.cacheWrite ?? 0
          row.reasoning += e.reasoning ?? 0
          const model = typeof e.model === 'string' && e.model !== '' ? e.model : 'unknown'
          let m = row.models.get(model)
          if (m === undefined) {
            m = { provider: e.provider ?? '', model, calls: 0, cacheIn: 0, cacheOut: 0, output: 0, cacheWrite: 0, reasoning: 0 }
            row.models.set(model, m)
          }
          m.calls += 1
          m.cacheIn += e.cacheIn ?? 0
          m.cacheOut += e.cacheOut ?? 0
          m.output += e.output ?? 0
          m.cacheWrite += e.cacheWrite ?? 0
          m.reasoning += e.reasoning ?? 0
        }
        const keys = [...byKey.values()].map((row) => ({
          key: row.key,
          provider: row.provider,
          calls: row.calls,
          cacheIn: row.cacheIn,
          cacheOut: row.cacheOut,
          output: row.output,
          cacheWrite: row.cacheWrite,
          reasoning: row.reasoning,
          models: [...row.models.values()],
        }))
        return { fromMs: from, toMs: to, calls, totals, keys }
      } catch (error) {
        console.warn('[dsh-task-notice] 消耗统计查询失败: ' + String(error?.message ?? error))
        return empty()
      }
    },
    async *subscribeNotifications(signal) {
      if (hub === null || hub === undefined) return
      yield* hub.subscribe(signal)
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
