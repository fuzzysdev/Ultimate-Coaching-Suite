import React, { useState, useEffect } from 'react'

function RosterModal({ roster, onSave, onClose }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (roster) setName(roster.name) }, [roster])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await onSave(name.trim())
    setSaving(false)
  }

  const s = styles
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <h2 style={s.title}>{roster ? 'Edit Roster' : 'New Roster'}</h2>
          <button onClick={onClose} style={s.closeBtn}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={s.field}>
            <label style={s.label}>Roster Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Varsity 2025"
              autoFocus
              required
              maxLength={100}
            />
          </div>
          <button type="submit" disabled={saving} style={s.saveBtn}>
            {saving ? 'Saving...' : roster ? 'Save Changes' : 'Create Roster'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 500,
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  },
  modal: {
    background: '#181c26', border: '1px solid #2a2f42',
    borderRadius: '16px 16px 0 0', width: '100%', maxWidth: '600px',
    padding: '24px 20px 36px',
    animation: 'slideUp 0.25s cubic-bezier(.4,0,.2,1)'
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
  field: { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' },
  label: {
    fontSize: '11px', fontWeight: '600', letterSpacing: '1px',
    textTransform: 'uppercase', color: '#7a8099',
    fontFamily: "'Barlow Condensed', sans-serif"
  },
  saveBtn: {
    width: '100%', background: '#00e5a0', color: '#0f1117', border: 'none',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '15px', fontWeight: '800',
    padding: '12px', borderRadius: '8px', textTransform: 'uppercase', letterSpacing: '0.5px'
  }
}

export default RosterModal