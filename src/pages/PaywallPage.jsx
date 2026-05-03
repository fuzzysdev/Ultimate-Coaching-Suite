import { useState } from 'react'
import { supabase } from '../lib/supabase'

// Shown when has_active_access returns 'denied'.
// Displays pricing cards and initiates Stripe Checkout.
// Prices displayed here are for reference — actual amounts come from your
// Stripe dashboard. Replace the priceId values with your real Stripe Price IDs.

const PLANS = [
  {
    id: 'individual',
    label: 'Individual Coach',
    description: 'One coach, full access to all features',
    prices: [
      { label: 'Monthly', priceId: 'price_1TS5FkJ80Mm4TIdPwNsrpbpN', amount: '$10/mo' },
      { label: 'Annual',  priceId: 'price_1TS5FlJ80Mm4TIdPWOwbCdK7',  amount: '$100/yr', badge: 'Save 20%' },
    ],
  },
  {
    id: 'org_5',
    label: '5-Coach Team',
    description: 'Org admin manages 5 coaching licenses',
    prices: [
      { label: 'Annual', priceId: 'price_1TS5FpJ80Mm4TIdPqE7xE19K', amount: '$400/yr', badge: '$80/coach' },
    ],
  },
  {
    id: 'org_10',
    label: '10-Coach Team',
    description: 'Org admin manages 10 coaching licenses',
    prices: [
      { label: 'Annual', priceId: 'price_1TS5FoJ80Mm4TIdPNat17AW7', amount: '$600/yr', badge: '$60/coach' },
    ],
  },
]

export default function PaywallPage({ session, onAccessChange, onTryDemo }) {
  const [loading, setLoading] = useState(null) // priceId being loaded
  const [error,   setError]   = useState(null)

  const handleSubscribe = async (priceId) => {
    if (loading) return
    setLoading(priceId)
    setError(null)
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      const token = currentSession?.access_token
      if (!token) throw new Error('Not authenticated')

      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ priceId }),
      })
      const json = await res.json()
      if (!res.ok || !json.url) throw new Error(json.error || 'Failed to start checkout')
      window.location.href = json.url
    } catch (err) {
      console.error(err)
      setError('Could not start checkout. Please try again.')
      setLoading(null)
    }
  }

  const handleSignOut = () => supabase.auth.signOut()

  return (
    <div style={S.page}>
      <div style={S.inner}>
        <div style={S.logo}>UCS <span style={S.logoSub}>Ultimate Coaching Suite</span></div>
        <h1 style={S.headline}>Choose Your Plan</h1>
        <p style={S.sub}>
          A 30-day free trial is included for new individual subscribers.
          Org plans provide a shared license pool managed by your org admin.
        </p>

        {error && <div style={S.error}>{error}</div>}

        <div style={S.grid}>
          {PLANS.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              loading={loading}
              onSubscribe={handleSubscribe}
            />
          ))}
        </div>

        <div style={S.footer}>
          <p style={S.footerText}>Already subscribed? <span style={S.footerLink} onClick={onAccessChange}>Refresh access</span></p>
          <button onClick={handleSignOut} style={S.signOutBtn}>Sign Out</button>
          {onTryDemo && (
            <button onClick={onTryDemo} style={S.demoBtn}>
              Not ready? Explore the demo first →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function PlanCard({ plan, loading, onSubscribe }) {
  const [billingPeriod, setBillingPeriod] = useState(0) // 0=monthly, 1=annual
  const selected = plan.prices[billingPeriod]

  return (
    <div style={S.card}>
      <div style={S.cardLabel}>{plan.label}</div>
      <div style={S.cardDesc}>{plan.description}</div>

      {/* Billing period toggle */}
      <div style={S.periodToggle}>
        {plan.prices.map((p, i) => (
          <button key={i} onClick={() => setBillingPeriod(i)}
            style={{ ...S.periodBtn, ...(billingPeriod === i ? S.periodActive : {}) }}>
            {p.label}
            {p.badge && billingPeriod !== i && <span style={S.badge}>{p.badge}</span>}
          </button>
        ))}
      </div>

      <div style={S.amount}>
        {selected.amount}
        {selected.badge && <span style={S.saveBadge}>{selected.badge}</span>}
      </div>

      <button
        onClick={() => onSubscribe(selected.priceId)}
        disabled={!!loading}
        style={{ ...S.subscribeBtn, opacity: loading ? 0.6 : 1 }}>
        {loading === selected.priceId ? 'Starting…' : 'Subscribe'}
      </button>
    </div>
  )
}

const S = {
  page: {
    minHeight: '100vh', background: '#0f1117',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    padding: '40px 16px',
  },
  inner: { width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', alignItems: 'center' },
  logo: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 800,
    color: '#00e5a0', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 32,
  },
  logoSub: { color: '#7a8099', fontWeight: 400, fontSize: 16, marginLeft: 8 },
  headline: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 32, fontWeight: 900,
    color: '#e8eaf0', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 12px',
    textAlign: 'center',
  },
  sub: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: '#7a8099',
    textAlign: 'center', maxWidth: 500, lineHeight: 1.5, margin: '0 0 32px',
  },
  error: {
    background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.3)',
    color: '#ff4d6d', borderRadius: 8, padding: '10px 16px', marginBottom: 20,
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700,
    width: '100%', maxWidth: 480,
  },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16, width: '100%', marginBottom: 32,
  },
  card: {
    background: '#181c26', border: '1px solid #2a2f42', borderRadius: 14,
    padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 14,
  },
  cardLabel: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 900,
    color: '#e8eaf0', textTransform: 'uppercase', letterSpacing: 1,
  },
  cardDesc: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: '#7a8099',
    lineHeight: 1.4,
  },
  periodToggle: { display: 'flex', gap: 4 },
  periodBtn: {
    flex: 1, border: '1px solid #2a2f42', borderRadius: 6, background: '#0f1117',
    color: '#7a8099', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
    fontWeight: 700, padding: '5px 4px', cursor: 'pointer', textTransform: 'uppercase',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
  },
  periodActive: { background: 'rgba(0,229,160,0.12)', borderColor: '#00e5a0', color: '#00e5a0' },
  badge: {
    fontSize: 9, background: 'rgba(0,229,160,0.15)', color: '#00e5a0',
    padding: '1px 4px', borderRadius: 3, letterSpacing: 0.3,
  },
  amount: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 900,
    color: '#e8eaf0', display: 'flex', alignItems: 'center', gap: 8,
  },
  saveBadge: {
    fontSize: 11, background: 'rgba(0,229,160,0.15)', color: '#00e5a0',
    padding: '2px 7px', borderRadius: 4, fontWeight: 800, letterSpacing: 0.3,
  },
  subscribeBtn: {
    background: '#00e5a0', border: 'none', borderRadius: 8, color: '#0f1117',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 900,
    padding: '12px 0', textTransform: 'uppercase', letterSpacing: 1,
    cursor: 'pointer', width: '100%',
  },
  footer: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  footerText: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: '#7a8099', margin: 0,
  },
  footerLink: { color: '#00e5a0', cursor: 'pointer', textDecoration: 'underline' },
  signOutBtn: {
    background: 'none', border: '1px solid #2a2f42', borderRadius: 8,
    color: '#7a8099', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12,
    fontWeight: 700, padding: '8px 20px', textTransform: 'uppercase', cursor: 'pointer',
  },
  demoBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700,
    color: '#4a5068', textDecoration: 'underline', padding: '4px 0',
    letterSpacing: 0.3,
  },
}
