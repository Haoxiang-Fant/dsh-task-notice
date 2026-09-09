/**
 * Session-log fold: detects task completion and computes per-task token
 * usage, purely from the durable session event stream.
 *
 * Events consumed per session:
 *   request/header      → current provider/model header
 *   turn/start|step/*   → open brackets
 *   assistant/chunk     → usage chunks (chunk.type === 'usage') accumulate
 *                         into the open step/turn — this is where DSH reports
 *                         provider usage on the durable event stream
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
          // DSH reports provider usage as stream chunks of type 'usage'
          // (e.g. { inputTokens, outputTokens, cacheReadTokens, ... }) — the
          // durable log keeps them on assistant/chunk, NOT on
          // assistant/message. Counting them here is what makes per-turn
          // totals real instead of always zero.
          const chunk = event.data?.chunk
          if (!chunk || typeof chunk !== 'object' || chunk.type !== 'usage') return
          const usage = chunk.usage
          if (!usage || typeof usage !== 'object') return
          const buckets = bucketsFromEventUsage(usage)
          addBuckets(s.cumulative, buckets)
          {
            const mkey = modelKeyOf(s)
            if (!s.modelCumulative.has(mkey)) s.modelCumulative.set(mkey, zeroBuckets())
            addBuckets(s.modelCumulative.get(mkey), buckets)
          }
          if (s.turn) {
            const stepNo = s.stepNo ?? 0
            if (!s.turn.steps.has(stepNo)) s.turn.steps.set(stepNo, zeroBuckets())
            addBuckets(s.turn.steps.get(stepNo), buckets)
          }
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
