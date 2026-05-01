import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Shown when has_active_access returns 'org_admin_only'.
// The org admin has no personal subscription but manages licenses for their org.
// They can buy an org plan or manage existing seats.
//
// Replace the priceId values below with your real Stripe Price IDs.

const ORG_PLANS = [
  { label: '5-Coach Monthly',  priceId: 'REPLACE_WITH_STRIPE_PRICE_ID_ORG_5_MONTHLY',  amount: '$35/mo',   seats: 5 },
  { label: '5-Coach Annual',   priceId: 'REPLACE_WITH_STRIPE_PRICE_ID_ORG_5_YEARLY',   amount: '$299/yr',  seats: 5 },
  { label: '10-Coach Monthly', priceId: 'REPLACE_WITH_STRIPE_PRICE_ID_ORG_10_MONTHLY', amount: '$60/mo',   seats: 10 },
  { label: '10-Coach Annual',  priceId: 'REPLACE_WITH_STRIPE_PRICE_ID_ORG_10_YEARLY',  amount: '$499/yr',  seats: 10 },
  { label: '25-Coach Monthly', priceId: 'REPLACE_WITH_STRIPE_PRICE_ID_ORG_25_MONTHLY', amount: '$120/mo',  seats: 25 },
  { label: '25-Coach Annual',  priceId: 'REPLACE_WITH_STRIPE_PRICE_ID_ORG_25_YEARLY',  amount: '$999/yr',  seats: 25 },
]

