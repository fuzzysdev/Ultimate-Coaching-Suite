import React from 'react'

function ConfirmDialog({ message, onConfirm, onCancel }) {
  const s = styles
  return (
    <div style={s.overlay} onClick={onCancel}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <h2 style={s.title}>Are you sure?</h2>
          <button onClick={onCancel} style={s.closeBtn}>✕</button>
        </div>
        <p style={s.message}>{message}</p>
        <div style={s.actions}>
          <button onClick={onCancel} style={s.cancelBtn}>Cancel</button>
          <button onClick={onConfirm} style={s.deleteBtn}>Delete</button>
        </div>
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
    background: '#181c26', border: '1px solid #2a2f42',
    borderRadius: '16px 16px 0 0', width: '100%', maxWidth: '600px',
    padding: '24px 20px 36px'
  },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  title: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '20px',
    fontWeight: '800', color: '#e8eaf0', textTransform: 'uppercase'
  },
  closeBtn: {
    background: '#1f2435', border: 'none', color: '#7a8099',
    fontSize: '16px', padding: '6px 10px', borderRadius: '7px', cursor: 'pointer'
  },
  message: { color: '#7a8099', marginBottom: '1.5rem', lineHeight: '1.5', fontSize: '0.95rem' },
  actions: { display: 'flex', gap: '0.75rem' },
  cancelBtn: {
    flex: 1, background: '#1f2435', border: '1px solid #2a2f42', color: '#e8eaf0',
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: '700', fontSize: '14px',
    padding: '12px', borderRadius: '8px', textTransform: 'uppercase'
  },
  deleteBtn: {
    flex: 1, background: 'rgba(255,77,109,0.15)', border: '1px solid rgba(255,77,109,0.3)',
    color: '#ff4d6d', fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: '700', fontSize: '14px', padding: '12px',
    borderRadius: '8px', textTransform: 'uppercase'
  }
}

export default ConfirmDialog