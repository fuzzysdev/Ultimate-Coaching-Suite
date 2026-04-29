import { useState } from 'react'

export default function GoalAssistModal({ players, onConfirm, onSkip }) {
  const [goalScorerId,   setGoalScorerId]   = useState(null)
  const [assistPlayerId, setAssistPlayerId] = useState(null)
  const [goalUnknown,    setGoalUnknown]    = useState(false)
  const [assistUnknown,  setAssistUnknown]  = useState(false)

  const handleConfirm = () => {
    onConfirm(
      goalUnknown   ? null : goalScorerId,
      assistUnknown ? null : assistPlayerId,
    )
  }

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <div style={s.title}>Point Recorded</div>

        {/* Assist (thrower) — shown first */}
        <div style={s.section}>
          <div style={s.sectionTitle}>Who threw? (assist)</div>
          <div style={s.playerList}>
            {players.map(p => (
              <button
                key={p.id}
                onClick={() => { setAssistPlayerId(p.id); setAssistUnknown(false) }}
                style={{ ...s.playerBtn, ...(assistPlayerId === p.id && !assistUnknown ? s.playerBtnActive : {}) }}
                disabled={assistUnknown}
              >
                {p.name}
              </button>
            ))}
          </div>
          <label style={s.unknownLabel}>
            <input
              type="checkbox"
              checked={assistUnknown}
              onChange={e => { setAssistUnknown(e.target.checked); if (e.target.checked) setAssistPlayerId(null) }}
              style={s.checkbox}
            />
            Unknown
          </label>
        </div>

        {/* Goal scorer (catcher) — shown second */}
        <div style={s.section}>
          <div style={s.sectionTitle}>Who scored? (caught)</div>
          <div style={s.playerList}>
            {players.map(p => (
              <button
                key={p.id}
                onClick={() => { setGoalScorerId(p.id); setGoalUnknown(false) }}
                style={{ ...s.playerBtn, ...(goalScorerId === p.id && !goalUnknown ? s.playerBtnActive : {}) }}
                disabled={goalUnknown}
              >
                {p.name}
              </button>
            ))}
          </div>
          <label style={s.unknownLabel}>
            <input
              type="checkbox"
              checked={goalUnknown}
              onChange={e => { setGoalUnknown(e.target.checked); if (e.target.checked) setGoalScorerId(null) }}
              style={s.checkbox}
            />
            Unknown
          </label>
        </div>

        {/* Actions */}
        <div style={s.actions}>
          <button onClick={onSkip} style={s.skipBtn}>Skip</button>
          <button onClick={handleConfirm} style={s.confirmBtn}>Save Stats</button>
        </div>
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 200, padding: 16,
  },
  modal: {
    background: '#181c26', border: '1px solid #2a2f42', borderRadius: 16,
    padding: '20px 20px 16px', width: '100%', maxWidth: 380,
    display: 'flex', flexDirection: 'column', gap: 0,
    maxHeight: '90vh', overflowY: 'auto',
  },
  title: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 900,
    color: '#00e5a0', textTransform: 'uppercase', letterSpacing: 2,
    marginBottom: 16, textAlign: 'center',
  },
  section: {
    borderTop: '1px solid #2a2f42', paddingTop: 14, paddingBottom: 14,
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  sectionTitle: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 800,
    color: '#a0a8c0', textTransform: 'uppercase', letterSpacing: 1.5,
  },
  playerList: {
    display: 'flex', flexWrap: 'wrap', gap: 6,
  },
  playerBtn: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700,
    color: '#c8ccd8', background: '#1f2435', border: '1px solid #3a3f52',
    borderRadius: 6, padding: '6px 12px', cursor: 'pointer', letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  playerBtnActive: {
    background: 'rgba(0,229,160,0.15)', border: '1px solid #00e5a0', color: '#00e5a0',
  },
  unknownLabel: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700,
    color: '#7a8099', textTransform: 'uppercase', letterSpacing: 1,
    display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
    marginTop: 2,
  },
  checkbox: { width: 14, height: 14, accentColor: '#00e5a0', cursor: 'pointer' },
  actions: {
    borderTop: '1px solid #2a2f42', paddingTop: 14,
    display: 'flex', gap: 10, justifyContent: 'flex-end',
  },
  skipBtn: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 800,
    color: '#4a5068', background: 'transparent', border: '1px solid #2a2f42',
    borderRadius: 8, padding: '8px 18px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 1,
  },
  confirmBtn: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 800,
    color: '#0f1117', background: '#00e5a0', border: 'none',
    borderRadius: 8, padding: '8px 20px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 1,
  },
}
