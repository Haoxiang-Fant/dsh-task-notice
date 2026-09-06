/**
 * Notification hub: fan-out queue that feeds every active
 * `taskNotice.subscribeNotifications` stream (one per browser tab).
 * No history replay — a subscriber only sees frames pushed after it
 * subscribed, which keeps reconnects quiet.
 */

export function createNotificationHub() {
  const subscribers = new Set()

  return {
    push(frame) {
      for (const q of subscribers) {
        q.push(frame)
        if (q._waiter !== null) {
          const w = q._waiter
          q._waiter = null
          w()
        }
      }
    },
    async *subscribe(signal) {
      const q = []
      q._waiter = null
      subscribers.add(q)
      const wake = () => {
        if (q._waiter !== null) {
          const w = q._waiter
          q._waiter = null
          w()
        }
      }
      const abortListener = () => wake()
      if (signal !== undefined && signal !== null && typeof signal.addEventListener === 'function') {
        signal.addEventListener('abort', abortListener, { once: true })
      }
      try {
        for (;;) {
          if (signal !== undefined && signal !== null && signal.aborted) return
          if (q.length > 0) {
            yield q.shift()
            continue
          }
          await new Promise((resolve) => {
            q._waiter = resolve
          })
          q._waiter = null
        }
      } finally {
        if (signal !== undefined && signal !== null && typeof signal.removeEventListener === 'function') {
          signal.removeEventListener('abort', abortListener)
        }
        subscribers.delete(q)
      }
    },
  }
}

/** Generate a short unique id for a notification frame. */
export function frameId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}
