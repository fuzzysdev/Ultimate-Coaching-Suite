import { useState } from 'react'

// Shown inside MainShell for 'trial' and 'past_due' access statuses.
// Dismissed per-session via sessionStorage.

export default function SubscriptionBanner({ accessStatus, subscription, onManageBilling }) {
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(`banner_dismissed_${accessStatus}`) === '1'
  )

  if (dismissed) return null
  if (accessStatus !== 'trial' && accessStatus !== 'past_due') return null

  const handleDismiss = () => {
    sessionStorage.setItem(`banner_dismissed_${accessStatus}`, '1')
    setDismissed(true)
  }

  const isTrial = accessStatus === 'trial'

  let message = ''
  if (isTrial) {
    if (subscription?.trial_end) {
      const trialEnd = new Date(subscription.trial_end)
      const daysLeft = Math.ceil((trialEnd - Date.now()) / (1000 * 60 * 60 * 24))
      message = daysLeft > 1
        ? `Free trial — ${daysLeft} days left`
        : daysLeft === 1
          ? 'Free trial — last day'
          : 'Free trial — expires today'
    } else {
      message = 'You are on a free trial'
    }
  } else {
    message = 'Payment failed — update your payment method to keep access'
  }

  return (
    <div style={{ ...S.banner, ...(isTrial ? S.trial : S.pastDue) }}>
      <span style={S.msg}>{message}</span>
      <div style={S.actions}>
        <button onClick={onManageBilling} style={{ ...S.actionBtn, ...(isTrial ? S.trialBtn : S.pastDueBtn) }}>
          {isTrial ? 'Subscribe Now' : 'Update Billing'}
        </button>
        <button onClick={handleDismiss} style={S.dismissBtn} aria-label="Dismiss">✕</button>
      </div>
    </div>
  )
}

const S = {
  banner: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 16px', gap: 12, flexWrap: 'wrap',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700,
    letterSpacing: 0.5, textTransform: 'uppercase',
  },
  trial: {
    background: 'rgba(77,159,255,0.12)',
    borderBottom: '1px solid rgba(77,159,255,0.25)',
    color: '#4d9fff',
  },
  pastDue: {
    background: 'rgba(255,77,109,0.12)',
    borderBottom: '1px solid rgba(255,77,109,0.3)',
    color: '#ff4d6d',
  },
  msg: { flex: 1 },
  actions: { display: 'flex', alignItems: 'center', gap: 8 },
  actionBtn: {
    border: 'none', borderRadius: 6, padding: '4px 12px',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
    fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5,
    cursor: 'pointer',
  },
  trialBtn: { background: '#4d9fff', color: '#0f1117' },
  pastDueBtn: { background: '#ff4d6d', color: '#fff' },
  dismissBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'inherit', opacity: 0.5, fontSize: 13, padding: '2px 4px',
  },
}
