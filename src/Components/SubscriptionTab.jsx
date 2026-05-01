import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Shown in UserProfileModal as a "Subscription" tab.
// Displays current plan status and a "Manage Billing" button.

export default function SubscriptionTab({ session, accessStatus }) {
  const [subscription, setSubscription] = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)
  const [error,        setError]        = useState(null)

  useEffect(() => { fetchSubscription() }, [])

  const fetchSubscription = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('subscriptions')
      .select('status, subscription_type, seat_count, current_period_end, trial_end, cancel_at_period_end')
      .eq('user_id', session.user.id)
      .in('status', ['active', 'trialing', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setSubscription(data || null)
    setLoading(false)
  }

  const handleManageBilling = async () => {
    if (portalLoading) return
    setPortalLoading(true)
    setError(null)
    try {
      const { data: { session: cur } } = await supabase.auth.getSession()
      const res = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cur.access_token}` },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      if (!res.ok || !json.url) throw new Error(json.error || 'Failed')
      window.location.href = json.url
    } catch (err) {
      console.error(err)
      setError('Could not open billing portal. Please try again.')
    } finally {
      setPortalLoading(false)
    }
  }

  const statusLabel = {
    active:   'Active',
    trialing: 'Free Trial',
    past_due: 'Payment Failed',
    exempt:   'Permanent License',
    super_admin: 'Admin Account',
    full:     'Active',
    trial:    'Free Trial',
  }

  const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString() : '—'

  if (loading) return <div style={S.muted}>Loading…</div>

  // Special statuses — no subscription row but still have access
  if (!subscription && (accessStatus === 'exempt' || accessStatus === 'super_admin')) {
    return (
      <div style={S.card}>
        <div style={S.statusRow}>
          <span style={S.label}>Status</span>
          <span style={{ ...S.badge, ...S.badgeActive }}>{statusLabel[accessStatus] || accessStatus}</span>
        </div>
        <p style={S.muted}>This account has permanent access and does not require a subscription.</p>
      </div>
    )
  }

  if (!subscription) {
    return (
      <div style={S.card}>
        <p style={S.muted}>No active subscription found.</p>
        <button onClick={() => { window.location.href = '/' }} style={S.ghostBtn}>
          View Plans
        </button>
      </div>
    )
  }

  const isPastDue  = subscription.status === 'past_due'
  const isTrialing = subscription.status === 'trialing'
  const renewDate  = isTrialing ? subscription.trial_end : subscription.current_period_end

  return (
    <div style={S.card}>
      {error && <div style={S.error}>{error}</div>}

      <div style={S.statusRow}>
        <span style={S.label}>Status</span>
        <span style={{ ...S.badge, ...(isPastDue ? S.badgePastDue : S.badgeActive) }}>
          {statusLabel[subscription.status] || subscription.status}
        </span>
      </div>

      <div style={S.row}>
        <span style={S.label}>{isTrialing ? 'Trial ends' : subscription.cancel_at_period_end ? 'Cancels' : 'Renews'}</span>
        <span style={S.val}>{formatDate(renewDate)}</span>
      </div>

      {isPastDue && (
        <div style={S.warnBox}>
          Payment failed — update your payment method to keep access after your grace period.
        </div>
      )}

      <button onClick={handleManageBilling} disabled={portalLoading} style={S.manageBtn}>
        {portalLoading ? 'Opening…' : 'Manage Billing →'}
      </button>
    </div>
  )
}

const S = {
  card: { display: 'flex', flexDirection: 'column', gap: 12 },
  statusRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  label: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700,
    color: '#7a8099', textTransform: 'uppercase', letterSpacing: 0.5,
  },
  val: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: '#e8eaf0', fontWeight: 700 },
  badge: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 800,
    padding: '2px 8px', borderRadius: 20, border: '1px solid',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  badgeActive:  { background: 'rgba(0,229,160,0.12)', borderColor: 'rgba(0,229,160,0.3)', color: '#00e5a0' },
  badgePastDue: { background: 'rgba(255,77,109,0.12)', borderColor: 'rgba(255,77,109,0.3)', color: '#ff4d6d' },
  warnBox: {
    background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.25)',
    borderRadius: 6, padding: '8px 12px', fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 11, fontWeight: 700, color: '#ff4d6d', lineHeight: 1.4,
  },
  manageBtn: {
    background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.25)',
    borderRadius: 8, color: '#00e5a0', fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 13, fontWeight: 800, padding: '10px 0', textTransform: 'uppercase',
    letterSpacing: 0.5, cursor: 'pointer', width: '100%',
  },
  ghostBtn: {
    background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.2)',
    borderRadius: 8, color: '#00e5a0', fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 13, fontWeight: 800, padding: '9px 0', textTransform: 'uppercase',
    letterSpacing: 0.5, cursor: 'pointer', width: '100%',
  },
  muted: { color: '#7a8099', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, margin: 0 },
  error: {
    background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.3)',
    color: '#ff4d6d', borderRadius: 6, padding: '8px 12px',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700,
  },
}
