import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { offlineStore } from '../lib/offlineStore'
import {
  BLOCK_TYPES, blockType, newBlock, newId, formatClock, formatPracticeDate, totalMinutes,
  savePractice, deletePractice, attendanceLabelFor, getCachedAttendance, renameAttendancePractice,
} from '../lib/practiceHelpers'
import PracticeSetupDialog from '../Components/PracticeSetupDialog'
import PracticeCheckInPanel from '../Components/PracticeCheckInPanel'
import RunPracticeMode from '../Components/RunPracticeMode'
import DrillLibraryModal from '../Components/DrillLibraryModal'
import DrillFormModal from '../Components/DrillFormModal'
import ConfirmDialog from '../Components/ConfirmDialog'

const SAVE_DELAY_MS = 700

export default function PracticeEditor({ practice: initial, org, roster, isDemoOrg, onBack, onChanged }) {
  const [practice,     setPractice]     = useState(initial)
  const [players,      setPlayers]      = useState(() => offlineStore.getCache(`players_${roster.id}`) || [])
  const [showDetails,  setShowDetails]  = useState(false)
  const [showCheckIn,  setShowCheckIn]  = useState(false)
  const [showRun,      setShowRun]      = useState(() => !!localStorage.getItem(`ucs_run_${initial.id}`))
  const [showLibrary,  setShowLibrary]  = useState(false)
  const [drillPrefill, setDrillPrefill] = useState(null)
  const [confirmDel,   setConfirmDel]   = useState(false)
  const [newReminder,  setNewReminder]  = useState('')
  const [savedFlash,   setSavedFlash]   = useState(false)

  const saveTimer   = useRef(null)
  // Always the newest practice — updated synchronously in update() so back-to-back
  // edits compose correctly before React re-renders
  const latestRef   = useRef(initial)

  // Players for check-in (same cache key the game sheet uses)
  useEffect(() => {
    let alive = true
    supabase.from('players').select('id, name, gender, position, o_d_line, sort_order')
      .eq('roster_id', roster.id).order('name')
      .then(({ data, error }) => {
        if (!alive || error) return
        offlineStore.setCache(`players_${roster.id}`, data || [])
        setPlayers(data || [])
      })
    return () => { alive = false }
  }, [roster.id])

  // Flush a pending save if the editor closes before the debounce fires
  useEffect(() => () => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); savePractice(latestRef.current, isDemoOrg) }
  }, [])

  // Every edit goes through here: update UI + cached list now, write to DB shortly after
  const update = (changes) => {
    const prev = latestRef.current
    const next = { ...prev, ...(typeof changes === 'function' ? changes(prev) : changes) }
    latestRef.current = next
    setPractice(next)
    onChanged(next)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      saveTimer.current = null
      await savePractice(latestRef.current, isDemoOrg)
      setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1200)
    }, SAVE_DELAY_MS)
  }

  // ── Blocks ────────────────────────────────────────────────────────────────
  const setBlocks   = (fn) => update(prev => ({ blocks: fn(prev.blocks) }))
  const patchBlock  = (id, changes) => setBlocks(bs => bs.map(b => (b.id === id ? { ...b, ...changes } : b)))
  const removeBlock = (id) => setBlocks(bs => bs.filter(b => b.id !== id))
  const addBlock    = (overrides) => setBlocks(bs => [...bs, newBlock(overrides)])
  const dupBlock    = (b) => setBlocks(bs => {
    const i = bs.findIndex(x => x.id === b.id)
    const copy = { ...b, id: newId() }
    return [...bs.slice(0, i + 1), copy, ...bs.slice(i + 1)]
  })
  const moveBlock = (id, dir) => setBlocks(bs => {
    const i = bs.findIndex(b => b.id === id)
    const j = i + dir
    if (j < 0 || j >= bs.length) return bs
    const next = [...bs]
    ;[next[i], next[j]] = [next[j], next[i]]
    return next
  })

  const pickDrill = (d) => {
    addBlock({
      type: d.block_type || 'drill', duration: d.default_duration || 10,
      title: d.name, notes: d.description || '', drill_id: d.id,
    })
    setShowLibrary(false)
  }

  // ── Reminders ─────────────────────────────────────────────────────────────
  const addReminder = (e) => {
    e.preventDefault()
    const text = newReminder.trim()
    if (!text) return
    update(prev => ({ reminders: [...prev.reminders, { id: newId(), text, done: false }] }))
    setNewReminder('')
  }
  const toggleReminder = (id) => update(prev => ({ reminders: prev.reminders.map(r => (r.id === id ? { ...r, done: !r.done } : r)) }))
  const removeReminder = (id) => update(prev => ({ reminders: prev.reminders.filter(r => r.id !== id) }))

  // ── Details (date change also renames the attendance column) ─────────────
  const saveDetails = (details) => {
    setShowDetails(false)
    if (details.practice_date !== practice.practice_date && practice.attendance_label) {
      const others = getCachedAttendance(roster.id).practices.filter(l => l !== practice.attendance_label)
      const newLabel = attendanceLabelFor(details.practice_date, others)
      renameAttendancePractice(roster.id, practice.attendance_label, newLabel, isDemoOrg)
      update({ ...details, attendance_label: newLabel })
    } else {
      update(details)
    }
  }

  const handleDelete = async () => {
    clearTimeout(saveTimer.current); saveTimer.current = null
    localStorage.removeItem(`ucs_run_${practice.id}`)
    await deletePractice(practice, isDemoOrg)
    onBack({ deletedId: practice.id })
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const planned  = totalMinutes(practice.blocks)
  const budget   = practice.duration_min
  const over     = planned > budget
  const pct      = Math.min(100, Math.round((planned / budget) * 100))
  const openReminders = practice.reminders.filter(r => !r.done).length

  const s = styles

  if (showRun) {
    return <RunPracticeMode practice={practice} onClose={() => setShowRun(false)} />
  }

  return (
    <div style={s.container}>
      {showDetails && (
        <PracticeSetupDialog practice={practice} onSave={saveDetails} onCancel={() => setShowDetails(false)} />
      )}
      {showCheckIn && (
        <PracticeCheckInPanel roster={roster} players={players} label={practice.attendance_label}
          isDemoOrg={isDemoOrg} onClose={() => setShowCheckIn(false)} />
      )}
      {showLibrary && (
        <DrillLibraryModal org={org} isDemoOrg={isDemoOrg} onPick={pickDrill} onClose={() => setShowLibrary(false)} />
      )}
      {drillPrefill && (
        <DrillFormModal org={org} drill={drillPrefill} isDemoOrg={isDemoOrg}
          onSaved={(d) => { patchBlock(drillPrefill._blockId, { drill_id: d.id }); setDrillPrefill(null) }}
          onClose={() => setDrillPrefill(null)} />
      )}
      {confirmDel && (
        <ConfirmDialog
          message="Delete this practice plan? Attendance already taken for this date is kept on the Attendance page."
          onConfirm={handleDelete} onCancel={() => setConfirmDel(false)} />
      )}

      <div style={s.inner}>
        {/* Header */}
        <div style={s.header}>
          <button onClick={() => onBack({})} style={s.backBtn}>‹ Practices</button>
          {savedFlash && <span style={s.saved}>✓ Saved</span>}
        </div>

        <button onClick={() => setShowDetails(true)} style={s.titleCard}>
          <div style={s.dateTitle}>{formatPracticeDate(practice.practice_date, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
          <div style={s.metaLine}>
            {practice.start_time && <span>{formatClock(practice.start_time)}–{formatClock(practice.start_time, budget)}</span>}
            <span>{budget} min</span>
            {practice.location && <span>📍 {practice.location}</span>}
          </div>
          {practice.focus && <div style={s.focus}>Focus: {practice.focus}</div>}
          <div style={s.editHint}>Tap to edit details</div>
        </button>

        <div style={s.actionRow}>
          <button onClick={() => setShowCheckIn(true)} disabled={!practice.attendance_label} style={s.checkInBtn}>
            ✓ Check-In
          </button>
          <button onClick={() => setShowRun(true)} disabled={practice.blocks.length === 0}
            style={{ ...s.runBtn, opacity: practice.blocks.length === 0 ? 0.4 : 1 }}>
            ▶ Run Practice
          </button>
        </div>

        {/* Time budget */}
        <div style={s.budget}>
          <div style={s.budgetText}>
            <span style={{ color: over ? '#ff4d6d' : '#00e5a0' }}>{planned}</span>
            <span style={{ color: '#7a8099' }}> / {budget} min planned</span>
            {over && <span style={{ color: '#ff4d6d' }}> · {planned - budget} over</span>}
            {!over && planned < budget && <span style={{ color: '#7a8099' }}> · {budget - planned} left</span>}
          </div>
          <div style={s.budgetTrack}>
            <div style={{ ...s.budgetFill, width: `${pct}%`, background: over ? '#ff4d6d' : '#00e5a0' }} />
          </div>
        </div>

        {/* Blocks */}
        <div style={s.sectionLabel}>Plan</div>
        {practice.blocks.length === 0 && (
          <p style={s.empty}>No blocks yet. Add a block or pull one from the drill library.</p>
        )}
        {practice.blocks.map((b, i) => {
          const t = blockType(b.type)
          const startMin = practice.blocks.slice(0, i).reduce((sum, x) => sum + (Number(x.duration) || 0), 0)
          return (
            <div key={b.id} style={{ ...s.block, borderLeftColor: t.color }}>
              <div style={s.blockTop}>
                <span style={s.clock}>{formatClock(practice.start_time, startMin) || `+${startMin}m`}</span>
                <div style={s.durStepper}>
                  <button onClick={() => patchBlock(b.id, { duration: Math.max(1, (Number(b.duration) || 0) - 5) })} style={s.durBtn}>−</button>
                  <input type="number" inputMode="numeric" min={1} max={300} value={b.duration}
                    onChange={e => patchBlock(b.id, { duration: Math.max(1, Math.min(300, parseInt(e.target.value, 10) || 1)) })}
                    style={s.durInput} />
                  <span style={s.durUnit}>min</span>
                  <button onClick={() => patchBlock(b.id, { duration: Math.min(300, (Number(b.duration) || 0) + 5) })} style={s.durBtn}>+</button>
                </div>
              </div>

              <div style={s.typeChips}>
                {BLOCK_TYPES.map(bt => (
                  <button key={bt.key} onClick={() => patchBlock(b.id, { type: bt.key })}
                    style={{ ...s.typeChip, ...(b.type === bt.key ? { borderColor: bt.color, color: bt.color, background: `${bt.color}1f` } : {}) }}>
                    {bt.label}
                  </button>
                ))}
              </div>

              <input type="text" value={b.title} onChange={e => patchBlock(b.id, { title: e.target.value })}
                placeholder={`${t.label} name (optional)`} maxLength={100} style={s.titleInput} />
              <textarea value={b.notes} onChange={e => patchBlock(b.id, { notes: e.target.value })}
                placeholder="Notes, setup, coaching points..." maxLength={2000} rows={2} style={s.notesInput} />

              <div style={s.blockActions}>
                <button onClick={() => moveBlock(b.id, -1)} disabled={i === 0} style={{ ...s.iconBtn, opacity: i === 0 ? 0.3 : 1 }} title="Move up">▲</button>
                <button onClick={() => moveBlock(b.id, 1)} disabled={i === practice.blocks.length - 1}
                  style={{ ...s.iconBtn, opacity: i === practice.blocks.length - 1 ? 0.3 : 1 }} title="Move down">▼</button>
                <span style={{ flex: 1 }} />
                {!b.drill_id && (
                  <button onClick={() => setDrillPrefill({
                    name: b.title, description: b.notes, block_type: b.type, default_duration: b.duration, _blockId: b.id,
                  })} style={s.textBtn}>Save as drill</button>
                )}
                {b.drill_id && <span style={s.fromLib}>📚 Library drill</span>}
                <button onClick={() => dupBlock(b)} style={s.textBtn}>Duplicate</button>
                <button onClick={() => removeBlock(b.id)} style={{ ...s.textBtn, color: '#ff4d6d' }}>Remove</button>
              </div>
            </div>
          )
        })}

        <div style={s.addRow}>
          <button onClick={() => addBlock()} style={s.addBtn}>+ Add Block</button>
          <button onClick={() => setShowLibrary(true)} style={s.libBtn}>📚 From Drill Library</button>
        </div>

        {/* Reminders */}
        <div style={s.sectionLabel}>
          Reminders {openReminders > 0 && <span style={s.badge}>{openReminders}</span>}
        </div>
        <div style={s.reminders}>
          {practice.reminders.map(r => (
            <div key={r.id} style={s.reminderRow}>
              <button onClick={() => toggleReminder(r.id)} style={{ ...s.check, ...(r.done ? s.checkOn : {}) }}>{r.done ? '✓' : ''}</button>
              <span style={{ ...s.reminderText, ...(r.done ? s.reminderDone : {}) }}>{r.text}</span>
              <button onClick={() => removeReminder(r.id)} style={s.xBtn}>✕</button>
            </div>
          ))}
          <form onSubmit={addReminder} style={s.reminderForm}>
            <input type="text" value={newReminder} onChange={e => setNewReminder(e.target.value)}
              placeholder="e.g. Remind players about travel forms" maxLength={200} style={s.reminderInput} />
            <button type="submit" style={s.reminderAdd}>Add</button>
          </form>
        </div>

        <button onClick={() => setConfirmDel(true)} style={s.deleteBtn}>Delete Practice</button>
      </div>
    </div>
  )
}

const font = "'Barlow Condensed', sans-serif"
const styles = {
  container: { flex: 1, overflowY: 'auto', background: '#0f1117', padding: '16px' },
  inner: { maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 40 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: {
    background: 'none', border: 'none', color: '#00e5a0', fontFamily: font, fontSize: '16px',
    fontWeight: '700', textTransform: 'uppercase', cursor: 'pointer', padding: '4px 0'
  },
  saved: { color: '#00e5a0', fontFamily: font, fontSize: '13px', fontWeight: '700', textTransform: 'uppercase' },
  titleCard: {
    background: '#181c26', border: '1px solid #2a2f42', borderRadius: '12px', padding: '16px',
    textAlign: 'left', cursor: 'pointer'
  },
  dateTitle: { fontFamily: font, fontSize: '26px', fontWeight: '900', color: '#e8eaf0', textTransform: 'uppercase', letterSpacing: '0.5px' },
  metaLine: { display: 'flex', flexWrap: 'wrap', gap: '14px', fontFamily: font, fontSize: '15px', fontWeight: '700', color: '#7a8099', marginTop: 4 },
  focus: { fontFamily: font, fontSize: '15px', color: '#c8ccd8', marginTop: 6 },
  editHint: { fontFamily: font, fontSize: '11px', color: '#4a5068', textTransform: 'uppercase', letterSpacing: '1px', marginTop: 8 },
  actionRow: { display: 'flex', gap: '10px' },
  checkInBtn: {
    flex: 1, background: '#181c26', border: '1px solid #2a2f42', color: '#e8eaf0', fontFamily: font,
    fontSize: '16px', fontWeight: '800', padding: '14px', borderRadius: '10px', textTransform: 'uppercase', cursor: 'pointer'
  },
  runBtn: {
    flex: 2, background: '#00e5a0', border: 'none', color: '#0f1117', fontFamily: font,
    fontSize: '18px', fontWeight: '900', padding: '14px', borderRadius: '10px', textTransform: 'uppercase', cursor: 'pointer'
  },
  budget: { background: '#181c26', border: '1px solid #2a2f42', borderRadius: '10px', padding: '12px 14px' },
  budgetText: { fontFamily: font, fontSize: '16px', fontWeight: '800', marginBottom: 8 },
  budgetTrack: { height: 8, background: '#1f2435', borderRadius: 4, overflow: 'hidden' },
  budgetFill: { height: '100%', borderRadius: 4, transition: 'width 0.2s' },
  sectionLabel: {
    fontFamily: font, fontSize: '12px', fontWeight: '800', letterSpacing: '2px', color: '#7a8099',
    textTransform: 'uppercase', marginTop: 8, display: 'flex', alignItems: 'center', gap: 8
  },
  badge: { background: '#f0a500', color: '#0f1117', borderRadius: 10, padding: '1px 7px', fontSize: 11, letterSpacing: 0 },
  empty: { color: '#4a5068', fontFamily: font, fontSize: '14px', textAlign: 'center', margin: '8px 0' },
  block: {
    background: '#181c26', border: '1px solid #2a2f42', borderLeft: '4px solid', borderRadius: '10px',
    padding: '12px', display: 'flex', flexDirection: 'column', gap: 10
  },
  blockTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  clock: { fontFamily: font, fontSize: '15px', fontWeight: '800', color: '#7a8099' },
  durStepper: { display: 'flex', alignItems: 'center', gap: 6 },
  durBtn: {
    width: 36, height: 36, background: '#1f2435', border: '1px solid #2a2f42', color: '#e8eaf0',
    fontSize: '18px', fontWeight: '700', borderRadius: '8px', cursor: 'pointer'
  },
  durInput: {
    width: 52, background: '#1f2435', border: '1px solid #2a2f42', color: '#00e5a0', fontFamily: font,
    fontSize: '20px', fontWeight: '800', textAlign: 'center', padding: '4px', borderRadius: '8px', outline: 'none'
  },
  durUnit: { fontFamily: font, fontSize: '12px', color: '#7a8099', fontWeight: '700' },
  typeChips: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  typeChip: {
    flexShrink: 0, background: '#1f2435', border: '1px solid #2a2f42', color: '#7a8099', fontFamily: font,
    fontSize: '12px', fontWeight: '700', padding: '6px 10px', borderRadius: '14px', textTransform: 'uppercase', cursor: 'pointer'
  },
  titleInput: {
    background: '#1f2435', border: '1px solid #2a2f42', color: '#e8eaf0', fontFamily: font,
    fontSize: '17px', fontWeight: '700', padding: '9px 11px', borderRadius: '8px', outline: 'none'
  },
  notesInput: {
    background: '#1f2435', border: '1px solid #2a2f42', color: '#c8ccd8', fontFamily: font,
    fontSize: '15px', padding: '9px 11px', borderRadius: '8px', outline: 'none', resize: 'vertical'
  },
  blockActions: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  iconBtn: {
    width: 34, height: 30, background: '#1f2435', border: '1px solid #2a2f42', color: '#e8eaf0',
    fontSize: '12px', borderRadius: '7px', cursor: 'pointer'
  },
  textBtn: {
    background: 'none', border: 'none', color: '#7a8099', fontFamily: font, fontSize: '13px',
    fontWeight: '700', textTransform: 'uppercase', cursor: 'pointer', padding: '6px'
  },
  fromLib: { fontFamily: font, fontSize: '12px', color: '#4d9fff', fontWeight: '700', textTransform: 'uppercase' },
  addRow: { display: 'flex', gap: 10 },
  addBtn: {
    flex: 1, background: 'rgba(0,229,160,0.1)', border: '1px dashed rgba(0,229,160,0.5)', color: '#00e5a0',
    fontFamily: font, fontSize: '16px', fontWeight: '800', padding: '14px', borderRadius: '10px', textTransform: 'uppercase', cursor: 'pointer'
  },
  libBtn: {
    flex: 1, background: 'rgba(77,159,255,0.1)', border: '1px dashed rgba(77,159,255,0.5)', color: '#4d9fff',
    fontFamily: font, fontSize: '16px', fontWeight: '800', padding: '14px', borderRadius: '10px', textTransform: 'uppercase', cursor: 'pointer'
  },
  reminders: { background: '#181c26', border: '1px solid #2a2f42', borderRadius: '10px', padding: '8px 12px' },
  reminderRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #1f2435' },
  check: {
    width: 26, height: 26, flexShrink: 0, border: '2px solid #2a2f42', borderRadius: 6, background: 'none',
    color: '#0f1117', fontWeight: 900, cursor: 'pointer', padding: 0
  },
  checkOn: { background: '#00e5a0', borderColor: '#00e5a0' },
  reminderText: { flex: 1, fontFamily: font, fontSize: '16px', color: '#e8eaf0' },
  reminderDone: { color: '#4a5068', textDecoration: 'line-through' },
  xBtn: { background: 'none', border: 'none', color: '#4a5068', fontSize: '14px', cursor: 'pointer', padding: 6 },
  reminderForm: { display: 'flex', gap: 8, padding: '8px 0 4px' },
  reminderInput: {
    flex: 1, background: '#1f2435', border: '1px solid #2a2f42', color: '#e8eaf0', fontFamily: font,
    fontSize: '15px', padding: '9px 11px', borderRadius: '8px', outline: 'none'
  },
  reminderAdd: {
    background: '#1f2435', border: '1px solid #2a2f42', color: '#00e5a0', fontFamily: font, fontSize: '14px',
    fontWeight: '800', padding: '0 14px', borderRadius: '8px', textTransform: 'uppercase', cursor: 'pointer'
  },
  deleteBtn: {
    marginTop: 16, background: 'none', border: '1px solid rgba(255,77,109,0.3)', color: '#ff4d6d', fontFamily: font,
    fontSize: '14px', fontWeight: '700', padding: '12px', borderRadius: '10px', textTransform: 'uppercase', cursor: 'pointer'
  },
}
