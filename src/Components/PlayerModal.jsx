import React, { useState, useEffect } from 'react'

const GRADES = ['6th', '7th', '8th', '9th', '10th', '11th', '12th', 'College', 'Adult']
const GENDERS = ['Female', 'Male', 'Non-binary', 'Prefer not to say']

function PlayerModal({ player, onSave, onClose }) {
  const [name, setName] = useState('')
  const [grade, setGrade] = useState('')
  const [gender, setGender] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (player) { setName(player.name); setGrade(player.grade || ''); setGender(player.gender || '') }
  }, [player])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    setSaving(true)
    try {
      await onSave({ name: name.trim(), grade, gender })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const s = styles
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <h2 style={s.title}>{player ? 'Edit Player' : 'Add Player'}</h2>
          <button onClick={onClose} style={s.closeBtn}>✕</button>
        </div>

        {error && <div style={s.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={s.field}>
            <label style={s.label}>Name *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Player's full name" autoFocus required />
          </div>
          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label}>Grade</label>
              <select value={grade} onChange={e => setGrade(e.target.value)}>
                <option value="">-- Select --</option>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div style={s.field}>
              <label style={s.label}>Gender</label>
              <select value={gender} onChange={e => setGender(e.target.value)}>
                <option value="">-- Select --</option>
                {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" disabled={saving} style={s.saveBtn}>
            {saving ? 'Saving...' : player ? 'Save Changes' : 'Add Player'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 500,
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
  },
  modal: {
    background: '#181c26', border: '1px solid #2a2f42', borderRadius: '16px 16px 0 0',
    width: '100%', maxWidth: '600px', padding: '24px 20px 36px'
  },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  title: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '20px',
    fontWeight: '800', color: '#e8eaf0', textTransform: 'uppercase', letterSpacing: '1px'
  },
  closeBtn: {
    background: '#1f2435', border: 'none', color: '#7a8099',
    fontSize: '16px', padding: '6px 10px', borderRadius: '7px', cursor: 'pointer'
  },
  row: { display: 'flex', gap: '12px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px', flex: 1 },
  label: {
    fontSize: '11px', fontWeight: '600', letterSpacing: '1px',
    textTransform: 'uppercase', color: '#7a8099',
    fontFamily: "'Barlow Condensed', sans-serif"
  },
  saveBtn: {
    width: '100%', background: '#00e5a0', color: '#0f1117', border: 'none',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '15px', fontWeight: '800',
    padding: '12px', borderRadius: '8px', textTransform: 'uppercase', letterSpacing: '0.5px',
    marginTop: '4px'
  },
  error: {
    background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.3)',
    color: '#ff4d6d', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem'
  }
}

export default PlayerModal