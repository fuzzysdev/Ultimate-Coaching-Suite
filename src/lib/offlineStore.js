/**
 * offlineStore — lightweight localStorage cache + pending write queue
 *
 * Cache keys:   ucs_cache_{key}
 * Queue key:    ucs_pending
 *
 * Queue items: { key, table, method, match, data, ts }
 *   key    – dedupe ID (e.g. "tryout_rankings_<id>")
 *   table  – Supabase table name
 *   method – 'update' | 'insert'
 *   match  – object passed to .match() for update ops
 *   data   – payload
 *   ts     – timestamp (ms) of last write
 */

const P = 'ucs_'

export const offlineStore = {

  // ── Read-through cache ────────────────────────────────────────────────────

  setCache(key, data) {
    try {
      localStorage.setItem(P + 'cache_' + key, JSON.stringify({ data, ts: Date.now() }))
    } catch { /* storage full — silently skip */ }
  },

  getCache(key) {
    try {
      const raw = localStorage.getItem(P + 'cache_' + key)
      return raw ? JSON.parse(raw).data : null
    } catch { return null }
  },

  // ── Pending write queue ───────────────────────────────────────────────────

  /** Enqueue or replace an existing entry with the same key (last-write-wins). */
  enqueue(key, op) {
    try {
      const q = this.getQueue()
      const i = q.findIndex(x => x.key === key)
      const item = { key, ...op, ts: Date.now() }
      if (i >= 0) q[i] = item
      else q.push(item)
      localStorage.setItem(P + 'pending', JSON.stringify(q))
    } catch { }
  },

  getQueue() {
    try {
      return JSON.parse(localStorage.getItem(P + 'pending') || '[]')
    } catch { return [] }
  },

  dequeue(key) {
    try {
      const q = this.getQueue().filter(x => x.key !== key)
      localStorage.setItem(P + 'pending', JSON.stringify(q))
    } catch { }
  },
}

// ── Per-game pending point queue ──────────────────────────────────────────────
// Stores points committed locally but not yet confirmed by Supabase, so they
// can be re-inserted if the device sleeps before the network call completes.

const PP = 'ucs_pending_pts_'

export const enqueuePendingPoint = (gameId, pointData) => {
  try {
    const key = PP + gameId
    const arr = JSON.parse(localStorage.getItem(key) || '[]')
    const deduped = arr.filter(p => p.point_number !== pointData.point_number)
    deduped.push(pointData)
    localStorage.setItem(key, JSON.stringify(deduped))
  } catch {}
}

export const dequeuePendingPoint = (gameId, pointNumber) => {
  try {
    const key = PP + gameId
    const arr = JSON.parse(localStorage.getItem(key) || '[]')
      .filter(p => p.point_number !== pointNumber)
    if (arr.length === 0) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(arr))
  } catch {}
}

export const getPendingPoints = (gameId) => {
  try { return JSON.parse(localStorage.getItem(PP + gameId) || '[]') } catch { return [] }
}

export const clearPendingPoints = (gameId) => {
  try { localStorage.removeItem(PP + gameId) } catch {}
}
