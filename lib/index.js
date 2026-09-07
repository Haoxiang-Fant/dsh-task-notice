/**
 * dsh-task-notice 宿主插件。
 *
 * 功能:
 *  1. 完工通知 —— 折叠会话日志,在代理完成任务(turn/end completed、goal
 *     complete)时推送通知帧给浏览器端:页内弹窗 + 经浏览器 Web
 *     Notifications API 发送 Windows 系统通知(桌面横幅与操作中心,
 *     需页面授权,点击通知回到本页面),展示本次消耗的 tokens
 *     (缓存输入 / 缓外输入 / 输出)。
 *     代理需要你操作时同样会提醒:权限请求(approval/request)与
 *     用户提问(user-questions/request)由浏览器端经 Remote 事件
 *     观察后触发页内弹窗 + 系统通知(纯观察,不拦截应答链)。
 *  2. 消耗统计 —— 包裹 llm/stream 瀑布,捕获每次模型调用的 usage 块,按
 *     使用的 API Key(凭证引用)归账到 $DSH_HOME/storages/task-notice/
 *     usage.json;浏览器端设置页可按 1年/6个月/3个月/1个月/15天/1周/
 *     24小时/自定义 时间范围查询各 Key 与各模型的 Token 消耗。
 *  3. 安全启动 —— apply() 先跑安全启动门(safe-start.js):DSH 版本不兼容、
 *     冲突插件、重复挂载、命名空间冲突任一命中即取消插件运行;并且本模块
 *     除 Node 内建模块与自身模块外**没有任何顶层外部 import**(zod 只在
 *     lib/typert.host.js 顶层 import,而该文件由 typert-loader 直接加载,
 *     不经本模块),因此即使依赖解析失败(如 Windows `link:` 安装的
 *     junction realpath 陷阱),也只会让本插件的 Typert 清单注册失败,
 *     DSH 照常启动。
 *
 * 依赖纪律:运行期可用的服务(session/settings/credentials/typert/loader/
 * llm)一律经 `ctx` 访问;本模块保持零顶层外部依赖。Typert 清单
 * (lib/typert.host.js)通过 package.json 的 `exports["./typert"]` 由
 * typert-loader 自动扫描注册——这是把 taskNotice 服务发布到浏览器
 * Remote 网关的唯一通道(手动 ctx.typert.register() 不会生成 remote
 * 方法面)。这是社区插件踩过的最深坑的根治:一个不存在的命名导出或
 * 一个解析不到的 import 会在模块求值期抛 SyntaxError /
 * ERR_MODULE_NOT_FOUND,让整个 dsh 启动失败——本插件从结构上杜绝了这种可能。
 */
import fs from 'node:fs'
import os from 'node:os'
import { join } from 'node:path'
import { checkSafeStart, findDshHostInfo } from './safe-start.js'
import { openStore } from './store.js'
import { resolveKeyLabel } from './keys.js'
import { createUsageCapture, bucketsFromUsage } from './accounting.js'
import { createCompletionTracker } from './fold.js'
import { createNotificationHub, frameId } from './notify.js'
import { createTaskNoticeService } from './service.js'

export const name = 'task-notice'

const PLUGIN_VERSION = '0.2.0'
const DAY_MS = 24 * 60 * 60 * 1000

/** Composition defaults; loader row `config:` overrides these. */
const CONFIG_DEFAULTS = {
  enabled: true,
  notifyOnTurn: true,
  notifyOnGoal: true,
  notifyOnApproval: true, // 权限请求提醒
  notifyOnQuestion: true, // 提问(需要用户回答)提醒
  popupSeconds: 15,
  storeDays: 365,
  webNotify: true, // 浏览器系统通知(Web Notifications API,需页面授权)
  webNotifyBackgroundOnly: true, // 仅页面隐藏/后台时才发系统通知(前台用页内弹窗)
}

/** Safe-start parameters (not user-overridable at runtime). */
const SAFE_DEFAULTS = {
  requiredDshVersion: '>=0.1.0-rc.5',
  conflictingPlugins: [],
}

function dshHomeDir() {
  try {
    if (typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME.trim() !== '') {
      return process.env.DSH_HOME.trim()
    }
  } catch { /* ignore */ }
  try {
    return join(os.homedir(), '.dsh')
  } catch {
    return '.dsh'
  }
}

function readJsonFile(path, fallback) {
  try {
    const raw = JSON.parse(fs.readFileSync(path, 'utf8'))
    return raw === undefined ? fallback : raw
  } catch {
    return fallback
  }
}

function writeJsonFile(dir, path, value) {
  try {
    fs.mkdirSync(dir, { recursive: true })
    const tmp = path + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8')
    fs.renameSync(tmp, path)
  } catch { /* best-effort persistence */ }
}

function fmt(n) {
  return typeof n === 'number' ? n.toLocaleString('en-US') : String(n ?? 0)
}

