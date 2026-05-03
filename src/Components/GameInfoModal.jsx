import { useState, useEffect, useRef } from 'react'

export default function GameInfoModal({
  setup, points, halftimeAfterPoint, onMarkHalftime, onClearHalftime,
  startTime, endTime, onChangeStartTime, onChangeEndTime,
  onUpdateSetup, onAbandon, onClose,
  onForceRefresh, onAdjustScore,
}) {
  const [timerSecs,      setTimerSecs]      = useState(0)
  const [timerRunning,   setTimerRunning]   = useState(false)
  const [abandonConfirm, setAbandonConfirm] = useState(false)
  const timerRef = useRef(null)
  const MAX_TIMER = 15 * 60

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setTimerSecs(prev => {
          if (prev >= MAX_TIMER) { clearInterval(timerRef.current); setTimerRunning(false); return MAX_TIMER }
          return prev + 1
        })
      }, 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [timerRunning])

  const formatTime = (s) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  const timerDone  = timerSecs >= MAX_TIMER
  const timerColor = timerDone ? '#ff4d6d' : timerRunning ? '#00e5a0' : '#e8eaf0'

  return (
    <div style={MS.overlay} onClick={onClose}>
      <div style={MS.modal} onClick={e => e.stopPropagation()}>
        <div style={MS.title}>GAME INFO</div>

        {/* Times */}
        <div style={MS.section}>
          <div style={MS.fieldRow}>
            <span style={MS.label}>Start Time</span>
            <input value={startTime} onChange={e => onChangeStartTime(e.target.value)}
              style={MS.input} placeholder="e.g. 10:00 AM" maxLength={20} />
          </div>
          <div style={MS.fieldRow}>
            <span style={MS.label}>End Time</span>
            <input value={endTime} onChange={e => onChangeEndTime(e.target.value)}
              style={MS.input} placeholder="e.g. 12:00 PM" maxLength={20} />
          </div>
        </div>

        {/* Setup toggles */}
        <div style={MS.section}>
          <div style={MS.fieldRow}>
            <span style={MS.label}>Starting Side</span>
            <div style={MS.toggleGroup}>
              <button onClick={() => onUpdateSetup({ direction: 'left' })}
                style={{ ...MS.toggleBtn, ...(setup.direction === 'left' ? MS.toggleActive : {}) }}>
                ← Left
              </button>
              <button onClick={() => onUpdateSetup({ direction: 'right' })}
                style={{ ...MS.toggleBtn, ...(setup.direction === 'right' ? MS.toggleActive : {}) }}>
                → Right
              </button>
            </div>
          </div>
          <div style={MS.fieldRow}>
            <span style={MS.label}>Starting</span>
            <div style={MS.toggleGroup}>
              <button onClick={() => onUpdateSetup({ startingAction: 'pull' })}
                style={{ ...MS.toggleBtn, ...(setup.startingAction === 'pull' ? MS.toggleActive : {}) }}>
                Pull
              </button>
              <button onClick={() => onUpdateSetup({ startingAction: 'receive' })}
                style={{ ...MS.toggleBtn, ...(setup.startingAction === 'receive' ? MS.toggleActive : {}) }}>
                Receive
              </button>
            </div>
          </div>
          <div style={MS.fieldRow}>
            <span style={MS.label}>First Gender</span>
            <div style={MS.toggleGroup}>
              <button onClick={() => onUpdateSetup({ firstGender: 'm' })}
                style={{ ...MS.toggleBtn, ...(setup.firstGender === 'm' ? MS.toggleActiveM : {}) }}>
                Male
              </button>
              <button onClick={() => onUpdateSetup({ firstGender: 'f' })}
                style={{ ...MS.toggleBtn, ...(setup.firstGender === 'f' ? MS.toggleActiveF : {}) }}>
                Female
              </button>
            </div>
          </div>
        </div>

        {/* Halftime */}
        <div style={MS.section}>
          <div style={MS.sectionTitle}>HALFTIME</div>
          {halftimeAfterPoint !== null ? (
            <div style={MS.htStatus}>
              <span style={MS.htLabel}>Half after Pt {halftimeAfterPoint + 1}</span>
              <button onClick={onClearHalftime} style={MS.clearBtn}>Clear</button>
            </div>
          ) : (
            <button onClick={onMarkHalftime} disabled={points.length === 0}
              style={{ ...MS.htBtn, opacity: points.length === 0 ? 0.4 : 1 }}>
              Mark Halftime Now
            </button>
          )}
        </div>

        {/* Timer */}
        <div style={MS.section}>
          <div style={MS.sectionTitle}>BREAK TIMER</div>
          <div style={{ ...MS.timerDisplay, color: timerColor }}>
            {formatTime(timerSecs)}
          </div>
          {timerDone && <div style={MS.timerAlert}>TIME'S UP</div>}
          <div style={MS.timerBtns}>
            <button onClick={() => setTimerRunning(r => !r)} disabled={timerDone}
              style={{ ...MS.timerBtn, background: timerRunning ? '#ff4d6d' : '#00e5a0', color: '#0f1117',
                opacity: timerDone ? 0.4 : 1 }}>
              {timerRunning ? 'Pause' : 'Start'}
            </button>
            <button onClick={() => { setTimerSecs(0); setTimerRunning(false) }}
              style={{ ...MS.timerBtn, background: '#2a2f42', color: '#7a8099' }}>
              Reset
            </button>
          </div>
        </div>

        {/* Score sync */}
        {(onForceRefresh || onAdjustScore) && (
          <div style={MS.section}>
            <div style={MS.sectionTitle}>SCORE SYNC</div>
            {onForceRefresh && (
              <button onClick={() => { onForceRefresh(); onClose() }} style={MS.syncBtn}>
                Sync from DB
              </button>
            )}
            {onAdjustScore && points.length > 0 && (
              <>
                <div style={MS.scoreAdjRow}>
                  <button onClick={() => onAdjustScore('us', -1)} style={MS.adjBtn}>−</button>
                  <span style={{ ...MS.adjLabel, color: '#00e5a0' }}>
                    US {points[points.length - 1].ourScoreAfter}
                  </span>
                  <button onClick={() => onAdjustScore('us', +1)} style={MS.adjBtn}>+</button>
                  <span style={MS.adjSep}> · </span>
                  <button onClick={() => onAdjustScore('them', -1)} style={MS.adjBtn}>−</button>
                  <span style={{ ...MS.adjLabel, color: '#ff4d6d' }}>
                    THEM {points[points.length - 1].theirScoreAfter}
                  </span>
                  <button onClick={() => onAdjustScore('them', +1)} style={MS.adjBtn}>+</button>
                </div>
                <div style={MS.adjWarning}>
                  Corrects score display only — use Sync from DB first if possible
                </div>
              </>
            )}
          </div>
        )}

        {/* Abandon game */}
        <div style={MS.section}>
          {!abandonConfirm ? (
            <button onClick={() => setAbandonConfirm(true)} style={MS.abandonBtn}>
              Exit Without Saving
            </button>
          ) : (
            <div style={MS.abandonConfirmBox}>
              <div style={MS.abandonWarning}>Delete this game and all its points? This cannot be undone.</div>
              <div style={MS.abandonBtns}>
                <button onClick={() => setAbandonConfirm(false)} style={MS.abandonKeepBtn}>Keep Playing</button>
                <button onClick={onAbandon} style={MS.abandonConfirmBtn}>Delete Game</button>
              </div>
            </div>
          )}
        </div>

        <button onClick={onClose} style={MS.closeBtn}>Done</button>
      </div>
    </div>
  )
}

