import React, { useEffect, useRef, useState } from 'react'
import { supabase, getStoredSession } from './lib/supabase'
import ScoreboardPage from './pages/ScoreboardPage'
import LoginPage from './pages/LoginPage'
import LandingPage from './pages/LandingPage'
import HowItWorksPage from './pages/HowItWorksPage'
import MainShell from './pages/MainShell'
import ResetPasswordPage from './pages/ResetPasswordPage'
import SuperAdminPage from './pages/SuperAdminPage'
import { isPaidStatus } from './lib/access'

// Last confirmed access status per user — lets the app open offline.
// Trusted for 14 days; RLS still guards all data, this only decides which screen shows.
const ACCESS_CACHE_PREFIX = 'ucs_access_'
const ACCESS_CACHE_MAX_AGE = 14 * 24 * 60 * 60 * 1000

function getCachedAccess(userId) {
  try {
    const c = JSON.parse(localStorage.getItem(ACCESS_CACHE_PREFIX + userId) || 'null')
    return c && Date.now() - c.ts < ACCESS_CACHE_MAX_AGE ? c.status : null
  } catch { return null }
}

function App() {
  const [session,      setSession]      = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [accessStatus, setAccessStatus] = useState(null)  // null | string
  const [checkingAccess, setCheckingAccess] = useState(false)
  const [showLanding,  setShowLanding]  = useState(false)
  const [loginMode,    setLoginMode]    = useState('signin') // 'signin' | 'signup'
  const returnedFromCheckout = useRef(new URLSearchParams(window.location.search).get('checkout') === 'success')
  const [pathname,     setPathname]     = useState(window.location.pathname)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      // Offline with an expired token → fall back to the stored session (see getStoredSession)
      setSession(session || getStoredSession())
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
        else if (event === 'USER_UPDATED') setRecoveryMode(false)
        // INITIAL_SESSION is null in the same offline case — don't bounce to the login page
        if (!session && event === 'INITIAL_SESSION') {
          const stored = getStoredSession()
          if (stored) { setSession(stored); return }
        }
        setSession(session)
        // TOKEN_REFRESHED fires silently in the background — skip re-checking
        // access to avoid unmounting MainShell and losing active game state.
        if (session && event !== 'TOKEN_REFRESHED') checkAccess(session.user.id)
        else if (!session) setAccessStatus(null)
      }
    )
    return () => subscription?.unsubscribe()
  }, [])

  useEffect(() => {
    const onPop = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Check access whenever we have a session and haven't checked yet
  useEffect(() => {
    if (session && !accessStatus && !checkingAccess) {
      checkAccess(session.user.id)
    }
  }, [session])

  // Re-check access when connectivity is restored so a paying user
  // shown the free tier due to a network error is unlocked automatically.
  useEffect(() => {
    const onOnline = () => {
      if (session && !isPaidStatus(accessStatus)) checkAccess(session.user.id)
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [session, accessStatus])

  // On return from Stripe Checkout, re-check a few times while the webhook lands
  const userId = session?.user?.id
  useEffect(() => {
    if (!userId || !returnedFromCheckout.current) return
    window.history.replaceState({}, '', window.location.pathname)
    const timers = [2500, 6000, 12000, 25000].map(ms => setTimeout(() => checkAccess(userId), ms))
    return () => timers.forEach(clearTimeout)
  }, [userId])

  const checkAccess = async (userId) => {
    setCheckingAccess(true)
    try {
      const { data, error } = await supabase.rpc('has_active_access', { p_user_id: userId })
      if (error) {
        console.error('Access check error:', error)
        // Network/timeout errors must not override a valid existing status.
        // A user who had access a moment ago still has access; on a cold start
        // offline, use the last confirmed status. Only fall back to 'free'
        // if we've never successfully checked.
        setAccessStatus(prev => prev ?? getCachedAccess(userId) ?? 'free')
      } else {
        setAccessStatus(data)
        try { localStorage.setItem(ACCESS_CACHE_PREFIX + userId, JSON.stringify({ status: data, ts: Date.now() })) } catch {}
      }
    } finally {
      setCheckingAccess(false)
    }
  }

  // ── Public routes (no auth required) ──
  if (pathname === '/scoreboard') return <ScoreboardPage />

  // ── Loading states ──
  if (loading) return <LoadingScreen />

  // ── /superadmin route ──
  if (pathname === '/superadmin') {
    return session ? <SuperAdminPage session={session} /> : <LoginPage />
  }

  if (recoveryMode) return <ResetPasswordPage />

  // ── Not logged in ──
  if (!session) {
    if (pathname === '/how-it-works') {
      return <HowItWorksPage
        onSignIn={() => { setLoginMode('signin'); setShowLanding(false); window.history.pushState({}, '', '/'); setPathname('/') }}
        onSignUp={() => { setLoginMode('signup'); setShowLanding(false); window.history.pushState({}, '', '/'); setPathname('/') }}
      />
    }
    if (showLanding) {
      return <LandingPage
        onSignIn={() => { setLoginMode('signin'); setShowLanding(false) }}
        onSignUp={() => { setLoginMode('signup'); setShowLanding(false) }}
      />
    }
    return <LoginPage
      initialMode={loginMode}
      onLearnMore={() => setShowLanding(true)}
    />
  }

  // ── Checking access ──
  // Keep showing the app during background re-checks to prevent MainShell unmount.
  if (!accessStatus) return <LoadingScreen />

  // Everyone gets the app; MainShell locks the paid tabs on the free tier.
  return <MainShell session={session} accessStatus={accessStatus} onAccessChange={() => checkAccess(session.user.id)} />
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
