// Who can use what. Rosters and tryouts are free; these tabs need a paid plan or trial.
export const PAID_TABS = ['practices', 'gamesheet', 'attendance', 'stats']

// Statuses from the has_active_access RPC that unlock the paid tabs.
// Anything else ('free', or the older 'denied' / 'org_admin_only') is the free tier.
const PAID_STATUSES = ['super_admin', 'exempt', 'full', 'trial', 'past_due']
export const isPaidStatus = (status) => PAID_STATUSES.includes(status)

// Keep in sync with ALLOWED_PRICES in api/stripe/create-checkout-session.js
export const COACH_PRICES = [
  { priceId: 'price_1TS5FkJ80Mm4TIdPwNsrpbpN', label: 'Monthly', amount: '$10/mo', note: 'Cancel anytime' },
  { priceId: 'price_1TS5FlJ80Mm4TIdPWOwbCdK7', label: 'Annual', amount: '$100/yr', note: '2 months free' },
]
