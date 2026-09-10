/**
 * dsh-task-notice 宿主插件。
 *
 * 功能:
 *  1. 完工通知 —— 折叠会话日志,在代理完成任务(turn/end completed、goal
 *     complete)时推送通知帧给浏览器端:页内弹窗 + 经浏览器 Web
 *     Notifications API 发送 Windows 系统通知(桌面横幅与操作中心,
 *     需页面授权,点击通知回到本页面),展示本次消耗的 tokens
 *     (缓存输入 / 缓外输入 / 输出)与金额。
 *     代理需要你操作时同样会提醒:权限请求(approval/request)与
 *     用户提问(user-questions/request)由浏览器端经 Remote 事件
 *     观察后触发页内弹窗 + 系统通知(纯观察,不拦截应答链)。
 *  2. 消耗统计 —— 包裹 llm/stream 瀑布,捕获每次模型调用的 usage 块,按
 *     使用的 API Key(凭证引用)归账到 $DSH_HOME/storages/task-notice/
 *     usage.json;浏览器端设置页可按 1年/6个月/3个月/1个月/15天/1周/
 *     24小时/自定义 时间范围查询各 Key 与各模型的 Token 消耗。
 *  3. 价格计算 —— 模型价格**跨 Key 合并**:不同 Key 使用同一模型的调用都按
 *     该模型的价格计费;未激活自定义的模型默认按内置官方价目录计费,激活后
 *     可在「价格编辑」页面自定义。0.1/0.2 版本记录的旧账目默认按低谷价计费
 *     (旧数据没有峰谷语义)。峰谷计价(DeepSeek 等)按每次调用的时刻取档。
 *  4. Token Plan 重置(0.3.4) —— 模型调用返回 402/429(Token Plan 错误码)时
 *     标记该 Provider 待确认并弹「需要重置 Token Plan 吗?」;未回应则下次正常
 *     调用弹「是否续费了?」,确认续费后冻结旧周期(旧 TID)并开启新周期,期间
 *     消耗计入临时账本并与原周期合并显示;每个计费周期有唯一 TID(内部身份),
 *     回本 / 性价比只统计当前生效 TID,旧 TID 数据冻结并经「历史」按钮查阅。
 *
 * 依赖纪律:本模块除 Node 内建模块与自身模块外没有任何顶层外部 import,
 * 运行期可用的服务(session/settings/credentials/typert/loader/llm)一律经
 * `ctx` 访问;因此即使依赖解析失败(如 Windows `link:` 安装的 junction
 * realpath 陷阱),也只会让本插件的 Typert 清单注册失败,DSH 照常启动。
 */
