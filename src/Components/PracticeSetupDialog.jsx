import { useState } from 'react'
import { todayStr, formatPracticeDate, totalMinutes } from '../lib/practiceHelpers'

// New practice (practice = null) or edit details of an existing one.
// previousPractices: list to offer under "Copy blocks from".
function PracticeSetupDialog({ practice, previousPractices = [], defaultCopyFromId = '', onSave, onCancel }) {
  const editing = !!practice
  const [date,       setDate]       = useState(practice?.practice_date || todayStr())
  const [startTime,  setStartTime]  = useState(practice?.start_time || '18:00')
  const [duration,   setDuration]   = useState(practice?.duration_min || 90)
  const [location,   setLocation]   = useState(practice?.location || '')
  const [focus,      setFocus]      = useState(practice?.focus || '')
  const [copyFromId, setCopyFromId] = useState(defaultCopyFromId)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!date) return
    onSave({
      practice_date: date,
      start_time:    startTime || null,
      duration_min:  duration,
      location:      location.trim() || null,
      focus:         focus.trim() || null,
    }, copyFromId || null)
  }

  const s = styles
  return (
    <div style={s.overlay}>
      <div style={s.dialog}>
        <h2 style={s.title}>{editing ? 'Practice Details' : 'New Practice'}</h2>

        <form onSubmit={handleSubmit}>
          <div style={s.row}>
            <div style={{ ...s.field, flex: 1 }}>
              <label style={s.label}>Date *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={s.input} required />
            </div>
            <div style={{ ...s.field, flex: 1 }}>
              <label style={s.label}>Start Time</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={s.input} />
            </div>
          </div>

          <div style={s.field}>
            <label style={s.label}>Duration</label>
            <div style={s.stepper}>
              <button type="button" onClick={() => setDuration(d => Math.max(15, d - 15))} style={s.stepBtn}>−</button>
              <span style={s.stepValue}>{duration}<span style={s.stepUnit}> min</span></span>
              <button type="button" onClick={() => setDuration(d => Math.min(600, d + 15))} style={s.stepBtn}>+</button>
            </div>
          </div>

          <div style={s.field}>
            <label style={s.label}>Location</label>
            <input type="text" value={location} onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Riverside field 2" maxLength={100} style={s.input} />
          </div>

          <div style={s.field}>
            <label style={s.label}>Focus</label>
            <input type="text" value={focus} onChange={e => setFocus(e.target.value)}
              placeholder="e.g. Zone offense, reset throws" maxLength={200} style={s.input} />
          </div>

          {!editing && previousPractices.length > 0 && (
            <div style={s.field}>
              <label style={s.label}>Copy blocks from</label>
              <select value={copyFromId} onChange={e => setCopyFromId(e.target.value)} style={s.input}>
                <option value="">Start empty</option>
                {previousPractices.map(p => (
                  <option key={p.id} value={p.id}>
                    {formatPracticeDate(p.practice_date)}{p.focus ? ` — ${p.focus}` : ''} ({p.blocks.length} blocks, {totalMinutes(p.blocks)} min)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={s.actions}>
            <button type="button" onClick={onCancel} style={s.cancelBtn}>Cancel</button>
            <button type="submit" style={s.saveBtn}>{editing ? 'Save' : 'Create Practice'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 500,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
  },
  dialog: {
    background: '#181c26', border: '1px solid #2a2f42', borderRadius: '16px',
    width: '100%', maxWidth: '480px', padding: '28px 24px',
    maxHeight: '90vh', overflowY: 'auto'
  },
  title: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '22px',
    fontWeight: '800', color: '#e8eaf0', textTransform: 'uppercase',
    letterSpacing: '1px', margin: '0 0 24px'
  },
  row: { display: 'flex', gap: '12px' },
  field: { marginBottom: '20px' },
  label: {
    display: 'block', fontSize: '11px', fontWeight: '700', letterSpacing: '1.5px',
    textTransform: 'uppercase', color: '#7a8099',
    fontFamily: "'Barlow Condensed', sans-serif", marginBottom: '8px'
  },
  input: {
    width: '100%', background: '#1f2435', border: '1px solid #2a2f42',
    color: '#e8eaf0', fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: '16px', padding: '10px 12px', borderRadius: '8px',
    outline: 'none', boxSizing: 'border-box', colorScheme: 'dark'
  },
  stepper: { display: 'flex', alignItems: 'center', gap: '16px' },
  stepBtn: {
    width: '40px', height: '40px', background: '#1f2435', border: '1px solid #2a2f42',
    color: '#e8eaf0', fontSize: '20px', fontWeight: '700', borderRadius: '8px',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Barlow Condensed', sans-serif"
  },
  stepValue: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '28px',
    fontWeight: '800', color: '#00e5a0', minWidth: '90px', textAlign: 'center'
  },
  stepUnit: { fontSize: '14px', color: '#7a8099', fontWeight: '700' },
  actions: { display: 'flex', gap: '10px', marginTop: '8px' },
  cancelBtn: {
    flex: 1, background: 'transparent', border: '1px solid #2a2f42', color: '#7a8099',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', fontWeight: '700',
    padding: '12px', borderRadius: '8px', textTransform: 'uppercase', cursor: 'pointer'
  },
  saveBtn: {
    flex: 2, background: '#00e5a0', color: '#0f1117', border: 'none',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '15px', fontWeight: '800',
    padding: '12px', borderRadius: '8px', textTransform: 'uppercase',
    letterSpacing: '0.5px', cursor: 'pointer'
  }
}

export default PracticeSetupDialog