export default function OrgBillingPage({ session, onAccessChange }) {
  const [adminOrgs,     setAdminOrgs]     = useState([])
  const [selectedOrg,   setSelectedOrg]   = useState(null)
  const [subscription,  setSubscription]  = useState(null)  // active org sub
  const [members,       setMembers]       = useState([])
  const [seats,         setSeats]         = useState([])    // org_seat_assignments
  const [seatsRemaining, setSeatsRemaining] = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [error,         setError]         = useState(null)

  useEffect(() => { fetchAdminOrgs() }, [])
  useEffect(() => { if (selectedOrg) fetchOrgData(selectedOrg.id) }, [selectedOrg])

  const fetchAdminOrgs = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('user_organizations')
      .select('organization_id, organizations(id, name)')
      .eq('user_id', session.user.id)
      .eq('role', 'admin')
    const orgs = (data || []).map(r => r.organizations).filter(Boolean)
    setAdminOrgs(orgs)
    setSelectedOrg(orgs[0] || null)
    setLoading(false)
  }

  const fetchOrgData = async (orgId) => {
    setLoading(true)
    setError(null)
    const [subRes, memberRes, seatRes, remainRes] = await Promise.all([
      supabase.from('subscriptions')
        .select('*')
        .eq('organization_id', orgId)
        .in('status', ['active', 'trialing', 'past_due'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.rpc('get_org_members', { p_org_id: orgId }),
      supabase.from('org_seat_assignments')
        .select('user_id')
        .eq('organization_id', orgId),
      supabase.rpc('org_seats_remaining', { p_org_id: orgId }),
    ])
    setSubscription(subRes.data || null)
    setMembers(memberRes.data || [])
    setSeats((seatRes.data || []).map(r => r.user_id))
    setSeatsRemaining(remainRes.data ?? null)
    setLoading(false)
  }

  const handleSubscribe = async (priceId) => {
    if (!selectedOrg || actionLoading) return
    setActionLoading(priceId)
    setError(null)
    try {
      const { data: { session: cur } } = await supabase.auth.getSession()
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cur.access_token}` },
        body: JSON.stringify({ priceId, orgId: selectedOrg.id }),
      })
      const json = await res.json()
      if (!res.ok || !json.url) throw new Error(json.error || 'Failed')
      window.location.href = json.url
    } catch (err) {
      console.error(err)
      setError('Could not start checkout. Please try again.')
      setActionLoading(null)
    }
  }

  const handleManageBilling = async () => {
    if (!selectedOrg || actionLoading) return
    setActionLoading('portal')
    setError(null)
    try {
      const { data: { session: cur } } = await supabase.auth.getSession()
      const res = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cur.access_token}` },
        body: JSON.stringify({ orgId: selectedOrg.id }),
      })
      const json = await res.json()
      if (!res.ok || !json.url) throw new Error(json.error || 'Failed')
      window.location.href = json.url
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to open billing portal.')
      setActionLoading(null)
    }
  }

  const handleAssignSeat = async (userId) => {
    if (!selectedOrg || actionLoading) return
    setActionLoading(`assign_${userId}`)
    const { error } = await supabase.from('org_seat_assignments').insert({
      organization_id: selectedOrg.id,
      user_id: userId,
      assigned_by: session.user.id,
    })
    if (error) setError('Failed to assign seat.')
    else await fetchOrgData(selectedOrg.id)
    setActionLoading(null)
  }

  const handleRevokeSeat = async (userId) => {
    if (!selectedOrg || actionLoading) return
    setActionLoading(`revoke_${userId}`)
    const { error } = await supabase.from('org_seat_assignments')
      .delete()
      .eq('organization_id', selectedOrg.id)
      .eq('user_id', userId)
    if (error) setError('Failed to revoke seat.')
    else await fetchOrgData(selectedOrg.id)
    setActionLoading(null)
  }

  const handleSignOut = () => supabase.auth.signOut()

  const s = S

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.logo}>UCS <span style={s.logoSub}>Org Billing</span></div>
        <div style={s.headerRight}>
          <span style={s.email}>{session.user.email}</span>
          <button onClick={handleSignOut} style={s.signOutBtn}>Sign Out</button>
        </div>
      </header>

      <div style={s.content}>
        {error && <div style={s.error}>{error}</div>}

        {/* Org selector (if admin of multiple orgs) */}
        {adminOrgs.length > 1 && (
          <div style={s.orgSelector}>
            <label style={s.label}>Organization</label>
            <select value={selectedOrg?.id || ''}
              onChange={e => setSelectedOrg(adminOrgs.find(o => o.id === e.target.value))}
              style={s.select}>
              {adminOrgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        )}

        {loading ? (
          <div style={s.loading}>Loading...</div>
        ) : !selectedOrg ? (
          <p style={s.muted}>You are not an admin of any organization.</p>
        ) : (
          <>
            {/* Active subscription info */}
            <div style={s.card}>
              <div style={s.cardTitle}>
                {selectedOrg.name}
                {subscription && (
                  <span style={{ ...s.statusBadge, ...(subscription.status === 'active' ? s.statusActive : s.statusWarn) }}>
                    {subscription.status}
                  </span>
                )}
              </div>

              {subscription ? (
                <div style={s.subInfo}>
                  <div style={s.subRow}>
                    <span style={s.subLabel}>Seats purchased</span>
                    <span style={s.subVal}>{subscription.seat_count}</span>
                  </div>
                  <div style={s.subRow}>
                    <span style={s.subLabel}>Seats remaining</span>
                    <span style={{ ...s.subVal, color: seatsRemaining <= 0 ? '#ff4d6d' : '#00e5a0' }}>
                      {seatsRemaining ?? '—'}
                    </span>
                  </div>
                  {subscription.current_period_end && (
                    <div style={s.subRow}>
                      <span style={s.subLabel}>Renews</span>
                      <span style={s.subVal}>
                        {new Date(subscription.current_period_end).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={handleManageBilling}
                    disabled={!!actionLoading}
                    style={s.manageBtn}>
                    {actionLoading === 'portal' ? 'Opening…' : 'Manage Billing →'}
                  </button>
                </div>
              ) : (
                <div>
                  <p style={s.muted}>No active subscription. Choose a plan to give your coaches access.</p>
                  <div style={s.planGrid}>
                    {ORG_PLANS.map(plan => (
                      <button key={plan.priceId}
                        onClick={() => handleSubscribe(plan.priceId)}
                        disabled={!!actionLoading}
                        style={{ ...s.planBtn, opacity: actionLoading ? 0.6 : 1 }}>
                        <span style={s.planLabel}>{plan.label}</span>
                        <span style={s.planAmount}>{plan.amount}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Seat assignments */}
            {subscription && members.length > 0 && (
              <div style={s.card}>
                <div style={s.cardTitle}>Coach Seats</div>
                <p style={s.muted}>Assign seats to give coaches access to the app.</p>
                <div style={s.memberList}>
                  {members.map(m => {
                    const hasSeated = seats.includes(m.user_id)
                    const isLoading = actionLoading === `assign_${m.user_id}` ||
                      actionLoading === `revoke_${m.user_id}`
                    return (
                      <div key={m.user_id} style={s.memberRow}>
                        <div style={s.memberInfo}>
                          <span style={s.memberEmail}>{m.email}</span>
                          <span style={{ ...s.roleBadge, ...(m.role === 'admin' ? s.roleAdmin : s.roleMember) }}>
                            {m.role}
                          </span>
                        </div>
                        {hasSeated ? (
                          <button onClick={() => handleRevokeSeat(m.user_id)}
                            disabled={isLoading || !!actionLoading}
                            style={s.revokeBtn}>
                            {isLoading ? '…' : 'Revoke'}
                          </button>
                        ) : (
                          <button onClick={() => handleAssignSeat(m.user_id)}
                            disabled={isLoading || !!actionLoading || seatsRemaining <= 0}
                            style={{ ...s.assignBtn, opacity: seatsRemaining <= 0 ? 0.4 : 1 }}>
                            {isLoading ? '…' : 'Assign Seat'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <p style={{ ...s.muted, marginTop: 16, textAlign: 'center', fontSize: 12 }}>
              Already subscribed? <span style={s.link} onClick={onAccessChange}>Refresh access</span>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

const S = {
  page: { minHeight: '100vh', background: '#0f1117', display: 'flex', flexDirection: 'column' },
  header: {
    background: '#181c26', borderBottom: '1px solid #2a2f42',
    padding: '12px 20px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', gap: 12, position: 'sticky', top: 0, zIndex: 100,
  },
  logo: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 800,
    color: '#00e5a0', textTransform: 'uppercase', letterSpacing: 1,
  },
  logoSub: { color: '#7a8099', fontWeight: 400, fontSize: 14, marginLeft: 6 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 10 },
  email: { color: '#7a8099', fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif" },
  signOutBtn: {
    background: 'none', border: '1px solid #2a2f42', borderRadius: 6,
    color: '#7a8099', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
    fontWeight: 700, padding: '5px 12px', textTransform: 'uppercase', cursor: 'pointer',
  },
  content: { padding: '24px 20px', maxWidth: 600, width: '100%', margin: '0 auto' },
  loading: {
    fontFamily: "'Barlow Condensed', sans-serif", color: '#7a8099',
    fontSize: 14, textAlign: 'center', padding: 40,
  },
  error: {
    background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.3)',
    color: '#ff4d6d', borderRadius: 8, padding: '10px 14px', marginBottom: 16,
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700,
  },
  orgSelector: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 },
  label: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700,
    color: '#7a8099', textTransform: 'uppercase', letterSpacing: 1,
  },
  select: {
    background: '#1f2435', border: '1px solid #2a2f42', color: '#e8eaf0',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 600,
    padding: '6px 10px', borderRadius: 6, outline: 'none', cursor: 'pointer',
  },
  card: {
    background: '#181c26', border: '1px solid #2a2f42', borderRadius: 12,
    padding: '20px 18px', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 14,
  },
  cardTitle: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 900,
    color: '#e8eaf0', textTransform: 'uppercase', letterSpacing: 1,
    display: 'flex', alignItems: 'center', gap: 10,
  },
  statusBadge: {
    fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20,
    fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5,
    textTransform: 'uppercase', border: '1px solid',
  },
  statusActive: { background: 'rgba(0,229,160,0.12)', borderColor: 'rgba(0,229,160,0.3)', color: '#00e5a0' },
  statusWarn:   { background: 'rgba(255,152,0,0.12)', borderColor: 'rgba(255,152,0,0.3)', color: '#ff9800' },
  subInfo: { display: 'flex', flexDirection: 'column', gap: 10 },
  subRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  subLabel: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: '#7a8099', fontWeight: 700, textTransform: 'uppercase' },
  subVal:   { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: '#e8eaf0', fontWeight: 800 },
  manageBtn: {
    background: 'rgba(0,229,160,0.1)', border: '1px solid rgba(0,229,160,0.3)',
    borderRadius: 8, color: '#00e5a0', fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 13, fontWeight: 800, padding: '10px 0', textTransform: 'uppercase',
    letterSpacing: 0.5, cursor: 'pointer', width: '100%',
  },
  planGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 },
  planBtn: {
    background: '#0f1117', border: '1px solid #2a2f42', borderRadius: 8,
    color: '#e8eaf0', fontFamily: "'Barlow Condensed', sans-serif",
    cursor: 'pointer', padding: '12px 8px', display: 'flex',
    flexDirection: 'column', alignItems: 'center', gap: 4,
  },
  planLabel:  { fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#7a8099' },
  planAmount: { fontSize: 18, fontWeight: 900, color: '#00e5a0' },
  memberList: { display: 'flex', flexDirection: 'column', gap: 2 },
  memberRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 0', borderBottom: '1px solid #1a1e2a', gap: 8,
  },
  memberInfo: { display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  memberEmail: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: '#e8eaf0',
    fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  roleBadge: {
    fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 20,
    fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5,
    textTransform: 'uppercase', border: '1px solid', flexShrink: 0,
  },
  roleAdmin:  { background: 'rgba(0,229,160,0.1)', borderColor: 'rgba(0,229,160,0.25)', color: '#00e5a0' },
  roleMember: { background: 'rgba(122,128,153,0.08)', borderColor: 'rgba(122,128,153,0.2)', color: '#7a8099' },
  assignBtn: {
    background: 'rgba(0,229,160,0.1)', border: '1px solid rgba(0,229,160,0.3)',
    borderRadius: 6, color: '#00e5a0', fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 11, fontWeight: 800, padding: '4px 10px', textTransform: 'uppercase',
    cursor: 'pointer', flexShrink: 0,
  },
  revokeBtn: {
    background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.25)',
    borderRadius: 6, color: '#ff4d6d', fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 11, fontWeight: 800, padding: '4px 10px', textTransform: 'uppercase',
    cursor: 'pointer', flexShrink: 0,
  },
  muted: { color: '#7a8099', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, margin: 0 },
  link:  { color: '#00e5a0', cursor: 'pointer', textDecoration: 'underline' },
}
