import React, { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import MainShell from './pages/MainShell'
import ResetPasswordPage from './pages/ResetPasswordPage'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recoveryMode, setRecoveryMode] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          setRecoveryMode(true)
        } else if (event === 'USER_UPDATED') {
          setRecoveryMode(false)
        }
        setSession(session)
      }
    )
    return () => subscription?.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        height: '100vh', background: '#0f1117', color: '#00e5a0',
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: '1.2rem', letterSpacing: '2px', textTransform: 'uppercase'
      }}>
        Loading...
      </div>
    )
  }

  if (recoveryMode) return <ResetPasswordPage />
  return session ? <MainShell session={session} /> : <LoginPage />
}

export default App