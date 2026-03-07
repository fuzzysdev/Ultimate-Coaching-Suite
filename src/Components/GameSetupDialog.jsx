import React, { useState } from 'react'

function GameSetupDialog({ onStart, onCancel }) {
  const [opponent, setOpponent] = useState('')
  const [firstGender, setFirstGender] = useState('m')
  const [startingAction, setStartingAction] = useState('receive')
  const [direction, setDirection] = useState('right')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!opponent.trim()) return
    onStart({ opponent: opponent.trim(), firstGender, startingAction, direction })
  }

  const s = styles
  return (
    <div style={s.overlay}>
      <div style={s.dialog}>
        <div style={s.header}>
          <h2 style={s.title}>New Game Setup</h2>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Opponent */}
          <div style={s.field}>
            <label style={s.label}>Opponent *</label>
            <input
              type="text"
              value={opponent}
              onChange={e => setOpponent(e.target.value)}
              placeholder="Opponent team name"
              style={s.input}
              autoFocus
              required
              maxLength={100}
            />
          </div>

          {/* First Gender */}
          <div style={s.field}>
            <label style={s.label}>First Point Gender Ratio</label>
            <div style={s.toggleGroup}>
              <button
                type="button"
                onClick={() => setFirstGender('m')}
                style={{ ...s.toggleBtn, ...(firstGender === 'm' ? s.toggleBtnMale : {}) }}
              >
                <span style={s.toggleIcon}>♂</span>
                <div>
                  <div style={s.toggleTitle}>Male Ratio</div>
                  <div style={s.toggleSub}>4M / 3F on field</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setFirstGender('f')}
                style={{ ...s.toggleBtn, ...(firstGender === 'f' ? s.toggleBtnFemale : {}) }}
              >
                <span style={s.toggleIcon}>♀</span>
                <div>
                  <div style={s.toggleTitle}>Female Ratio</div>
                  <div style={s.toggleSub}>3M / 4F on field</div>
                </div>
              </button>
            </div>
          </div>

          {/* Pull or Receive */}
          <div style={s.field}>
            <label style={s.label}>Starting Action</label>
            <div style={s.toggleGroup}>
              <button
                type="button"
                onClick={() => setStartingAction('pull')}
                style={{ ...s.toggleBtn, ...(startingAction === 'pull' ? s.toggleBtnActive : {}) }}
              >
                <span style={s.toggleIcon}>🥏</span>
                <div>
                  <div style={s.toggleTitle}>Pulling</div>
                  <div style={s.toggleSub}>We kick off</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setStartingAction('receive')}
                style={{ ...s.toggleBtn, ...(startingAction === 'receive' ? s.toggleBtnActive : {}) }}
              >
                <span style={s.toggleIcon}>🙌</span>
                <div>
                  <div style={s.toggleTitle}>Receiving</div>
                  <div style={s.toggleSub}>Opponent kicks off</div>
                </div>
              </button>
            </div>
          </div>

          {/* Direction */}
          <div style={s.field}>
            <label style={s.label}>Attacking Direction (first point)</label>
            <div style={s.toggleGroup}>
              <button
                type="button"
                onClick={() => setDirection('left')}
                style={{ ...s.toggleBtn, ...(direction === 'left' ? s.toggleBtnActive : {}) }}
              >
                <span style={{ ...s.toggleIcon, fontSize: '28px' }}>←</span>
                <div>
                  <div style={s.toggleTitle}>Left</div>
                  <div style={s.toggleSub}>Attacking left end zone</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setDirection('right')}
                style={{ ...s.toggleBtn, ...(direction === 'right' ? s.toggleBtnActive : {}) }}
              >
                <span style={{ ...s.toggleIcon, fontSize: '28px' }}>→</span>
                <div>
                  <div style={s.toggleTitle}>Right</div>
                  <div style={s.toggleSub}>Attacking right end zone</div>
                </div>
              </button>
            </div>
          </div>

          <div style={s.actions}>
            <button type="button" onClick={onCancel} style={s.cancelBtn}>Cancel</button>
            <button type="submit" style={s.startBtn}>Start Game</button>
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
  header: { marginBottom: '24px' },
  title: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '22px',
    fontWeight: '800', color: '#e8eaf0', textTransform: 'uppercase',
    letterSpacing: '1px', margin: 0
  },
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
    outline: 'none', boxSizing: 'border-box'
  },
  toggleGroup: { display: 'flex', gap: '10px' },
  toggleBtn: {
    flex: 1, display: 'flex', alignItems: 'center', gap: '10px',
    background: '#1f2435', border: '2px solid #2a2f42', borderRadius: '10px',
    padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
    transition: 'all 0.15s'
  },
  toggleBtnActive: {
    background: 'rgba(0,229,160,0.1)', borderColor: '#00e5a0'
  },
  toggleBtnMale: {
    background: 'rgba(77,159,255,0.1)', borderColor: '#4d9fff'
  },
  toggleBtnFemale: {
    background: 'rgba(255,128,200,0.1)', borderColor: '#ff80c8'
  },
  toggleIcon: { fontSize: '22px', lineHeight: 1 },
  toggleTitle: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px',
    fontWeight: '700', color: '#e8eaf0', textTransform: 'uppercase', letterSpacing: '0.5px'
  },
  toggleSub: { fontSize: '11px', color: '#7a8099', marginTop: '2px' },
  actions: { display: 'flex', gap: '10px', marginTop: '8px' },
  cancelBtn: {
    flex: 1, background: 'transparent', border: '1px solid #2a2f42', color: '#7a8099',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', fontWeight: '700',
    padding: '12px', borderRadius: '8px', textTransform: 'uppercase', cursor: 'pointer'
  },
  startBtn: {
    flex: 2, background: '#00e5a0', color: '#0f1117', border: 'none',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '15px', fontWeight: '800',
    padding: '12px', borderRadius: '8px', textTransform: 'uppercase',
    letterSpacing: '0.5px', cursor: 'pointer'
  }
}

export default GameSetupDialog
