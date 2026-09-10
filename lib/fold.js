/**
 * Session-log fold: detects task completion and computes per-task token
 * usage, purely from the durable session event stream.
 *
 * Events consumed per session:
 *   request/header      → current provider/model header
 *   turn/start|step/*   → open brackets
 *   assistant/message   → settlement usage (data.usage, or the last 'usage'
 *                         record inside data.stream) — how the current DSH
 *                         reports provider usage on the durable event stream
 *   assistant/attempt   → same stream-scan fallback (failed/aborted attempts
 *                         still consumed tokens and are their own model call)
 *   assistant/chunk     → legacy (session format v0) per-chunk usage channel;
 *                         kept for old hosts, never mixed with the settlement
 *                         channel on the same session
 *   turn/end            → completed ⇒ onTurn fired with the turn totals
 *   goal/change         → create/complete ⇒ onGoal fired with usage since create
 *
 * The same events drive BOTH the completion notifications (this module) and
 * are independent of the llm/stream ledger (accounting.js) — both read the
 * same provider-reported usage, so the numbers agree.
 */
import { zeroBuckets } from './accounting.js'

function addBuckets(a, b) {
  a.cacheIn += b.cacheIn
  a.cacheOut += b.cacheOut
  a.output += b.output
  a.cacheWrite += b.cacheWrite
  a.reasoning += b.reasoning
  return a
}

function createSessionState() {
  return {
    header: null, // current EpochHeader from request/header
    turn: null, // { no, startedAt, header, steps: Map<stepNo, buckets> }
    stepNo: null,
    cumulative: zeroBuckets(), // per-bucket totals seen, for goal deltas
    modelCumulative: new Map(), // provider|model → buckets (session-wide, for goal cost)
    goal: null, // current goal snapshot
    goalStartCumulative: null, // per-bucket cumulative at goal create
    goalModelStart: null, // provider|model → buckets snapshot at goal create
    // 用量来源(0.3.3.1):'chunk' = 旧宿主逐块上报(assistant/chunk),'settlement' =
    // 当前 DSH 结算上报(assistant/message|attempt)。同一会话只认一种,避免同一次
    // 调用被两个通道各计一遍。
    usageVia: null,
  }
}

function modelKeyOf(state) {
  const h = state && state.header
  const provider = h && h.config ? h.config.provider : null
  const model = h && h.config ? h.config.model : null
  return String(provider ?? '') + '|' + String(model ?? '')
}

/**
 * @param {{onTurn?: (info: object) => void, onGoal?: (info: object) => void}} handlers
 *   onTurn: { session, turn: { no, startedAt, header, buckets } }
 *   onGoal: { session, goal, buckets }  (buckets = usage since goal create)
 */
