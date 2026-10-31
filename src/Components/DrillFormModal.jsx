import { useState } from 'react'
import { BLOCK_TYPES, newId, saveDrill } from '../lib/practiceHelpers'

// Create or edit a library drill. `drill` may be a full drill (edit) or a partial
// prefill from a practice block ("Save as drill").
function DrillFormModal({ org, drill, isDemoOrg, onSaved, onClose }) {
  const editing = !!drill?.id
  const [name,        setName]        = useState(drill?.name || '')
  const [description, setDescription] = useState(drill?.description || '')
  const [type,        setType]        = useState(drill?.block_type || 'drill')
  const [duration,    setDuration]    = useState(drill?.default_duration || 10)
  const [tags,        setTags]        = useState((drill?.tags || []).join(', '))
  const [saving,      setSaving]      = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    const saved = await saveDrill({
      id:               drill?.id || newId(),
      organization_id:  org.id,
      name:             name.trim(),
      description:      description.trim() || null,
      block_type:       type,
      default_duration: duration,
      tags:             tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean).slice(0, 10),
    }, isDemoOrg)
    setSaving(false)
    onSaved(saved)
  }

  const s = styles
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <h2 style={s.title}>{editing ? 'Edit Drill' : 'Save Drill'}</h2>
          <button onClick={onClose} style={s.closeBtn}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={s.field}>
            <label style={s.label}>Name *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              maxLength={100} required autoFocus style={s.input} placeholder="e.g. Break-mark ladder" />
          </div>

          <div style={s.field}>
            <label style={s.label}>Type</label>
            <div style={s.chips}>
              {BLOCK_TYPES.map(t => (
                <button key={t.key} type="button" onClick={() => setType(t.key)}
                  style={{ ...s.chip, ...(type === t.key ? { borderColor: t.color, color: t.color, background: `${t.color}1f` } : {}) }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div style={s.field}>
            <label style={s.label}>Default Duration</label>
            <div style={s.stepper}>
              <button type="button" onClick={() => setDuration(d => Math.max(1, d - 5))} style={s.stepBtn}>−</button>
              <span style={s.stepValue}>{duration}<span style={s.stepUnit}> min</span></span>
              <button type="button" onClick={() => setDuration(d => Math.min(300, d + 5))} style={s.stepBtn}>+</button>
            </div>
          </div>

          <div style={s.field}>
            <label style={s.label}>Description / Setup</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              maxLength={4000} rows={5} style={{ ...s.input, resize: 'vertical' }}
              placeholder="Setup, rules, coaching points..." />
          </div>

          <div style={s.field}>
            <label style={s.label}>Tags (comma separated)</label>
            <input type="text" value={tags} onChange={e => setTags(e.target.value)}
              maxLength={200} style={s.input} placeholder="handlers, defense, zone" />
          </div>

          <div style={s.actions}>
            <button type="button" onClick={onClose} style={s.cancelBtn}>Cancel</button>
            <button type="submit" disabled={saving} style={s.saveBtn}>{saving ? 'Saving...' : 'Save Drill'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
  },
  modal: {
    background: '#181c26', border: '1px solid #2a2f42', borderRadius: '16px',
    width: '100%', maxWidth: '520px', padding: '24px', maxHeight: '90vh', overflowY: 'auto'
  },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  title: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '22px',
    fontWeight: '800', color: '#e8eaf0', textTransform: 'uppercase', letterSpacing: '1px', margin: 0
  },
  closeBtn: {
    background: '#1f2435', border: 'none', color: '#7a8099',
    fontSize: '16px', padding: '6px 10px', borderRadius: '7px', cursor: 'pointer'
  },
  field: { marginBottom: '18px' },
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
  chips: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  chip: {
    background: '#1f2435', border: '1px solid #2a2f42', color: '#7a8099',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px', fontWeight: '700',
    padding: '6px 10px', borderRadius: '16px', textTransform: 'uppercase', cursor: 'pointer'
  },
  stepper: { display: 'flex', alignItems: 'center', gap: '16px' },
  stepBtn: {
    width: '40px', height: '40px', background: '#1f2435', border: '1px solid #2a2f42',
    color: '#e8eaf0', fontSize: '20px', fontWeight: '700', borderRadius: '8px', cursor: 'pointer'
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
    padding: '12px', borderRadius: '8px', textTransform: 'uppercase', cursor: 'pointer'
  }
}

export default DrillFormModal
