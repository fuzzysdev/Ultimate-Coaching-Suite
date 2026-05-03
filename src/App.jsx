import React, { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import MainShell from './pages/MainShell'
import ResetPasswordPage from './pages/ResetPasswordPage'
import SuperAdminPage from './pages/SuperAdminPage'
import PaywallPage from './pages/PaywallPage'
import OrgBillingPage from './pages/OrgBillingPage'

function App() {
  const [session,      setSession]      = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [accessStatus, setAccessStatus] = useState(null)  // null | string
  const [checkingAccess, setCheckingAccess] = useState(false)
  const [demoMode,     setDemoMode]     = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
        else if (event === 'USER_UPDATED') setRecoveryMode(false)
        setSession(session)
        // TOKEN_REFRESHED fires silently in the background — skip re-checking
        // access to avoid unmounting MainShell and losing active game state.
        if (session && event !== 'TOKEN_REFRESHED') checkAccess(session.user.id)
        else if (!session) setAccessStatus(null)
      }
    )
    return () => subscription?.unsubscribe()
  }, [])

  // Check access whenever we have a session and haven't checked yet
  useEffect(() => {
    if (session && !accessStatus && !checkingAccess) {
      checkAccess(session.user.id)
    }
  }, [session])

  // On return from Stripe Checkout, re-poll access after a short delay
  // to allow the webhook time to process
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('checkout') === 'success' && session) {
      const timer = setTimeout(() => {
        setAccessStatus(null)  // triggers re-check via useEffect above
      }, 2500)
      // Clean the URL
      window.history.replaceState({}, '', window.location.pathname)
      return () => clearTimeout(timer)
    }
  }, [session])

  const checkAccess = async (userId) => {
    setCheckingAccess(true)
    try {
      const { data, error } = await supabase.rpc('has_active_access', { p_user_id: userId })
      if (error) {
        console.error('Access check error:', error)
        setAccessStatus('denied')
      } else {
        setAccessStatus(data)
      }
    } finally {
      setCheckingAccess(false)
    }
  }

  // ── Loading states ──
  if (loading) return <LoadingScreen />

  // ── /superadmin route ──
  if (window.location.pathname === '/superadmin') {
    return session ? <SuperAdminPage session={session} /> : <LoginPage />
  }

  if (recoveryMode) return <ResetPasswordPage />

  // ── Not logged in ──
  if (!session) return <LoginPage />

  // ── Checking access ──
  // Keep showing the app during background re-checks to prevent MainShell unmount.
  if (!accessStatus) return <LoadingScreen />

  // ── Route by access status ──
  switch (accessStatus) {
    case 'super_admin':
      // Super admins get the full app; /superadmin is a separate route
      return <MainShell session={session} accessStatus={accessStatus} />
    case 'exempt':
    case 'full':
    case 'trial':
    case 'past_due':
      return <MainShell session={session} accessStatus={accessStatus} />
    case 'org_admin_only':
      return <OrgBillingPage session={session} onAccessChange={() => setAccessStatus(null)} />
    case 'denied':
    default:
      if (demoMode) return <MainShell session={session} accessStatus={accessStatus} onExitDemo={() => setDemoMode(false)} />
      return <PaywallPage session={session} onAccessChange={() => setAccessStatus(null)} onTryDemo={() => setDemoMode(true)} />
  }
}

function LoadingScreen() {
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

export default App
