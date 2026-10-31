import { supabase } from './supabase'
import { offlineStore } from './offlineStore'

export const BLOCK_TYPES = [
  { key: 'warmup',       label: 'Warm Up',      color: '#f0a500' },
  { key: 'drill',        label: 'Drill',        color: '#4d9fff' },
  { key: 'strategy',     label: 'Strategy',     color: '#b48cff' },
  { key: 'scrimmage',    label: 'Scrimmage',    color: '#00e5a0' },
  { key: 'conditioning', label: 'Conditioning', color: '#ff4d6d' },
  { key: 'break',        label: 'Water Break',  color: '#4dd8e8' },
  { key: 'talk',         label: 'Team Talk',    color: '#ff80c8' },
]

export const blockType = (key) => BLOCK_TYPES.find(t => t.key === key) || BLOCK_TYPES[1]

// Client-side ids let practices, blocks and drills be created offline
export const newId = () =>
  (crypto.randomUUID ? crypto.randomUUID()
    : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
        (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)))

export const newBlock = (overrides = {}) => ({
  id: newId(), type: 'drill', duration: 10, title: '', notes: '', drill_id: null, ...overrides,
})

// Local calendar date as YYYY-MM-DD (toISOString would shift to UTC)
export const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Parse YYYY-MM-DD as a local date (new Date('2026-11-04') would be UTC midnight)
const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }

export const formatPracticeDate = (s, opts = { weekday: 'short', month: 'short', day: 'numeric' }) =>
  parseDate(s).toLocaleDateString(undefined, opts)

