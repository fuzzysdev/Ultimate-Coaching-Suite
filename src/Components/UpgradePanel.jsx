import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { COACH_PRICES } from '../lib/access'

// Shown in place of a paid tab on the free tier, and from "Subscribe" / "View Plans".
// trialEnd: undefined = not loaded, null = trial never used, ISO string = used.
export default function UpgradePanel({ featureName, accessStatus, trialEnd, onAccessChange }) {
  const [busy,  setBusy]  = useState(null)
  const [error, setError] = useState(null)
  const s = styles

  const startTrial = async () => {
    if (busy) return
    setBusy('trial')
    setError(null)
    const { error: rpcError } = await supabase.rpc('start_trial')
    if (rpcError) {
      console.error(rpcError)
      setError('Could not start your trial. Please try again.')
    } else {
      await onAccessChange()
    }
    setBusy(null)
  }

  const subscribe = async (priceId) => {
    if (busy) return
    setBusy(priceId)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ priceId }),
      })
      if (res.status === 409) {
        setError('You already have a subscription. Manage it from your profile.')
        setBusy(null)
        return
      }
      const json = await res.json()
      if (!res.ok || !json.url) throw new Error('Failed to start checkout')
      window.location.href = json.url
    } catch (err) {
      console.error(err)
      setError('Could not start checkout. Please try again.')
      setBusy(null)
    }
  }

  const refresh = async () => {
    setBusy('refresh')
    await onAccessChange()
    setBusy(null)
  }

  const onTrial = accessStatus === 'trial'
  return (
    <div style={s.wrap}>
      <div style={s.icon}>🔒</div>
      <h2 style={s.title}>{featureName ? `${featureName}: Coach Plan` : 'Coach Plan'}</h2>
      <p style={s.sub}>
        Practices, game sheet, attendance and stats. Rosters and tryouts are always free.
      </p>
      {error && <div style={s.error}>{error}</div>}

      {trialEnd === null && !onTrial && (
        <>
          <button onClick={startTrial} disabled={!!busy} style={s.trialBtn}>
            {busy === 'trial' ? 'Starting…' : 'Start 14-Day Free Trial'}
          </button>
          <p style={s.note}>No credit card required</p>
        </>
      )}
      {trialEnd && !onTrial && (
        <p style={s.note}>Your free trial has ended. Subscribe to keep coaching.</p>
      )}

      <div style={s.grid}>
        {COACH_PRICES.map(p => (
          <div key={p.priceId} style={s.card}>
            <div style={s.label}>{p.label}</div>
            <div style={s.amount}>{p.amount}</div>
            <div style={s.note}>{p.note}</div>
            <button onClick={() => subscribe(p.priceId)} disabled={!!busy} style={s.subBtn}>
              {busy === p.priceId ? 'Starting…' : 'Subscribe'}
            </button>
          </div>
        ))}
      </div>
      <p style={s.note}>One coach per subscription. Billing starts when you subscribe.</p>
      <button onClick={refresh} disabled={!!busy} style={s.link}>
        {busy === 'refresh' ? 'Checking…' : 'Already subscribed? Refresh access'}
      </button>
    </div>
  )
}

const font = "'Barlow Condensed', sans-serif"
const styles = {
  wrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
    padding: '32px 16px', width: '100%', maxWidth: 560, margin: '0 auto', boxSizing: 'border-box',
  },
  icon: { fontSize: 36 },
  title: {
    fontFamily: font, fontSize: 26, fontWeight: 900, color: '#e8eaf0', margin: 0,
    textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center',
  },
  sub: { fontFamily: font, fontSize: 15, color: '#7a8099', margin: 0, textAlign: 'center', lineHeight: 1.5 },
  note: { fontFamily: font, fontSize: 13, color: '#7a8099', margin: 0, textAlign: 'center' },
  error: {
    background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.3)', color: '#ff4d6d',
    borderRadius: 8, padding: '10px 16px', fontFamily: font, fontSize: 13, fontWeight: 700,
  },
  trialBtn: {
    background: '#00e5a0', border: 'none', borderRadius: 8, color: '#0f1117', fontFamily: font,
    fontSize: 16, fontWeight: 900, padding: '14px 28px', textTransform: 'uppercase',
    letterSpacing: 1, cursor: 'pointer',
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, width: '100%' },
  card: {
    background: '#181c26', border: '1px solid #2a2f42', borderRadius: 14, padding: 20,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
  },
  label: {
    fontFamily: font, fontSize: 14, fontWeight: 800, color: '#7a8099',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  amount: { fontFamily: font, fontSize: 30, fontWeight: 900, color: '#e8eaf0' },
  subBtn: {
    background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.3)', borderRadius: 8,
    color: '#00e5a0', fontFamily: font, fontSize: 14, fontWeight: 900, padding: '10px 0', width: '100%',
    textTransform: 'uppercase', letterSpacing: 1, cursor: 'pointer',
  },
  link: {
    background: 'none', border: 'none', color: '#7a8099', fontFamily: font, fontSize: 13,
    textDecoration: 'underline', cursor: 'pointer',
  },
}
