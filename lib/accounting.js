/**
 * llm/stream waterfall capture: reads the provider-reported `usage` chunk of
 * every model call and reports it once to the account callback.
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
 * Create the llm/stream listener.
 * @param {{account: (call: object) => void}} deps
 *   account receives { usage, provider, model, sessionId, purpose, atMs }.
 * @returns {(options: object, next: () => AsyncIterable) => AsyncIterable}
 */
export function createUsageCapture({ account }) {
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