const MS = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100, padding: 16,
  },
  modal: {
    background: '#181c26', border: '1px solid #2a2f42', borderRadius: 16,
    padding: '20px 20px 16px', width: '100%', maxWidth: 380,
    display: 'flex', flexDirection: 'column', gap: 0,
    maxHeight: '90vh', overflowY: 'auto',
  },
  title: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 900,
    color: '#e8eaf0', textTransform: 'uppercase', letterSpacing: 2,
    marginBottom: 16, textAlign: 'center',
  },
  section: {
    borderTop: '1px solid #2a2f42', paddingTop: 14, paddingBottom: 14,
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  sectionTitle: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 800,
    color: '#4a5068', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 2,
  },
  fieldRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  label: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700,
    color: '#7a8099', textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0,
  },
  input: {
    background: '#0f1117', border: '1px solid #2a2f42', borderRadius: 6,
    color: '#e8eaf0', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13,
    fontWeight: 600, padding: '6px 10px', width: 130, outline: 'none',
  },
  toggleGroup: { display: 'flex', gap: 4 },
  toggleBtn: {
    background: '#0f1117', border: '1px solid #2a2f42', borderRadius: 6,
    color: '#7a8099', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
    fontWeight: 700, padding: '5px 10px', cursor: 'pointer', textTransform: 'uppercase',
  },
  toggleActive:  { background: 'rgba(0,229,160,0.15)', border: '1px solid #00e5a0', color: '#00e5a0' },
  toggleActiveM: { background: 'rgba(77,159,255,0.15)', border: '1px solid #4d9fff', color: '#4d9fff' },
  toggleActiveF: { background: 'rgba(255,128,200,0.15)', border: '1px solid #ff80c8', color: '#ff80c8' },

  htStatus: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  htLabel: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700,
    color: 'rgba(255,152,0,0.9)',
  },
  clearBtn: {
    background: 'transparent', border: '1px solid #2a2f42', borderRadius: 6,
    color: '#7a8099', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
    fontWeight: 700, padding: '4px 10px', cursor: 'pointer', textTransform: 'uppercase',
  },
  htBtn: {
    background: 'rgba(255,152,0,0.12)', border: '1px solid rgba(255,152,0,0.5)',
    borderRadius: 8, color: 'rgba(255,152,0,1)',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 800,
    padding: '10px 0', textTransform: 'uppercase', letterSpacing: 0.5,
    cursor: 'pointer', width: '100%',
  },

  timerDisplay: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 52, fontWeight: 900,
    letterSpacing: 2, textAlign: 'center', lineHeight: 1, padding: '8px 0',
  },
  timerAlert: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 800,
    color: '#ff4d6d', textTransform: 'uppercase', letterSpacing: 2, textAlign: 'center',
    marginBottom: 4,
  },
  timerBtns: { display: 'flex', gap: 8 },
  timerBtn: {
    flex: 1, border: 'none', borderRadius: 8,
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 800,
    padding: '10px 0', textTransform: 'uppercase', letterSpacing: 0.5, cursor: 'pointer',
  },

  syncBtn: {
    background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.35)',
    borderRadius: 8, color: '#00e5a0',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 800,
    padding: '10px 0', textTransform: 'uppercase', letterSpacing: 0.5,
    cursor: 'pointer', width: '100%',
  },
  scoreAdjRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  adjBtn: {
    background: '#0f1117', border: '1px solid #2a2f42', borderRadius: 6,
    color: '#e8eaf0', fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 18, fontWeight: 900, width: 32, height: 32,
    cursor: 'pointer', lineHeight: 1, padding: 0, flexShrink: 0,
  },
  adjLabel: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 800,
    minWidth: 56, textAlign: 'center',
  },
  adjSep: {
    color: '#4a5068', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14,
  },
  adjWarning: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700,
    color: '#4a5068', textAlign: 'center', letterSpacing: 0.3,
  },

  abandonBtn: {
    background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.35)',
    borderRadius: 8, color: '#ff4d6d',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 800,
    padding: '10px 0', textTransform: 'uppercase', letterSpacing: 0.5,
    cursor: 'pointer', width: '100%',
  },
  abandonConfirmBox: { display: 'flex', flexDirection: 'column', gap: 10 },
  abandonWarning: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700,
    color: '#e8eaf0', textAlign: 'center', lineHeight: 1.4,
  },
  abandonBtns: { display: 'flex', gap: 8 },
  abandonKeepBtn: {
    flex: 1, background: 'transparent', border: '1px solid #2a2f42', borderRadius: 8,
    color: '#7a8099', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12,
    fontWeight: 800, padding: '9px 0', textTransform: 'uppercase', cursor: 'pointer',
  },
  abandonConfirmBtn: {
    flex: 1, background: 'rgba(255,77,109,0.15)', border: '1px solid #ff4d6d', borderRadius: 8,
    color: '#ff4d6d', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12,
    fontWeight: 800, padding: '9px 0', textTransform: 'uppercase', cursor: 'pointer',
  },

  closeBtn: {
    marginTop: 12, background: '#0f1117', border: '1px solid #2a2f42', borderRadius: 10,
    color: '#7a8099', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14,
    fontWeight: 800, padding: '12px 0', textTransform: 'uppercase', cursor: 'pointer',
    width: '100%',
  },
}
