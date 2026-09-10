/**
 * llm/stream waterfall capture: reads the provider-reported `usage` chunk of
 * every model call and reports it once to the account callback.
 *
 * 0.3.4:流失败(抛错)时把错误交给 onError 回调——宿主据此识别 402/429
 * (Token Plan 配额耗尽类)错误并触发「Token Plan 重置」提示流程。
 *
 * The AsyncLocalStorage depth marker prevents double counting when a wrapper
 * router (e.g. modlens) re-enters ctx.llm.stream() from inside the wrapped
 * stream's consumption context — the inner dispatch is a passthrough.
 */
import { AsyncLocalStorage } from 'node:async_hooks'

const captureDepth = new AsyncLocalStorage()

export function zeroBuckets() {
  return { cacheIn: 0, cacheOut: 0, output: 0, cacheWrite: 0, reasoning: 0 }
}

export function bucketsFromUsage(usage) {
  return {
    cacheIn: typeof usage.cacheReadTokens === 'number' ? usage.cacheReadTokens : 0,
    cacheOut: typeof usage.inputTokens === 'number' ? usage.inputTokens : 0,
    output: typeof usage.outputTokens === 'number' ? usage.outputTokens : 0,
    cacheWrite: typeof usage.cacheWriteTokens === 'number' ? usage.cacheWriteTokens : 0,
    reasoning: typeof usage.reasoningTokens === 'number' ? usage.reasoningTokens : 0,
  }
}

/**
 * 识别「Token Plan 相关的配额耗尽类」模型调用错误(0.3.4):
 * 沿错误及 cause 链查找 —— HTTP status 402(余额/额度不足)或 429(限流/配额),
 * 或 DSH 归一化错误码 QUOTA(配额/余额/信用耗尽)/ RATE_LIMIT(429 类)。
 * @param {unknown} error 抛出的值
 * @returns {boolean} 是否属于 402/429 Token Plan 错误码
 */
export function planErrorSignal(error) {
  let cur = error
  const seen = new Set()
  while (cur !== null && cur !== undefined && (typeof cur === 'object' || typeof cur === 'function') && !seen.has(cur)) {
    seen.add(cur)
    const status = typeof cur.status === 'number' ? cur.status : undefined
    const code = typeof cur.code === 'string' ? cur.code : ''
    if (status === 402 || status === 429) return true
    if (code === 'QUOTA' || code === 'RATE_LIMIT') return true
    cur = cur.cause
  }
  return false
}

/**
 * Create the llm/stream listener.
 * @param {{account: (call: object) => void, onError?: (call: object) => void}} deps
 *   account receives { usage, provider, model, sessionId, purpose, atMs }.
 *   onError receives { provider, model, sessionId, purpose, atMs, error } when
 *   the downstream stream throws(仅限 Token Plan 相关 402/429 错误)。
 * @returns {(options: object, next: () => AsyncIterable) => AsyncIterable}
 */
export function createUsageCapture({ account, onError }) {
  return (options, next) => {
    const downstream = next()
    // Nested re-entrant dispatch inside our own consumption context: the outer
    // wrapper already accounts, pass through untouched.
    if (captureDepth.getStore() !== undefined) return downstream
    const startedAtMs = Date.now()
    return (async function* taskNoticeStream() {
      let usage = null
      const iterator = downstream[Symbol.asyncIterator]()
      let completed = false
      try {
        for (;;) {
          const result = await captureDepth.run(1, () => iterator.next())
          if (result.done) break
          const chunk = result.value
          if (chunk !== null && chunk !== undefined && chunk.type === 'usage' && chunk.usage != null) {
            usage = chunk.usage
          }
          yield chunk
        }
        completed = true
      } catch (error) {
        // 0.3.4:识别 Token Plan 配额耗尽类错误(402/429/QUOTA),交给宿主提示
        if (typeof onError === 'function' && planErrorSignal(error)) {
          try {
            onError({
              provider: typeof options?.provider === 'string' ? options.provider : null,
              model: typeof options?.model === 'string' ? options.model : null,
              sessionId: typeof options?.sessionId === 'string' ? options.sessionId : null,
              purpose: typeof options?.purpose === 'string' ? options.purpose : null,
              atMs: startedAtMs,
              error,
            })
          } catch (innerError) {
            console.warn('[dsh-task-notice] Token Plan 错误提示处理失败: ' + String(innerError?.message ?? innerError))
          }
        }
        throw error
      } finally {
        // Propagate early termination so the upstream HTTP stream is not leaked.
        if (!completed) {
          try {
            await iterator.return?.()
          } catch {
            /* ignore */
          }
        }
        if (usage !== null) {
          try {
            account({
              usage,
              provider: typeof options?.provider === 'string' ? options.provider : null,
              model: typeof options?.model === 'string' ? options.model : null,
              sessionId: typeof options?.sessionId === 'string' ? options.sessionId : null,
              purpose: typeof options?.purpose === 'string' ? options.purpose : null,
              atMs: startedAtMs,
            })
          } catch (error) {
            console.warn('[dsh-task-notice] 用量记录失败: ' + String(error?.message ?? error))
          }
        }
      }
    })()
  }
}
