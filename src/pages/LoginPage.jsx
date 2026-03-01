import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  const handleAuth = async (e) => {
    e.preventDefault()
    setMessage(null)
    setLoading(true)
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage({ type: 'success', text: 'Check your email to confirm your account.' })
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
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
        <p style={s.subtitle}>{isSignUp ? 'Create your account' : 'Sign in to continue'}</p>

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

        <form onSubmit={handleAuth} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={loading} style={s.button}>
            {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div style={s.toggle}>
          <span style={{ color: '#7a8099' }}>
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          </span>
          <button onClick={() => setIsSignUp(!isSignUp)} style={s.link}>
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </div>
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
  },
  toggle: {
    textAlign: 'center', marginTop: '1.5rem', paddingTop: '1.5rem',
    borderTop: '1px solid #2a2f42', fontSize: '0.9rem'
  },
  link: {
    background: 'none', border: 'none', color: '#00e5a0',
    fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem'
  }
}

export default LoginPage