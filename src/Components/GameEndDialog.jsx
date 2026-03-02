import React, { useState } from 'react'

const SPIRIT_CATEGORIES = [
  { key: 'rules_knowledge', label: 'Rules Knowledge & Use' },
  { key: 'fouls_contact',   label: 'Fouls & Body Contact' },
  { key: 'fair_mindedness', label: 'Fair Mindedness' },
  { key: 'attitude',        label: 'Attitude' },
  { key: 'communication',   label: 'Communication' },
]

const SCORE_LABELS = ['Poor', 'Below Avg', 'Average', 'Good', 'Excellent']

function SpiritRatingRow({ label, value, onChange }) {
  const s = styles
  return (
    <div style={s.ratingRow}>
      <div style={s.ratingLabel}>{label}</div>
      <div style={s.ratingButtons}>
        {[0, 1, 2, 3, 4].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            style={{ ...s.ratingBtn, ...(value === n ? s.ratingBtnActive : {}) }}
            title={SCORE_LABELS[n]}
          >
            {n}
          </button>
        ))}
        <span style={s.ratingValueLabel}>{value !== null ? SCORE_LABELS[value] : '—'}</span>
      </div>
    </div>
  )
}

function GameEndDialog({ ourScore, theirScore, opponent, onSave, onCancel, saving }) {
  const [ratings, setRatings] = useState({
    rules_knowledge: null,
    fouls_contact:   null,
    fair_mindedness: null,
    attitude:        null,
    communication:   null,
  })

  const allRated = Object.values(ratings).every(v => v !== null)
  const total = allRated ? Object.values(ratings).reduce((a, b) => a + b, 0) : null

  const handleSave = () => {
    if (!allRated) return
    onSave(ratings)
  }

  const s = styles
  return (
    <div style={s.overlay}>
      <div style={s.dialog}>
        {/* Final Score */}
        <div style={s.scoreHeader}>
          <div style={s.gameOver}>Game Over</div>
          <div style={s.scoreRow}>
            <div style={s.scoreTeam}>
              <div style={s.scoreTeamName}>Us</div>
              <div style={{ ...s.scoreNum, color: ourScore > theirScore ? '#00e5a0' : '#e8eaf0' }}>
                {ourScore}
              </div>
            </div>
            <div style={s.scoreDash}>—</div>
            <div style={s.scoreTeam}>
              <div style={s.scoreTeamName}>{opponent}</div>
              <div style={{ ...s.scoreNum, color: theirScore > ourScore ? '#ff4d6d' : '#e8eaf0' }}>
                {theirScore}
              </div>
            </div>
          </div>
          <div style={s.resultBadge}>
            {ourScore > theirScore
              ? <span style={{ color: '#00e5a0' }}>WIN</span>
              : ourScore < theirScore
              ? <span style={{ color: '#ff4d6d' }}>LOSS</span>
              : <span style={{ color: '#f0a500' }}>TIE</span>}
          </div>
        </div>

        {/* Spirit Rating */}
        <div style={s.spiritSection}>
          <div style={s.spiritTitle}>Spirit Rating — {opponent}</div>
          <div style={s.spiritSubtitle}>Rate the opposing team 0–4 in each category</div>

          {SPIRIT_CATEGORIES.map(cat => (
            <SpiritRatingRow
              key={cat.key}
              label={cat.label}
              value={ratings[cat.key]}
              onChange={val => setRatings(prev => ({ ...prev, [cat.key]: val }))}
            />
          ))}

          {allRated && (
            <div style={s.totalRow}>
              <span style={s.totalLabel}>Total Spirit Score</span>
              <span style={s.totalValue}>{total} / 20</span>
            </div>
          )}
        </div>

        <div style={s.actions}>
          <button type="button" onClick={onCancel} style={s.cancelBtn}>
            Back to Game
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!allRated || saving}
            style={{ ...s.saveBtn, ...(!allRated || saving ? s.saveBtnDisabled : {}) }}
          >
            {saving ? 'Saving...' : 'Save & Finish'}
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
  },
  dialog: {
    background: '#181c26', border: '1px solid #2a2f42', borderRadius: '16px',
    width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto',
    padding: '0 0 24px'
  },

  /* Score header */
  scoreHeader: {
    background: '#1f2435', borderBottom: '1px solid #2a2f42',
    padding: '28px 24px 20px', textAlign: 'center', borderRadius: '16px 16px 0 0'
  },
  gameOver: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '12px', fontWeight: '700',
    letterSpacing: '3px', textTransform: 'uppercase', color: '#7a8099', marginBottom: '12px'
  },
  scoreRow: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px' },
  scoreTeam: { textAlign: 'center' },
  scoreTeamName: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px', fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: '1px', color: '#7a8099', marginBottom: '4px'
  },
  scoreNum: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '64px',
    fontWeight: '900', lineHeight: 1, color: '#e8eaf0'
  },
  scoreDash: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '36px',
    color: '#2a2f42', fontWeight: '300', alignSelf: 'center', paddingTop: '16px'
  },
  resultBadge: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '22px',
    fontWeight: '900', letterSpacing: '3px', textTransform: 'uppercase', marginTop: '8px'
  },

  /* Spirit */
  spiritSection: { padding: '20px 24px 0' },
  spiritTitle: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '16px', fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: '1px', color: '#e8eaf0', marginBottom: '4px'
  },
  spiritSubtitle: { fontSize: '12px', color: '#7a8099', marginBottom: '16px' },

  ratingRow: { marginBottom: '14px' },
  ratingLabel: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px', fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: '0.5px', color: '#b0b8d0', marginBottom: '6px'
  },
  ratingButtons: { display: 'flex', alignItems: 'center', gap: '6px' },
  ratingBtn: {
    width: '38px', height: '38px', border: '2px solid #2a2f42', borderRadius: '8px',
    background: '#1f2435', color: '#7a8099', fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: '16px', fontWeight: '800', cursor: 'pointer', transition: 'all 0.15s'
  },
  ratingBtnActive: {
    background: 'rgba(0,229,160,0.15)', borderColor: '#00e5a0', color: '#00e5a0'
  },
  ratingValueLabel: {
    fontSize: '12px', color: '#7a8099', marginLeft: '6px',
    fontFamily: "'Barlow Condensed', sans-serif", minWidth: '70px'
  },

  totalRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.2)',
    borderRadius: '8px', padding: '10px 14px', marginTop: '8px'
  },
  totalLabel: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px',
    fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#7a8099'
  },
  totalValue: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '20px',
    fontWeight: '900', color: '#00e5a0'
  },

  /* Actions */
  actions: { display: 'flex', gap: '10px', padding: '20px 24px 0' },
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
  },
  saveBtnDisabled: { background: '#2a2f42', color: '#4a5068', cursor: 'not-allowed' }
}

export default GameEndDialog
