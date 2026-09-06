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

  const configSchema = z.object({
    enabled: z.boolean(),
    notifyOnTurn: z.boolean(),
    notifyOnGoal: z.boolean(),
    popupSeconds: num,
    storeDays: num,
    webNotify: z.boolean(),
    webNotifyBackgroundOnly: z.boolean(),
  })

  const configPatchSchema = z.object({
    enabled: z.boolean().optional(),
    notifyOnTurn: z.boolean().optional(),
    notifyOnGoal: z.boolean().optional(),
    popupSeconds: num.min(3).max(120).optional(),
    storeDays: num.min(1).max(3650).optional(),
    webNotify: z.boolean().optional(),
    webNotifyBackgroundOnly: z.boolean().optional(),
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
    models: z.array(modelStatSchema),
  })

  const usageStatsSchema = z.object({
    fromMs: num,
    toMs: num,
    calls: num,
    totals: bucketSchema,
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
    key: str.nullable(),
    provider: str.nullable(),
    model: str.nullable(),
    goal: goalFrameSchema,
  })

  const _healthCodec = { mode: 'strict', typeSymbol: 'dsh-task-notice#HealthState', schema: healthSchema }
  const _configCodec = { mode: 'strict', typeSymbol: 'dsh-task-notice#ConfigState', schema: configSchema }
  const _patchCodec = { mode: 'strict', typeSymbol: 'dsh-task-notice#ConfigPatch', schema: configPatchSchema }
  const _usageCodec = { mode: 'strict', typeSymbol: 'dsh-task-notice#UsageStats', schema: usageStatsSchema }
  const _frameCodec = { mode: 'strict', typeSymbol: 'dsh-task-notice#NotificationFrame', schema: frameSchema }
  const _fromCodec = { mode: 'strict', typeSymbol: 'dsh-task-notice#FromMs', schema: num }
  const _toCodec = { mode: 'strict', typeSymbol: 'dsh-task-notice#ToMs', schema: num }

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
            { kind: 'method', name: 'subscribeNotifications', signature: 'subscribeNotifications(signal?: AbortSignal): AsyncIterable<NotificationFrame>', summary: '订阅任务完成通知流。', jsDoc: '/** 订阅任务完成通知流 */' },
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