// Attendance column label — matches the "Mar 8" style coaches already use there
export const attendanceLabelFor = (dateStr, existingLabels = []) => {
  const base = parseDate(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (!existingLabels.includes(base)) return base
  let n = 2
  while (existingLabels.includes(`${base} (${n})`)) n++
  return `${base} (${n})`
}

export const formatClock = (hhmm, addMin = 0) => {
  if (!hhmm) return null
  const [h, m] = hhmm.split(':').map(Number)
  const total = h * 60 + m + addMin
  const hh = Math.floor(total / 60) % 24
  const mm = total % 60
  return `${hh % 12 || 12}:${String(mm).padStart(2, '0')}${hh < 12 ? 'am' : 'pm'}`
}

export const totalMinutes = (blocks) => blocks.reduce((sum, b) => sum + (Number(b.duration) || 0), 0)

// ── Saving (offline-safe) ───────────────────────────────────────────────────

export const practicesCacheKey = (rosterId) => `practices_${rosterId}`

// Keep the per-roster cached list in step with a local change
export function updateCachedPractice(rosterId, practice, { remove = false } = {}) {
  const key = practicesCacheKey(rosterId)
  const list = (offlineStore.getCache(key) || []).filter(p => p.id !== practice.id)
  if (!remove) list.push(practice)
  offlineStore.setCache(key, list)
}

// Upsert the whole practice row; on failure queue it (last write wins per practice)
export async function savePractice(practice, isDemoOrg) {
  updateCachedPractice(practice.roster_id, practice)
  if (isDemoOrg) return
  const row = { ...practice, updated_at: new Date().toISOString() }
  const queueKey = `practice_${practice.id}`
  const { error } = await supabase.from('practices').upsert(row, { onConflict: 'id' })
  if (error) {
    console.warn('savePractice: queued for retry', error)
    offlineStore.enqueue(queueKey, { table: 'practices', method: 'upsert', conflict: 'id', data: row })
  } else {
    offlineStore.dequeue(queueKey)
  }
}

export async function deletePractice(practice, isDemoOrg) {
  updateCachedPractice(practice.roster_id, practice, { remove: true })
  if (isDemoOrg) return
  const queueKey = `practice_${practice.id}`
  const { error } = await supabase.from('practices').delete().eq('id', practice.id)
  if (error) {
    console.warn('deletePractice: queued for retry', error)
    offlineStore.enqueue(queueKey, { table: 'practices', method: 'delete', match: { id: practice.id } })
  } else {
    offlineStore.dequeue(queueKey)
  }
}

// ── Attendance integration ──────────────────────────────────────────────────
// Cell-level RPCs (see supabase-practice-planner-migration.sql). The Attendance
// page's local cache is patched too so it shows the change immediately.

const attendanceCacheKey = (rosterId) => `attendance_${rosterId}`

export const getCachedAttendance = (rosterId) =>
  offlineStore.getCache(attendanceCacheKey(rosterId)) || { practices: [], records: {} }

function patchAttendanceCache(rosterId, fn) {
  const cur = getCachedAttendance(rosterId)
  offlineStore.setCache(attendanceCacheKey(rosterId), { ...fn(cur), savedAt: Date.now() })
}

async function rpcOrQueue(queueKey, fn, args) {
  const { error } = await supabase.rpc(fn, args)
  if (error) {
    console.warn(`${fn}: queued for retry`, error)
    offlineStore.enqueue(queueKey, { method: 'rpc', fn, args })
  } else {
    offlineStore.dequeue(queueKey)
  }
}

export async function addAttendancePractice(rosterId, label, isDemoOrg) {
  patchAttendanceCache(rosterId, c => ({
    practices: c.practices.includes(label) ? c.practices : [...c.practices, label],
    records: c.records,
  }))
  if (isDemoOrg) return
  await rpcOrQueue(`att_add_${rosterId}_${label}`, 'attendance_add_practice', { p_roster_id: rosterId, p_label: label })
}

export async function setAttendance(rosterId, label, playerId, state, isDemoOrg) {
  patchAttendanceCache(rosterId, c => ({
    practices: c.practices.includes(label) ? c.practices : [...c.practices, label],
    records: { ...c.records, [playerId]: { ...(c.records[playerId] || {}), [label]: state } },
  }))
  if (isDemoOrg) return
  await rpcOrQueue(`att_${rosterId}_${label}_${playerId}`, 'attendance_set',
    { p_roster_id: rosterId, p_label: label, p_player_id: playerId, p_state: state })
}

export async function renameAttendancePractice(rosterId, oldLabel, newLabel, isDemoOrg) {
  if (oldLabel === newLabel) return
  patchAttendanceCache(rosterId, c => {
    const records = {}
    Object.entries(c.records).forEach(([pid, rec]) => {
      const r = { ...rec }
      if (oldLabel in r) { r[newLabel] = r[oldLabel]; delete r[oldLabel] }
      records[pid] = r
    })
    return { practices: c.practices.map(p => (p === oldLabel ? newLabel : p)), records }
  })
  if (isDemoOrg) return
  await rpcOrQueue(`att_rename_${rosterId}_${oldLabel}`, 'attendance_rename_practice',
    { p_roster_id: rosterId, p_old: oldLabel, p_new: newLabel })
}

// Freshest attendance for a roster: DB when reachable, otherwise the cache
export async function fetchAttendance(rosterId) {
  const { data, error } = await supabase
    .from('attendance_data').select('practices, records')
    .eq('roster_id', rosterId).maybeSingle()
  if (error) return getCachedAttendance(rosterId)
  const fresh = { practices: data?.practices || [], records: data?.records || {} }
  // Don't clobber a local change made in the last 30s that may not have synced yet
  const cached = offlineStore.getCache(attendanceCacheKey(rosterId))
  if (cached?.savedAt && Date.now() - cached.savedAt < 30000) return cached
  offlineStore.setCache(attendanceCacheKey(rosterId), { ...fresh, savedAt: 0 })
  return fresh
}

// ── Drill library (org-private) ─────────────────────────────────────────────

const drillsCacheKey = (orgId) => `drills_${orgId}`

const sortDrills = (list) => [...list].sort((a, b) => a.name.localeCompare(b.name))

export const getCachedDrills = (orgId) => offlineStore.getCache(drillsCacheKey(orgId)) || []

export async function fetchDrills(orgId) {
  const { data, error } = await supabase
    .from('drills')
    .select('id, organization_id, name, description, block_type, default_duration, tags, updated_at')
    .eq('organization_id', orgId)
    .order('name')
  if (error) { console.warn('fetchDrills: using cache', error); return getCachedDrills(orgId) }
  // Keep drills created offline that haven't synced yet
  const queued = getCachedDrills(orgId).filter(d => d._pending && !data.some(x => x.id === d.id))
  const list = sortDrills([...data, ...queued])
  offlineStore.setCache(drillsCacheKey(orgId), list)
  return list
}

export async function saveDrill(drill, isDemoOrg) {
  const orgId = drill.organization_id
  const queueKey = `drill_${drill.id}`
  const row = { ...drill, updated_at: new Date().toISOString() }
  delete row._pending
  const others = getCachedDrills(orgId).filter(d => d.id !== drill.id)
  if (isDemoOrg) { offlineStore.setCache(drillsCacheKey(orgId), sortDrills([...others, row])); return row }
  const { error } = await supabase.from('drills').upsert(row, { onConflict: 'id' })
  if (error) {
    console.warn('saveDrill: queued for retry', error)
    offlineStore.enqueue(queueKey, { table: 'drills', method: 'upsert', conflict: 'id', data: row })
  } else {
    offlineStore.dequeue(queueKey)
  }
  const saved = error ? { ...row, _pending: true } : row
  offlineStore.setCache(drillsCacheKey(orgId), sortDrills([...others, saved]))
  return saved
}

export async function deleteDrill(drill, isDemoOrg) {
  const orgId = drill.organization_id
  offlineStore.setCache(drillsCacheKey(orgId), getCachedDrills(orgId).filter(d => d.id !== drill.id))
  if (isDemoOrg) return
  const queueKey = `drill_${drill.id}`
  const { error } = await supabase.from('drills').delete().eq('id', drill.id)
  if (error) {
    console.warn('deleteDrill: queued for retry', error)
    offlineStore.enqueue(queueKey, { table: 'drills', method: 'delete', match: { id: drill.id } })
  } else {
    offlineStore.dequeue(queueKey)
  }
}