export function createCompletionTracker(handlers = {}) {
  const sessions = new Map()

  function stateOf(session) {
    let s = sessions.get(session.id)
    if (s === undefined) {
      s = createSessionState()
      sessions.set(session.id, s)
    }
    return s
  }

  /** 把一次调用的 usage 计入会话累计 / 按模型累计 / 当前 turn 的指定 step。 */
  function accumulate(s, usage, stepNo) {
    const buckets = bucketsFromEventUsage(usage)
    addBuckets(s.cumulative, buckets)
    {
      const mkey = modelKeyOf(s)
      if (!s.modelCumulative.has(mkey)) s.modelCumulative.set(mkey, zeroBuckets())
      addBuckets(s.modelCumulative.get(mkey), buckets)
    }
    if (s.turn) {
      const key = typeof stepNo === 'number' && stepNo >= 0 ? stepNo : (s.stepNo ?? 0)
      if (!s.turn.steps.has(key)) s.turn.steps.set(key, zeroBuckets())
      addBuckets(s.turn.steps.get(key), buckets)
    }
  }

  /**
   * 从结算事件里取本次调用的最终 usage(0.3.3.1):
   *  - assistant/message 优先取 data.usage(assembler 汇总的最终用量);
   *  - 两者都可回退扫描 data.stream 里最后一条 { type:'chunk', chunk:{ type:'usage', usage } }
   *    记录(compact stream 只保留原始 usage 块,取最后一条 = 最终值,避免同调用累加多次)。
   */
  function settlementUsage(event) {
    const data = event.data
    if (data === null || typeof data !== 'object') return null
    if (event.type === 'assistant/message' && data.usage !== null && typeof data.usage === 'object') {
      return data.usage
    }
    const stream = data.stream
    if (!Array.isArray(stream)) return null
    let usage = null
    for (const record of stream) {
      if (record === null || typeof record !== 'object' || record.type !== 'chunk') continue
      const chunk = record.chunk
      if (chunk === null || typeof chunk !== 'object' || chunk.type !== 'usage') continue
      if (chunk.usage !== null && typeof chunk.usage === 'object') usage = chunk.usage
    }
    return usage
  }

  return {
    /** Feed one appended session event (skip subagent sessions at the caller). */
    onSessionEvent(session, event) {
      const s = stateOf(session)
      switch (event.type) {
        case 'request/header': {
          s.header = event.data.header ?? null
          return
        }
        case 'turn/start': {
          s.turn = {
            no: event.data.turn,
            startedAt: event.time,
            header: s.header,
            steps: new Map(),
          }
          s.stepNo = null
          return
        }
        case 'step/start': {
          s.stepNo = event.data.step
          if (s.turn && !s.turn.steps.has(s.stepNo)) s.turn.steps.set(s.stepNo, zeroBuckets())
          return
        }
        case 'assistant/chunk': {
          // 旧宿主(会话格式 v0)逐块上报 usage 的通道:保留兼容。一旦某会话出现过
          // usage 块就锁定走旧格式,后续结算帧(assistant/message|attempt)不再重复计。
          const chunk = event.data?.chunk
          if (!chunk || typeof chunk !== 'object' || chunk.type !== 'usage') return
          const usage = chunk.usage
          if (!usage || typeof usage !== 'object') return
          s.usageVia = 'chunk'
          accumulate(s, usage, s.stepNo ?? 0)
          return
        }
        case 'assistant/message':
        case 'assistant/attempt': {
          // 当前 DSH(会话格式 v2/v3)不再发 assistant/chunk:每次模型调用的用量
          // 随结算事件携带——assistant/message 的 data.usage,或 data.stream 里的
          // usage 记录。替换/折叠产生的副本消息(surfaceOp !== 'append')不计。
          if (event.type === 'assistant/message' && event.surfaceOp !== 'append') return
          if (s.usageVia === 'chunk') return
          const usage = settlementUsage(event)
          if (usage === null) return
          s.usageVia = 'settlement'
          accumulate(s, usage, event.data?.step)
          return
        }
        case 'turn/end': {
          const turn = s.turn
          s.turn = null
          s.stepNo = null
          if (!turn) return
          const reason = event.data?.reason
          if (reason?.kind !== 'completed') return
          const buckets = zeroBuckets()
          for (const stepBuckets of turn.steps.values()) addBuckets(buckets, stepBuckets)
          if (typeof handlers.onTurn === 'function') {
            try {
              // request/header is appended inside the step, so the first turn
              // of a session has no header at turn/start — fall back to the
              // session's current header folded by turn/end.
              handlers.onTurn({ session, turn: { no: turn.no, startedAt: turn.startedAt, header: turn.header ?? s.header, buckets } })
            } catch (error) {
              console.warn('[dsh-task-notice] onTurn 处理失败: ' + String(error?.message ?? error))
            }
          }
          return
        }
        case 'goal/change': {
          const meta = event.data
          if (!meta) return
          if (meta.operation === 'create') {
            s.goal = meta.goal ?? null
            s.goalStartCumulative = { ...s.cumulative }
            s.goalModelStart = new Map([...s.modelCumulative].map(([k, v]) => [k, { ...v }]))
          } else if (meta.operation === 'complete') {
            const goal = meta.goal ?? s.goal
            const start = s.goalStartCumulative ?? zeroBuckets()
            const buckets = {
              cacheIn: Math.max(0, s.cumulative.cacheIn - start.cacheIn),
              cacheOut: Math.max(0, s.cumulative.cacheOut - start.cacheOut),
              output: Math.max(0, s.cumulative.output - start.output),
              cacheWrite: Math.max(0, s.cumulative.cacheWrite - start.cacheWrite),
              reasoning: Math.max(0, s.cumulative.reasoning - start.reasoning),
            }
            // 按模型拆分目标期间用量(fold 的 goal 帧据此按 Key×模型价格算金额)
            const models = []
            const startMap = s.goalModelStart
            for (const [mkey, cur] of s.modelCumulative) {
              const from = startMap ? startMap.get(mkey) : null
              const base = from ?? zeroBuckets()
              const mb = {
                provider: mkey.slice(0, mkey.indexOf('|')),
                model: mkey.slice(mkey.indexOf('|') + 1),
                buckets: {
                  cacheIn: Math.max(0, cur.cacheIn - base.cacheIn),
                  cacheOut: Math.max(0, cur.cacheOut - base.cacheOut),
                  output: Math.max(0, cur.output - base.output),
                  cacheWrite: Math.max(0, cur.cacheWrite - base.cacheWrite),
                  reasoning: Math.max(0, cur.reasoning - base.reasoning),
                },
              }
              if (mb.buckets.cacheIn + mb.buckets.cacheOut + mb.buckets.output + mb.buckets.cacheWrite + mb.buckets.reasoning > 0) models.push(mb)
            }
            if (goal && typeof handlers.onGoal === 'function') {
              try {
                handlers.onGoal({ session, goal, buckets, models })
              } catch (error) {
                console.warn('[dsh-task-notice] onGoal 处理失败: ' + String(error?.message ?? error))
              }
            }
            s.goal = null
            s.goalStartCumulative = null
            s.goalModelStart = null
          } else {
            if (meta.goal) s.goal = meta.goal
            else if (meta.operation === 'clear') s.goal = null
          }
          return
        }
        default:
          return
      }
    },
    onSessionDisposed(session) {
      sessions.delete(session.id)
    },
  }
}

function bucketsFromEventUsage(usage) {
  return {
    cacheIn: typeof usage.cacheReadTokens === 'number' ? usage.cacheReadTokens : 0,
    cacheOut: typeof usage.inputTokens === 'number' ? usage.inputTokens : 0,
    output: typeof usage.outputTokens === 'number' ? usage.outputTokens : 0,
    cacheWrite: typeof usage.cacheWriteTokens === 'number' ? usage.cacheWriteTokens : 0,
    reasoning: typeof usage.reasoningTokens === 'number' ? usage.reasoningTokens : 0,
  }
}
