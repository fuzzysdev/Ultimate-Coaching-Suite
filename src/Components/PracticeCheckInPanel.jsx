import { useEffect, useState } from 'react'
import { fetchAttendance, getCachedAttendance, setAttendance } from '../lib/practiceHelpers'

// Same states as the Attendance page: 0 absent, 1 present, 2 excused
const STATES = [
  { label: 'Absent',  color: '#7a8099', bg: '#1a1f2e', border: '#2a2f42' },
  { label: 'Present', color: '#00e5a0', bg: '#0a3d2b', border: '#00e5a0' },
  { label: 'Excused', color: '#fbbf24', bg: '#2a2410', border: '#7a4a0a' },
]

// Slide-in check-in list for one practice. Each tap writes a single attendance
// cell (queued offline), so it never overwrites other coaches' check-ins.
function PracticeCheckInPanel({ roster, players, label, isDemoOrg, onClose }) {
  const [records, setRecords] = useState(() => getCachedAttendance(roster.id).records)

  useEffect(() => {
    let alive = true
    fetchAttendance(roster.id).then(a => { if (alive) setRecords(a.records) })
    return () => { alive = false }
  }, [roster.id])

  const stateOf = (pid) => records[pid]?.[label] ?? 0

  const setState = (pid, state) => {
    setRecords(prev => ({ ...prev, [pid]: { ...(prev[pid] || {}), [label]: state } }))
    setAttendance(roster.id, label, pid, state, isDemoOrg)
  }

  const markAllPresent = () => {
    players.filter(p => stateOf(p.id) === 0).forEach(p => setState(p.id, 1))
  }

  const present = players.filter(p => stateOf(p.id) === 1).length
  const excused = players.filter(p => stateOf(p.id) === 2).length
  const groups = roster.gender_type === 'single'
    ? [{ key: 'all', label: null, list: players }]
    : [
        { key: 'Female', label: '♀ Women', list: players.filter(p => p.gender === 'Female') },
        { key: 'Male',   label: '♂ Men',   list: players.filter(p => p.gender === 'Male') },
      ]

  const s = styles
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.panel} onClick={e => e.stopPropagation()}>
        <div style={s.header}>
          <div>
            <div style={s.kicker}>Check-In · {label}</div>
            <div style={s.counts}>
              <span style={{ color: '#00e5a0' }}>{present} here</span>
              {excused > 0 && <span style={{ color: '#fbbf24' }}> · {excused} excused</span>}
              <span style={{ color: '#7a8099' }}> · {players.length - present - excused} absent</span>
            </div>
          </div>
          <button onClick={onClose} style={s.closeBtn}>✕</button>
        </div>

        <button onClick={markAllPresent} style={s.allBtn}>Mark everyone else present</button>
        <p style={s.hint}>Tap a player to cycle Absent → Present → Excused</p>

        <div style={s.list}>
          {players.length === 0 && <p style={s.hint}>No players on this roster.</p>}
          {groups.map(g => (
            <div key={g.key}>
              {g.label && g.list.length > 0 && <div style={s.groupLabel}>{g.label}</div>}
              {g.list.map(p => {
                const st = STATES[stateOf(p.id)]
                return (
                  <button key={p.id} onClick={() => setState(p.id, (stateOf(p.id) + 1) % 3)}
                    style={{ ...s.row, background: st.bg, borderColor: st.border }}>
                    <span style={s.name}>{p.name}</span>
                    <span style={{ ...s.state, color: st.color }}>{stateOf(p.id) === 1 ? '✓ ' : ''}{st.label}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const font = "'Barlow Condensed', sans-serif"
const styles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 550, display: 'flex', justifyContent: 'flex-end' },
  panel: {
    width: '100%', maxWidth: '380px', height: '100%', background: '#181c26',
    borderLeft: '1px solid #2a2f42', display: 'flex', flexDirection: 'column',
    padding: '18px 16px', boxSizing: 'border-box'
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' },
  kicker: { fontFamily: font, fontSize: '18px', fontWeight: '800', color: '#e8eaf0', textTransform: 'uppercase', letterSpacing: '1px' },
  counts: { fontFamily: font, fontSize: '14px', fontWeight: '700', marginTop: '2px' },
  closeBtn: { background: '#1f2435', border: 'none', color: '#7a8099', fontSize: '16px', padding: '6px 10px', borderRadius: '7px', cursor: 'pointer' },
  allBtn: {
    background: 'rgba(0,229,160,0.12)', border: '1px solid rgba(0,229,160,0.4)', color: '#00e5a0',
    fontFamily: font, fontSize: '14px', fontWeight: '800', padding: '10px', borderRadius: '8px',
    textTransform: 'uppercase', cursor: 'pointer'
  },
  hint: { color: '#4a5068', fontFamily: font, fontSize: '12px', margin: '8px 0', textAlign: 'center' },
  list: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' },
  groupLabel: {
    fontFamily: font, fontSize: '11px', fontWeight: '800', letterSpacing: '2px', color: '#7a8099',
    textTransform: 'uppercase', margin: '10px 2px 6px'
  },
  row: {
    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    border: '1px solid', borderRadius: '8px', padding: '12px 14px', marginBottom: '6px', cursor: 'pointer'
  },
  name: { fontFamily: font, fontSize: '16px', fontWeight: '700', color: '#e8eaf0' },
  state: { fontFamily: font, fontSize: '13px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' },
}

export default PracticeCheckInPanel
