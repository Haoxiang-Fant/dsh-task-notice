/**
 * taskNotice Typert host manifest (Host face, zod v4 strict codecs).
 *
 * Registered through the typert-loader automatic scan: package.json exports
 * `./typert` and this module default-exports the TYPERT contribution object,
 * exactly like dsh-cost-meter / the generated @deepseek-ai packages. That
 * loader path is what publishes the namespace to the client Remote gateway —
 * a manual `ctx.typert.register()` alone never exposes the service methods
 * to the browser half.
 *
 * IMPORTANT (安全启动): lib/index.js never imports this module, so a zod
 * resolution failure only makes the typert-loader log one registration
 * error for this package; DSH keeps booting and the host-side accounting /
 * notifications still run (only the Remote settings surface degrades).
 */

import { z } from 'zod'

  const num = z.number()
  const str = z.string()

  const bucketSchema = z.object({
    cacheIn: num,
    cacheOut: num,
    output: num,
    cacheWrite: num,
    reasoning: num,
  })

  const reasonSchema = z.object({
    code: str,
    message: str,
    detail: str.optional(),
  })

  const healthSchema = z.object({
    enabled: z.boolean(),
    dshVersion: str,
    nodeVersion: str,
    pluginVersion: str,
    reasons: z.array(reasonSchema),
  })

  // 价格与 Token Plan 订阅(0.3):pricing = 自定义单价,plans = 按 Key 的订阅
  const priceSchema = z.object({
    cacheIn: num.optional(),
    cacheOut: num.optional(),
    output: num.optional(),
    cacheWrite: num.optional(),
    reasoning: num.optional(),
    peak: z.object({
      offPeak: z.record(z.string(), num).optional(),
      peak: z.record(z.string(), num).optional(),
    }).optional(),
  })

  // 0.3.1:模型价格跨 Key 合并;enabled=false(未激活)的模型按官方价计费,不入库
  const modelPricingSchema = z.object({
    enabled: z.boolean(),
    price: priceSchema,
  })

  const pricingSchema = z.object({
    currency: z.enum(['¥', '$']),
    default: priceSchema,
    models: z.record(z.string(), modelPricingSchema),
  })

  // 0.3.1 Token Plan 计费周期:startAt 套餐起效时间 / periodDays 有效期(默认 31 天)
  // / resetMode 'monthly' = 每月 1 号(UTC+0)自动重置;cycleStart/cycleEnd 由服务端
  // 惰性维护;prevCycle 记录上一轮周期(自动轮换或手动重置归档)。
  const planPrevCycleSchema = z.object({
    start: num,
    end: num,
    fee: num,
    tokens: num,
    cost: num,
  })
  const planStateSchema = z.object({
    enabled: z.boolean(),
    fee: num,
    credits: num,
    startAt: num.optional(),
    periodDays: num.optional(),
    resetMode: z.enum(['days', 'monthly']).optional(),
    cycleStart: num.optional(),
    cycleEnd: num.optional(),
    prevCycle: planPrevCycleSchema.nullable().optional(),
  })

  const plansSchema = z.record(z.string(), planStateSchema)

  // 峰谷计价配置(DeepSeek 等按时段取价)
  const peakCfgSchema = z.object({
    enabled: z.boolean(),
    windows: z.array(z.object({ start: num, end: num })),
    weekdaysOnly: z.boolean(),
    boundaryMs: num,
  })

  // 内置官方价格目录(双币种 + 峰谷子档)
  const catalogEntrySchema = z.object({
    cny: z.record(z.string(), num),
    usd: z.record(z.string(), num),
    match: z.array(str).optional(),
    source: str.optional(),
    peak: z.object({
      offPeak: z.object({ cny: z.record(z.string(), num), usd: z.record(z.string(), num) }).optional(),
      peak: z.object({ cny: z.record(z.string(), num), usd: z.record(z.string(), num) }).optional(),
    }).optional(),
  })
  const priceCatalogSchema = z.record(z.string(), catalogEntrySchema)

  const configSchema = z.object({
    enabled: z.boolean(),
    notifyOnTurn: z.boolean(),
    notifyOnGoal: z.boolean(),
    notifyOnApproval: z.boolean(),
    notifyOnQuestion: z.boolean(),
    popupSeconds: num,
    storeDays: num,
    webNotify: z.boolean(),
    webNotifyBackgroundOnly: z.boolean(),
    pricing: pricingSchema,
    plans: plansSchema,
    peak: peakCfgSchema,
  })

  const configPatchSchema = z.object({
    enabled: z.boolean().optional(),
    notifyOnTurn: z.boolean().optional(),
    notifyOnGoal: z.boolean().optional(),
    notifyOnApproval: z.boolean().optional(),
    notifyOnQuestion: z.boolean().optional(),
    popupSeconds: num.min(3).max(120).optional(),
    storeDays: num.min(1).max(3650).optional(),
    webNotify: z.boolean().optional(),
    webNotifyBackgroundOnly: z.boolean().optional(),
    pricing: pricingSchema.optional(),
    plans: plansSchema.optional(),
    peak: peakCfgSchema.optional(),
  })

  const modelStatSchema = z.object({
    provider: str,
    model: str,
    calls: num,
    cacheIn: num,
    cacheOut: num,
    output: num,
    cacheWrite: num,
    reasoning: num,
    cost: num,
  })

  const keyStatSchema = z.object({
    key: str,
    provider: str,
    calls: num,
    cacheIn: num,
    cacheOut: num,
    output: num,
    cacheWrite: num,
    reasoning: num,
    cost: num,
    plan: planStateSchema.nullable(),
    models: z.array(modelStatSchema),
  })

  const costedBucketSchema = bucketSchema.extend({ cost: num })

  const usageStatsSchema = z.object({
    fromMs: num,
    toMs: num,
    calls: num,
    totals: costedBucketSchema,
    keys: z.array(keyStatSchema),
  })

  const goalFrameSchema = z.object({
    objective: str,
    roundsStarted: num.optional(),
  }).nullable()

  const frameSchema = z.object({
    id: str,
    type: z.enum(['turn', 'goal']),
    atMs: num,
    sessionId: str,
    title: str,
    summary: str,
    tokens: bucketSchema,
    total: num,
    cost: num,
    currency: str,
    key: str.nullable(),
    provider: str.nullable(),
    model: str.nullable(),
    goal: goalFrameSchema,
  })

  // ── 使用分析(0.3.1)──────────────────────────────────────────────────────
  const analysisModelSchema = z.object({
    brand: str,
    provider: str,
    model: str,
    calls: num,
    cacheIn: num,
    cacheOut: num,
    output: num,
    cacheWrite: num,
    reasoning: num,
    tokens: num,
    cost: num,
  })

  const analysisPlanSchema = z.object({
    enabled: z.boolean(),
    fee: num,
    credits: num,
    startAt: num,
    periodDays: num,
    resetMode: z.enum(['days', 'monthly']),
    cycleStart: num,
    cycleEnd: num,
    cycleTokens: num,
    cycleCost: num,
    brokenEven: z.boolean(),
    tokensPerCredit: num.nullable(),
    effectiveRate: num,
    prevCycle: planPrevCycleSchema.nullable(),
  })

  const analysisKeyModelSchema = z.object({
    model: str,
    provider: str,
    calls: num,
    tokens: num,
    cost: num,
  })

  const analysisKeySchema = z.object({
    key: str,
    provider: str,
    calls: num,
    tokens: num,
    cost: num,
    models: z.array(analysisKeyModelSchema),
    plan: analysisPlanSchema.nullable(),
  })

  const analysisRankingSchema = z.object({
    key: str,
    model: str,
    brand: str,
    usingPrev: z.boolean(),
    collecting: z.boolean(),
    tokens: num,
    amount: num,
    ratio: num,
  })

  const analysisDailyModelSchema = z.object({
    model: str,
    tokens: num,
    cost: num,
    planWeighted: z.boolean(),
  })

  const analysisDailySchema = z.object({
    date: str,
    ts: num,
    tokens: num,
    cost: num,
    models: z.array(analysisDailyModelSchema),
  })

  const usageAnalysisSchema = z.object({
    fromMs: num,
    toMs: num,
    currency: str,
    models: z.array(analysisModelSchema),
    keys: z.array(analysisKeySchema),
    rankings: z.array(analysisRankingSchema),
    daily: z.array(analysisDailySchema),
    maxDailyCost: num,
  })

  // 清除记录数据(0.3.1):返回被清除的账目条数
  const clearResultSchema = z.object({
    cleared: num,
  })

  const _healthCodec = { mode: 'strict', typeSymbol: 'dsh-task-notice#HealthState', schema: healthSchema }
  const _configCodec = { mode: 'strict', typeSymbol: 'dsh-task-notice#ConfigState', schema: configSchema }
  const _patchCodec = { mode: 'strict', typeSymbol: 'dsh-task-notice#ConfigPatch', schema: configPatchSchema }
  const _usageCodec = { mode: 'strict', typeSymbol: 'dsh-task-notice#UsageStats', schema: usageStatsSchema }
  const _frameCodec = { mode: 'strict', typeSymbol: 'dsh-task-notice#NotificationFrame', schema: frameSchema }
  const _catalogCodec = { mode: 'strict', typeSymbol: 'dsh-task-notice#PriceCatalog', schema: priceCatalogSchema }
  const _fromCodec = { mode: 'strict', typeSymbol: 'dsh-task-notice#FromMs', schema: num }
  const _toCodec = { mode: 'strict', typeSymbol: 'dsh-task-notice#ToMs', schema: num }
  const _analysisCodec = { mode: 'strict', typeSymbol: 'dsh-task-notice#UsageAnalysis', schema: usageAnalysisSchema }
  const _keyCodec = { mode: 'strict', typeSymbol: 'dsh-task-notice#PlanKey', schema: str }
  const _clearResultCodec = { mode: 'strict', typeSymbol: 'dsh-task-notice#ClearResult', schema: clearResultSchema }

  const TYPERT = {
    package: 'dsh-task-notice',
    face: 'host',
    schemas: [],
    invocations: [
      {
        id: 'dsh-task-notice#taskNotice/getHealth',
        service: 'taskNotice',
        namespace: 'taskNotice',
        method: 'getHealth',
        invocation: { kind: 'direct' },
        parameters: [],
        result: _healthCodec,
      },
      {
        id: 'dsh-task-notice#taskNotice/getConfig',
        service: 'taskNotice',
        namespace: 'taskNotice',
        method: 'getConfig',
        invocation: { kind: 'direct' },
        parameters: [],
        result: _configCodec,
      },
      {
        id: 'dsh-task-notice#taskNotice/updateConfig',
        service: 'taskNotice',
        namespace: 'taskNotice',
        method: 'updateConfig',
        invocation: { kind: 'direct' },
        parameters: [
          { name: 'patch', wire: 'patch', source: 'json', codec: _patchCodec },
        ],
        result: _configCodec,
      },
      {
        id: 'dsh-task-notice#taskNotice/getUsageStats',
        service: 'taskNotice',
        namespace: 'taskNotice',
        method: 'getUsageStats',
        invocation: { kind: 'direct' },
        parameters: [
          { name: 'fromMs', wire: 'fromMs', source: 'json', codec: _fromCodec },
          { name: 'toMs', wire: 'toMs', source: 'json', codec: _toCodec },
        ],
        result: _usageCodec,
      },
      {
        id: 'dsh-task-notice#taskNotice/subscribeNotifications',
        service: 'taskNotice',
        namespace: 'taskNotice',
        method: 'subscribeNotifications',
        invocation: { kind: 'direct' },
        mode: 'stream',
        parameters: [],
        cancellation: { parameter: 'signal' },
        result: _frameCodec,
      },
      {
        id: 'dsh-task-notice#taskNotice/getPriceCatalog',
        service: 'taskNotice',
        namespace: 'taskNotice',
        method: 'getPriceCatalog',
        invocation: { kind: 'direct' },
        parameters: [],
        result: _catalogCodec,
      },
      {
        id: 'dsh-task-notice#taskNotice/getUsageAnalysis',
        service: 'taskNotice',
        namespace: 'taskNotice',
        method: 'getUsageAnalysis',
        invocation: { kind: 'direct' },
        parameters: [
          { name: 'fromMs', wire: 'fromMs', source: 'json', codec: _fromCodec },
          { name: 'toMs', wire: 'toMs', source: 'json', codec: _toCodec },
        ],
        result: _analysisCodec,
      },
      {
        id: 'dsh-task-notice#taskNotice/resetPlanCycle',
        service: 'taskNotice',
        namespace: 'taskNotice',
        method: 'resetPlanCycle',
        invocation: { kind: 'direct' },
        parameters: [
          { name: 'key', wire: 'key', source: 'json', codec: _keyCodec },
          { name: 'fromMs', wire: 'fromMs', source: 'json', codec: _fromCodec },
          { name: 'toMs', wire: 'toMs', source: 'json', codec: _toCodec },
        ],
        result: _analysisCodec,
      },
      {
        id: 'dsh-task-notice#taskNotice/clearUsage',
        service: 'taskNotice',
        namespace: 'taskNotice',
        method: 'clearUsage',
        invocation: { kind: 'direct' },
        parameters: [],
        result: _clearResultCodec,
      },
    ],
    model: {
      services: [
        {
          description: 'dsh-task-notice 任务通知与消耗统计服务(task completion notifications and per-key token usage statistics).',
          summary: 'dsh-task-notice 服务',
          tags: [],
          jsDoc: '/** dsh-task-notice 服务 */',
          key: 'taskNotice',
          exportName: 'TaskNoticeService',
          members: [
            { kind: 'method', name: 'getHealth', signature: 'getHealth(): HealthState', summary: '读取插件健康状态与安全启动原因。', jsDoc: '/** 读取插件健康状态 */' },
            { kind: 'method', name: 'getConfig', signature: 'getConfig(): ConfigState', summary: '读取当前配置。', jsDoc: '/** 读取当前配置 */' },
            { kind: 'method', name: 'updateConfig', signature: 'updateConfig(patch: ConfigPatch): ConfigState', summary: '更新通知与统计配置。', jsDoc: '/** 更新通知与统计配置 */' },
            { kind: 'method', name: 'getUsageStats', signature: 'getUsageStats(fromMs: number, toMs: number): UsageStats', summary: '按时间范围查询各 Key 的 Token 消耗。', jsDoc: '/** 按时间范围查询各 Key 的 Token 消耗 */' },
            { kind: 'method', name: 'getUsageAnalysis', signature: 'getUsageAnalysis(fromMs: number, toMs: number): UsageAnalysis', summary: '使用分析:模型金额占比 / Key 额度 / Token Plan 回本与计费周期 / 性价比排名(所有 Key·模型)/ 每日消耗。', jsDoc: '/** 使用分析 */' },
            { kind: 'method', name: 'resetPlanCycle', signature: 'resetPlanCycle(key: string, fromMs: number, toMs: number): UsageAnalysis', summary: '手动重置指定 Key 的 Token Plan 当前计费周期(归档为上一轮)。', jsDoc: '/** 重置 Token Plan 计费周期 */' },
            { kind: 'method', name: 'clearUsage', signature: 'clearUsage(): ClearResult', summary: '清除全部 Token 消耗统计账目(usage.json),返回清除条数;价格/套餐/峰谷配置保留。', jsDoc: '/** 清除消耗统计账本 */' },
            { kind: 'method', name: 'subscribeNotifications', signature: 'subscribeNotifications(signal?: AbortSignal): AsyncIterable<NotificationFrame>', summary: '订阅任务完成通知流。', jsDoc: '/** 订阅任务完成通知流 */' },
            { kind: 'method', name: 'getPriceCatalog', signature: 'getPriceCatalog(): PriceCatalog', summary: '内置官方价格目录(双币种+峰谷子档),供一键填充。', jsDoc: '/** 读取内置官方价格目录 */' },
          ],
          types: [],
        },
      ],
      events: [],
      objects: [],
    },
  }

export { TYPERT }
export default TYPERT