import fs from 'node:fs'
import os from 'node:os'
import { readFileSync, realpathSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { openStore } from './store.js'
import { resolveKeyLabel } from './keys.js'
import { createUsageCapture, bucketsFromUsage } from './accounting.js'
import { createCompletionTracker } from './fold.js'
import { createNotificationHub, frameId } from './notify.js'
import { createTaskNoticeService } from './service.js'
import { DEFAULT_PRICING, DEFAULT_PLANS, DEFAULT_PEAK, ENTRY_VERSION, normalizePricing, normalizePlans, normalizePeak, priceFor, costOf, fmtMoney, tierForEntry } from './pricing.js'
import {
  normalizeProviderDirectory, scanProviderDirectory,
  mergeLedgerProviders, migratePlanKeysToProviders,
} from './providers.js'

export const name = 'task-notice'

const PLUGIN_VERSION = '0.3.4'
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
  // 价格(0.3.1 模型聚合):pricing.models = 跨 Key 合并的模型价,plans = 按 Key 的订阅
  pricing: DEFAULT_PRICING,
  plans: DEFAULT_PLANS,
  peak: DEFAULT_PEAK, // 峰谷计价(DeepSeek 等按时段取价)
  // Provider 目录(0.3.2):插件自维护;首次启动/无数据时从全局模型设置抓取
  providers: null, // { version, updatedAt, removed: [], list: [{ id, displayName, keyEnv, models }] }
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

/** 沿启动入口向上定位 @deepseek-ai/dsh 宿主包的版本(仅用于健康信息展示)。 */
function findDshHostInfo(entry = process.argv[1]) {
  if (entry === undefined) return null
  try {
    let directory = resolve(dirname(realpathSync(entry)))
    for (let depth = 0; depth < 12; depth += 1) {
      try {
        const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
        if (manifest.name === '@deepseek-ai/dsh') {
          return { version: typeof manifest.version === 'string' ? manifest.version : 'unknown', directory }
        }
      } catch { /* keep walking up */ }
      const parent = dirname(directory)
      if (parent === directory) break
      directory = parent
    }
  } catch { /* ignore */ }
  return null
}

export async function apply(ctx, entryConfig = {}) {
  const home = dshHomeDir()
  const storeDir = join(home, 'storages', 'task-notice')
  const configPath = join(storeDir, 'config.json')

  let store = null
  let hub = createNotificationHub()
  let retentionTimer = null
  let gateReasons = []

  // ── 配置(loader 组合层 + 运行期覆盖,覆盖层持久化在 config.json) ─────────
  let overrides = {}
  try {
    const loaded = readJsonFile(configPath, null)
    if (loaded && typeof loaded === 'object') overrides = loaded
  } catch { /* ignore */ }

  const readConfig = () => ({ ...CONFIG_DEFAULTS, ...(entryConfig ?? {}), ...overrides })

  // ── Provider 目录(0.3.2)───────────────────────────────────────────────
  // 目录缓存于 config.json(overrides.providers):{ version, updatedAt, removed, list }
  // list = 已抓取配置的行;removed = 用户手动删除的失效 Provider id。
  let providerDirectory = normalizeProviderDirectory(overrides.providers)
  const writeProviderDirectory = (next) => {
    providerDirectory = normalizeProviderDirectory(next)
    overrides = { ...overrides, providers: providerDirectory }
    writeJsonFile(storeDir, configPath, overrides)
  }
  // 目录重扫:settings/llm + 账本观测,去掉 removed;任何失败保留旧目录。
  const refreshProviderDirectory = (entries) => {
    try {
      const scanned = scanProviderDirectory(ctx)
      const merged = mergeLedgerProviders(scanned, entries || (store !== null && store !== undefined ? store.query(0, Date.now()) : []))
      const removed = new Set(providerDirectory.removed || [])
      const list = merged.filter((p) => !removed.has(p.id))
      writeProviderDirectory({ version: 1, updatedAt: Date.now(), removed: [...removed], list })
      // 目录就绪后把旧 plans 键(env 名)归一到 Provider id(幂等,仅在变化时落盘)
      try {
        const migrated = migratePlanKeysToProviders(overrides.plans || {}, list)
        if (migrated.changed) applyConfigPatch({ plans: migrated.plans })
      } catch (error) {
        console.warn('[dsh-task-notice] Token Plan 键迁移失败: ' + String(error?.message ?? error))
      }
    } catch (error) {
      console.warn('[dsh-task-notice] Provider 目录重扫失败: ' + String(error?.message ?? error))
    }
    return providerDirectory
  }

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
      pricing: normalizePricing(c.pricing),
      // 0.3.2:plans 键在读取侧归一为 Provider id(旧 env 标签键同时兼容)
      plans: normalizePlans(migratePlanKeysToProviders(c.plans, providerDirectory.list).plans),
      peak: normalizePeak(c.peak),
      // Provider 目录(0.3.2):configView 一并给出,前端无需单独 RPC 也能取显示名
      providers: providerDirectory.list,
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
    // 价格与套餐:整对象替换(patch.pricing / patch.plans / patch.peak 由设置页构造完整结构)
    if (patch.pricing !== undefined && patch.pricing !== null) clean.pricing = normalizePricing(patch.pricing)
    if (patch.plans !== undefined && patch.plans !== null) clean.plans = normalizePlans(patch.plans)
    if (patch.peak !== undefined && patch.peak !== null) clean.peak = normalizePeak(patch.peak)
    if (Object.keys(clean).length === 0) return
    overrides = { ...overrides, ...clean }
    writeJsonFile(storeDir, configPath, overrides)
  }

  const host = findDshHostInfo()
  const health = () => ({
    enabled: readConfig().enabled !== false,
    dshVersion: host?.version ?? 'unknown',
    nodeVersion: process.version,
    pluginVersion: PLUGIN_VERSION,
    reasons: gateReasons,
  })

  // Provider 目录 I/O(0.3.2):get 取缓存;refresh 重扫(settings/llm + 账本观测)
  // 并持久化;remove 把失效 id 加入 removed(重扫不再复活)并删除其 Token Plan。
  const providerIO = {
    get: () => normalizeProviderDirectory(providerDirectory),
    refresh: () => refreshProviderDirectory(store !== null && store !== undefined ? store.query(0, Date.now()) : []),
    remove: (id) => {
      const removed = new Set(providerDirectory.removed || [])
      removed.add(id)
      const list = (providerDirectory.list || []).filter((p) => p.id !== id)
      writeProviderDirectory({ version: 1, updatedAt: Date.now(), removed: [...removed], list })
      // 同时删除该 Provider 的 Token Plan 属性(0.3.2:计划按 Provider 归置)
      try {
        const plans = overrides.plans || {}
        let changed = false
        const next = {}
        for (const k of Object.keys(plans)) {
          if (k === id) {
            changed = true
            continue
          }
          next[k] = plans[k]
        }
        if (changed) applyConfigPatch({ plans: next })
      } catch (error) {
        console.warn('[dsh-task-notice] 删除 Provider 后清理 Token Plan 失败: ' + String(error?.message ?? error))
      }
    },
  }

  // ── 插件总开关:关闭时只保留健康查询,不做任何计费/折叠/通知工作 ──────────
  if (readConfig().enabled === false) {
    gateReasons = [{ code: 'disabled-by-config', message: '插件已在配置中关闭(enabled: false)。' }]
    console.warn('[dsh-task-notice] 插件已在配置中关闭(enabled: false)。')
    try {
      ctx.provide('taskNotice', createTaskNoticeService({ health, config: configView, store: null, hub, applyConfigPatch, providerIO }))
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
    // 0.3.1 归因修正:旧版 resolveKeyLabel 会把 scnet 等 provider 的调用误记到
    // 共享命名空间(llm-deepseek)的 apiKeyEnv 名下;按修正后的解析器重算一次
    // key 标签(幂等;settings 变更后重启也会跟随当前真实路由配置)。
    try {
      const remapped = store.remapKeys((provider) => resolveKeyLabel(ctx, provider).key)
      if (remapped > 0) console.log('[dsh-task-notice] 账本 Key 归因修正: ' + remapped + ' 条记录已按真实路由配置重算归属。')
    } catch (error) {
      console.warn('[dsh-task-notice] 账本 Key 归因修正失败: ' + String(error?.message ?? error))
    }
    // 0.3.2:启动即抓取 Provider 目录(首次启动 / 无数据时也列出已配置 Provider ID、
    // 显示名与所含模型),并做一次 plans 键(旧 env 名 → Provider id)迁移。
    try {
      const d = refreshProviderDirectory(store.query(0, Date.now()))
      const migrated = migratePlanKeysToProviders(overrides.plans || {}, d.list)
      if (migrated.changed) {
        console.log('[dsh-task-notice] Token Plan 键迁移: ' + migrated.moved + ' 条已按 Provider ID 归一。')
        applyConfigPatch({ plans: migrated.plans })
      }
    } catch (error) {
      console.warn('[dsh-task-notice] Provider 目录初始化失败: ' + String(error?.message ?? error))
    }
    ctx.effect(() => () => { try { store.close() } catch { /* ignore */ } }, 'dsh-task-notice: store close')
    retentionTimer = setInterval(() => {
      try {
        if (store !== null) store.prune(retentionMs())
      } catch { /* ignore */ }
    }, 6 * 60 * 60 * 1000)
    if (retentionTimer && typeof retentionTimer.unref === 'function') retentionTimer.unref()
    ctx.effect(() => () => clearInterval(retentionTimer), 'dsh-task-notice: retention timer')

    // ① llm/stream 捕获 → 按 Key 记账(条目带 ver,0.1/0.2 旧账目据此按低谷价计费)
    // 0.3.4 提示重置:流抛错且错误属于 Token Plan 配额耗尽类(402/429/QUOTA)时,
    // 标记该 Provider ID 待确认(pending)→ 期间消耗计入临时账本;每次正常调用后
    // 若该 Provider 仍待确认则推送「是否续费了」弹窗帧。
    const lastRenewPush = new Map() // planKey → 上次推送续费确认弹窗的时间
    const planKeyOf = (plans, provider, keyLabel) => {
      const p = plans !== null && typeof plans === 'object' ? plans : {}
      const providerId = typeof provider === 'string' && provider !== '' ? provider : null
      if (providerId !== null && p[providerId] !== undefined && p[providerId] !== null && p[providerId].enabled === true) return providerId
      const label = typeof keyLabel === 'string' && keyLabel !== '' ? keyLabel : null
      if (label !== null && label !== providerId && p[label] !== undefined && p[label] !== null && p[label].enabled === true) return label
      return null
    }
    const pushPlanFrame = (action, planKey, provider, model, atMs, title, summary) => {
      try {
        hub.push({
          id: frameId(),
          type: 'plan',
          atMs,
          sessionId: '',
          title,
          summary,
          tokens: { cacheIn: 0, cacheOut: 0, output: 0, cacheWrite: 0, reasoning: 0 },
          total: 0,
          cost: 0,
          currency: '¥',
          key: planKey,
          provider: provider ?? null,
          model: model ?? null,
          goal: null,
          plan: { action, key: planKey, provider: provider ?? null, model: model ?? null, atMs },
        })
      } catch (error) {
        console.warn('[dsh-task-notice] Token Plan 提示帧推送失败: ' + String(error?.message ?? error))
      }
    }
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
              ver: ENTRY_VERSION,
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
            // 0.3.4:该 Provider 待续费确认 → 下次正常调用弹「是否续费了」(节流)
            try {
              const cfg = readConfig()
              const pkey = planKeyOf(cfg.plans, call.provider, key)
              if (pkey !== null) {
                const plan = (cfg.plans || {})[pkey]
                if (plan !== null && typeof plan === 'object' && plan.pending !== null && typeof plan.pending === 'object' && plan.pending.at > 0) {
                  const now = Date.now()
                  const last = lastRenewPush.get(pkey)
                  if (last === undefined || now - last >= 30 * 60 * 1000) {
                    lastRenewPush.set(pkey, now)
                    pushPlanFrame('renew', pkey, call.provider ?? '', call.model ?? '', now,
                      'Token Plan 续费确认',
                      '检测到该 Provider 的 Token Plan 可能已耗尽,是否已续费?')
                  }
                }
              }
            } catch (error) {
              console.warn('[dsh-task-notice] 续费确认提示失败: ' + String(error?.message ?? error))
            }
          } catch (error) {
            console.warn('[dsh-task-notice] 消耗记账失败: ' + String(error?.message ?? error))
          }
        })()
      },
      onError: (call) => {
        // 0.3.4:402/429/QUOTA → 若该 Provider 启用了 Token Plan,标记待确认并弹
        // 「需要重置 Token Plan 吗?」;已标记则不再重复提示。
        try {
          const { key } = resolveKeyLabel(ctx, call.provider)
          const cfg = readConfig()
          const pkey = planKeyOf(cfg.plans, call.provider, key)
          if (pkey === null) return
          const plans = { ...(cfg.plans || {}) }
          const plan = plans[pkey]
          if (plan === undefined || plan === null || plan.enabled !== true) return
          if (plan.pending !== null && typeof plan.pending === 'object' && plan.pending.at > 0) return
          plans[pkey] = { ...plan, pending: { at: call.atMs } }
          applyConfigPatch({ plans })
          pushPlanFrame('reset', pkey, call.provider ?? '', call.model ?? '', call.atMs,
            'Token Plan 需要重置?',
            '该 Provider 的模型调用返回 402/429(Token Plan 错误码),可能需要重置 Token Plan。')
        } catch (error) {
          console.warn('[dsh-task-notice] Token Plan 错误检测失败: ' + String(error?.message ?? error))
        }
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
            // 按本轮开始时刻取峰谷档(本轮为实时调用,非旧账目)
            const turnCost = costOf(b, tierForEntry(priceFor(cfg.pricing, key, model), turn.startedAt, cfg.peak))
            hub.push({
              id: frameId(),
              type: 'turn',
              atMs: turn.startedAt,
              sessionId: session.id,
              title: '任务完成 · ' + fmtMoney(turnCost, cfg.pricing?.currency),
              summary: '第 ' + turn.no + ' 轮任务已完成,本次消耗 ' + fmt(total) + ' tokens',
              tokens: { cacheIn: b.cacheIn, cacheOut: b.cacheOut, output: b.output, cacheWrite: b.cacheWrite, reasoning: b.reasoning },
              total,
              cost: turnCost,
              currency: cfg.pricing?.currency ?? '¥',
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
      onGoal: ({ session, goal, buckets, models }) => {
        void (async () => {
          try {
            const cfg = readConfig()
            if (cfg.notifyOnGoal === false) return
            const total = bucketTotals(buckets)
            // 目标跨多轮/多模型:按每个模型的用量 × 该模型价格累加(模型价跨 Key 合并)
            let goalCost = 0
            for (const m of Array.isArray(models) ? models : []) {
              let key = null
              try {
                key = resolveKeyLabel(ctx, m.provider).key
              } catch { /* key optional */ }
              goalCost += costOf(m.buckets ?? m, priceFor(cfg.pricing, key, m.model))
            }
            hub.push({
              id: frameId(),
              type: 'goal',
              atMs: Date.now(),
              sessionId: session.id,
              title: '目标完成 · ' + fmtMoney(goalCost, cfg.pricing?.currency),
              summary: '目标「' + String(goal?.objective ?? '').slice(0, 60) + '」已完成,共消耗 ' + fmt(total) + ' tokens',
              tokens: { cacheIn: buckets.cacheIn, cacheOut: buckets.cacheOut, output: buckets.output, cacheWrite: buckets.cacheWrite, reasoning: buckets.reasoning },
              total,
              cost: goalCost,
              currency: cfg.pricing?.currency ?? '¥',
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
    ctx.provide('taskNotice', createTaskNoticeService({ health, config: configView, store, hub, applyConfigPatch, providerIO }))

    console.log('[dsh-task-notice] 已启用:完工通知(页内弹窗 + 浏览器 Web Notifications 系统通知,需页面授权) + 按 Provider(Key)消耗统计(账本 ' + store.path + ')+ 模型价格计算(官方价默认,可自定义;旧账目按低谷价)。')
  } catch (error) {
    console.error('[dsh-task-notice] 初始化失败,插件已取消运行(不影响 DSH 启动): ' + String(error?.message ?? error))
    gateReasons = [{ code: 'init-failed', message: '初始化失败,已取消插件运行。', detail: String(error?.message ?? error) }]
    try {
      ctx.provide('taskNotice', createTaskNoticeService({ health, config: configView, store: null, hub, applyConfigPatch, providerIO }))
    } catch { /* ignore */ }
  }
}
