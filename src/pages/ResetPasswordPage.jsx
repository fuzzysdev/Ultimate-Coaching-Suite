import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirm) {
      setMessage({ type: 'error', text: 'Passwords do not match.' })
      return
    }
    if (password.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters.' })
      return
    }
    setMessage(null)
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setMessage({ type: 'success', text: 'Password updated! You are now signed in.' })
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  const s = styles
  return (
    <div style={s.container}>
      <div style={s.card}>
        <h1 style={s.title}>Ultimate Coaching<br /><span style={s.titleAccent}>Suite</span></h1>
        <p style={s.subtitle}>Set a new password</p>

        {message && (
          <div style={{
            ...s.message,
            background: message.type === 'error' ? 'rgba(255,77,109,0.1)' : 'rgba(0,229,160,0.1)',
            borderColor: message.type === 'error' ? '#ff4d6d' : '#00e5a0',
            color: message.type === 'error' ? '#ff4d6d' : '#00e5a0'
          }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>New Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>Confirm Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={loading || message?.type === 'success'} style={s.button}>
            {loading ? 'Saving...' : 'Set New Password'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles = {
  container: {
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    minHeight: '100vh', background: '#0f1117', padding: '1rem'
  },
  card: {
    background: '#181c26', border: '1px solid #2a2f42', borderRadius: '12px',
    padding: '2.5rem', width: '100%', maxWidth: '400px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
  },
  title: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '2rem',
    fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px',
    color: '#e8eaf0', marginBottom: '0.5rem', lineHeight: 1.2
  },
  titleAccent: { color: '#00e5a0' },
  subtitle: { color: '#7a8099', marginBottom: '2rem', fontSize: '0.95rem' },
  message: {
    padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid',
    marginBottom: '1rem', fontSize: '0.9rem'
  },
  form: { display: 'flex', flexDirection: 'column', gap: '1.25rem' },
  field: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  label: {
    fontSize: '11px', fontWeight: '600', letterSpacing: '1px',
    textTransform: 'uppercase', color: '#7a8099',
    fontFamily: "'Barlow Condensed', sans-serif"
  },
  button: {
    background: '#00e5a0', color: '#0f1117', border: 'none',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '15px',
    fontWeight: '800', letterSpacing: '0.5px', padding: '0.85rem',
    borderRadius: '7px', textTransform: 'uppercase', marginTop: '0.5rem',
    transition: 'opacity 0.15s'
  }
}

export default ResetPasswordPage