function bucketTotals(b) {
  return (b?.cacheIn ?? 0) + (b?.cacheOut ?? 0) + (b?.output ?? 0) + (b?.cacheWrite ?? 0) + (b?.reasoning ?? 0)
}

export async function apply(ctx, entryConfig = {}) {
  const home = dshHomeDir()
  const storeDir = join(home, 'storages', 'task-notice')
  const configPath = join(storeDir, 'config.json')

  let store = null
  let hub = createNotificationHub()
  let retentionTimer = null
  let gateReasons = []
  let gatePassed = false

  // ── 配置(loader 组合层 + 运行期覆盖,覆盖层持久化在 config.json) ─────────
  let overrides = {}
  try {
    const loaded = readJsonFile(configPath, null)
    if (loaded && typeof loaded === 'object') overrides = loaded
  } catch { /* ignore */ }

  const readConfig = () => ({ ...CONFIG_DEFAULTS, ...SAFE_DEFAULTS, ...(entryConfig ?? {}), ...overrides })
  const clampPopup = (v) => (typeof v === "number" ? Math.min(120, Math.max(3, Math.round(v))) : 15)
  const clampDays = (v) => (typeof v === "number" ? Math.min(3650, Math.max(1, Math.round(v))) : 365)
  const configView = () => {
    const c = readConfig()
    return {
      enabled: c.enabled !== false,
      notifyOnTurn: c.notifyOnTurn !== false,
      notifyOnGoal: c.notifyOnGoal !== false,
      notifyOnApproval: c.notifyOnApproval !== false,
      notifyOnQuestion: c.notifyOnQuestion !== false,
      popupSeconds: clampPopup(c.popupSeconds),
      storeDays: clampDays(c.storeDays),
      webNotify: c.webNotify !== false,
      webNotifyBackgroundOnly: c.webNotifyBackgroundOnly !== false,
    }
  }
  const applyConfigPatch = (patch) => {
    if (patch === null || typeof patch !== 'object') return
    const clean = {}
    if (typeof patch.enabled === 'boolean') clean.enabled = patch.enabled
    if (typeof patch.notifyOnTurn === 'boolean') clean.notifyOnTurn = patch.notifyOnTurn
    if (typeof patch.notifyOnGoal === 'boolean') clean.notifyOnGoal = patch.notifyOnGoal
    if (typeof patch.notifyOnApproval === 'boolean') clean.notifyOnApproval = patch.notifyOnApproval
    if (typeof patch.notifyOnQuestion === 'boolean') clean.notifyOnQuestion = patch.notifyOnQuestion
    if (typeof patch.popupSeconds === 'number') clean.popupSeconds = clampPopup(patch.popupSeconds)
    if (typeof patch.storeDays === 'number') clean.storeDays = clampDays(patch.storeDays)
    if (typeof patch.webNotify === 'boolean') clean.webNotify = patch.webNotify
    if (typeof patch.webNotifyBackgroundOnly === 'boolean') clean.webNotifyBackgroundOnly = patch.webNotifyBackgroundOnly
    if (Object.keys(clean).length === 0) return
    overrides = { ...overrides, ...clean }
    writeJsonFile(storeDir, configPath, overrides)
  }

  const host = findDshHostInfo()
  const health = () => ({
    enabled: gatePassed && readConfig().enabled !== false,
    dshVersion: host?.version ?? 'unknown',
    nodeVersion: process.version,
    pluginVersion: PLUGIN_VERSION,
    reasons: gateReasons,
  })

  // ── 安全启动门 ─────────────────────────────────────────────────────────────
  try {
    gateReasons = checkSafeStart(ctx, readConfig())
  } catch (error) {
    gateReasons = [{ code: 'gate-crash', message: '安全启动检测自身异常,已取消插件运行。', detail: String(error?.message ?? error) }]
  }
  gatePassed = gateReasons.length === 0
  if (gatePassed && readConfig().enabled === false) {
    gateReasons = [{ code: 'disabled-by-config', message: '插件已在配置中关闭(enabled: false)。' }]
    gatePassed = false
  }

    if (!gatePassed) {
    console.warn('[dsh-task-notice] 安全启动:插件已取消运行。原因: ' + gateReasons.map((r) => r.message).join(' | '))
    try {
      ctx.provide('taskNotice', createTaskNoticeService({ health, config: configView, store: null, hub, applyConfigPatch }))
    } catch (error) {
      console.warn('[dsh-task-notice] 停用态服务注册失败(不影响 DSH): ' + String(error?.message ?? error))
    }
    return
  }

  // ── 完整初始化(任何异常只使本插件失效) ─────────────────────────────────────
  try {
    // 消耗账本
    const retentionMs = () => clampDays(readConfig().storeDays) * DAY_MS
    store = openStore(retentionMs(), home)
    ctx.effect(() => () => { try { store.close() } catch { /* ignore */ } }, 'dsh-task-notice: store close')
    retentionTimer = setInterval(() => {
      try {
        if (store !== null) store.prune(retentionMs())
      } catch { /* ignore */ }
    }, 6 * 60 * 60 * 1000)
    if (retentionTimer && typeof retentionTimer.unref === 'function') retentionTimer.unref()
    ctx.effect(() => () => clearInterval(retentionTimer), 'dsh-task-notice: retention timer')

    // ① llm/stream 捕获 → 按 Key 记账
    ctx.on('llm/stream', createUsageCapture({
      account: (call) => {
        void (async () => {
          try {
            const { key, source } = resolveKeyLabel(ctx, call.provider)
            if (store === null) return
            const b = bucketsFromUsage(call.usage)
            store.append({
              id: frameId(),
              at: call.atMs,
              key,
              keySource: source,
              provider: call.provider ?? '',
              model: call.model ?? '',
              sessionId: call.sessionId ?? '',
              purpose: call.purpose ?? null,
              cacheIn: b.cacheIn,
              cacheOut: b.cacheOut,
              output: b.output,
              cacheWrite: b.cacheWrite,
              reasoning: b.reasoning,
            })
          } catch (error) {
            console.warn('[dsh-task-notice] 消耗记账失败: ' + String(error?.message ?? error))
          }
        })()
      },
    }))

    // ② 会话折叠 → 完工通知
    const tracker = createCompletionTracker({
      onTurn: ({ session, turn }) => {
        void (async () => {
          try {
            const cfg = readConfig()
            if (cfg.notifyOnTurn === false) return
            const header = turn.header
            const provider = header?.config?.provider ?? null
            const model = header?.config?.model ?? null
            let key = null
            try {
              key = resolveKeyLabel(ctx, provider).key
            } catch { /* key optional */ }
            const b = turn.buckets
            const total = bucketTotals(b)
            hub.push({
              id: frameId(),
              type: 'turn',
              atMs: turn.startedAt,
              sessionId: session.id,
              title: '任务完成',
              summary: '第 ' + turn.no + ' 轮任务已完成,本次消耗 ' + fmt(total) + ' tokens',
              tokens: { cacheIn: b.cacheIn, cacheOut: b.cacheOut, output: b.output, cacheWrite: b.cacheWrite, reasoning: b.reasoning },
              total,
              key,
              provider,
              model,
              goal: null,
            })
          } catch (error) {
            console.warn('[dsh-task-notice] 完工通知失败: ' + String(error?.message ?? error))
          }
        })()
      },
      onGoal: ({ session, goal, buckets }) => {
        void (async () => {
          try {
            const cfg = readConfig()
            if (cfg.notifyOnGoal === false) return
            const total = bucketTotals(buckets)
            hub.push({
              id: frameId(),
              type: 'goal',
              atMs: Date.now(),
              sessionId: session.id,
              title: '目标完成',
              summary: '目标「' + String(goal?.objective ?? '').slice(0, 60) + '」已完成,共消耗 ' + fmt(total) + ' tokens',
              tokens: { cacheIn: buckets.cacheIn, cacheOut: buckets.cacheOut, output: buckets.output, cacheWrite: buckets.cacheWrite, reasoning: buckets.reasoning },
              total,
              key: null,
              provider: null,
              model: null,
              goal: { objective: goal?.objective ?? '' },
            })
          } catch (error) {
            console.warn('[dsh-task-notice] 目标完成通知失败: ' + String(error?.message ?? error))
          }
        })()
      },
    })

    ctx.on('session/event', (session, event) => {
      if (session?.header?.origin === 'subagent') return
      try {
        tracker.onSessionEvent(session, event)
      } catch { /* fold must never break the session feed */ }
    })
    ctx.on('session/disposed', (session) => {
      try {
        tracker.onSessionDisposed(session)
      } catch { /* ignore */ }
    })

    // ③ RPC 服务
    ctx.provide('taskNotice', createTaskNoticeService({ health, config: configView, store, hub, applyConfigPatch }))

    console.log('[dsh-task-notice] 已启用:完工通知(页内弹窗 + 浏览器 Web Notifications 系统通知,需页面授权) + 按 Key 消耗统计(账本 ' + store.path + '),安全启动检查通过(DSH ' + (host?.version ?? 'unknown') + ')。')
  } catch (error) {
    console.error('[dsh-task-notice] 初始化失败,插件已取消运行(不影响 DSH 启动): ' + String(error?.message ?? error))
    gateReasons = [{ code: 'init-failed', message: '初始化失败,已取消插件运行。', detail: String(error?.message ?? error) }]
    try {
      ctx.provide('taskNotice', createTaskNoticeService({ health, config: configView, store: null, hub, applyConfigPatch }))
    } catch { /* ignore */ }
  }
}