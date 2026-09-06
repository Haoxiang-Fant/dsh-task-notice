/**
 * Durable per-key token-usage ledger for the task-notice plugin.
 *
 * Storage: $DSH_HOME/storages/task-notice/usage.json
 *   { version: 1, entries: [ { id, at, key, keySource, provider, model,
 *     sessionId, purpose, cacheIn, cacheOut, output, cacheWrite, reasoning } ] }
 *
 * Writes are batched in memory and flushed on a debounce timer plus on close;
 * the file write is atomic (tmp + rename). Entries older than the retention
 * window are pruned on open and periodically.
 */
import fs from 'node:fs'
import { join } from 'node:path'

export const STORE_VERSION = 1

function loadEntries(path) {
  try {
    const raw = JSON.parse(fs.readFileSync(path, 'utf8'))
    if (raw && Array.isArray(raw.entries)) {
      return raw.entries.filter((e) => e && typeof e === 'object' && typeof e.at === 'number')
    }
  } catch {
    /* first run or corrupt file — start empty, overwrite on next flush */
  }
  return []
}

export function openStore(retentionMs, dshHome) {
  const dir = join(dshHome, 'storages', 'task-notice')
  const path = join(dir, 'usage.json')
  let entries = loadEntries(path)
  let dirty = false
  let timer = null

  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    if (!dirty) return
    dirty = false
    try {
      fs.mkdirSync(dir, { recursive: true })
      const tmp = path + '.tmp'
      fs.writeFileSync(tmp, JSON.stringify({ version: STORE_VERSION, entries }, null, 2), 'utf8')
      fs.renameSync(tmp, path)
    } catch (error) {
      console.warn('[dsh-task-notice] 账本落盘失败: ' + String(error?.message ?? error))
    }
  }

  const schedule = () => {
    if (timer !== null) return
    timer = setTimeout(() => {
      timer = null
      flush()
    }, 5000)
    if (timer && typeof timer.unref === 'function') timer.unref()
  }

  const prune = (ms) => {
    if (!(ms > 0)) return
    const cut = Date.now() - ms
    const before = entries.length
    entries = entries.filter((e) => e.at >= cut)
    if (entries.length !== before) dirty = true
  }

  const store = {
    path,
    dir,
    get count() {
      return entries.length
    },
    append(entry) {
      entries.push(entry)
      dirty = true
      schedule()
    },
    prune,
    query(fromMs, toMs) {
      return entries.filter((e) => e.at >= fromMs && e.at <= toMs)
    },
    flush,
    close() {
      flush()
    },
  }

  // Retention on open keeps the file bounded even if the plugin was away.
  prune(retentionMs)

  return store
}
