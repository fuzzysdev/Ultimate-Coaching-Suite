// api/stripe/create-checkout-session.js
// Creates a Stripe Checkout Session and returns the redirect URL.
// Called by UpgradePanel. Each coach pays individually; the free trial is handled
// in-app (start_trial RPC), so Stripe billing starts right away.

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Relative in-app path only — blocks "//evil.com" and "@evil.com" open redirects
const isSafePath = (p) => typeof p === 'string' && /^\/(?![/\\])[A-Za-z0-9\-._~/?=&%]*$/.test(p)

// Keep in sync with COACH_PRICES in src/lib/access.js
const ALLOWED_PRICES = [
  'price_1TS5FkJ80Mm4TIdPwNsrpbpN', // $10/mo
  'price_1TS5FlJ80Mm4TIdPWOwbCdK7', // $100/yr
]

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Verify Supabase JWT from Authorization header
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { priceId, successPath = '/?checkout=success', cancelPath = '/' } = req.body

  if (!ALLOWED_PRICES.includes(priceId)) return res.status(400).json({ error: 'Invalid price' })
  if (!isSafePath(successPath) || !isSafePath(cancelPath)) {
    return res.status(400).json({ error: 'Invalid redirect path' })
  }

  const baseUrl = process.env.APP_URL || `https://${req.headers.host}`

  try {
    // Never create a second subscription for the same coach
    const { data: existing, error: existingError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .not('stripe_subscription_id', 'is', null)
      .in('status', ['active', 'trialing', 'past_due'])
      .limit(1)
    if (existingError) throw existingError
    if (existing.length > 0) return res.status(409).json({ error: 'Already subscribed' })

    const metadata = { user_id: user.id }

    // Reuse the existing customer to avoid duplicate Stripe customers
    const { data: userStripe } = await supabase
      .from('user_stripe')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()
    const customerId = userStripe?.stripe_customer_id

    const sessionParams = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}${successPath}`,
      cancel_url: `${baseUrl}${cancelPath}`,
      metadata,
      subscription_data: { metadata },
    }

    // Attach existing customer or prefill email for new customer
    if (customerId) {
      sessionParams.customer = customerId
    } else {
      sessionParams.customer_email = user.email
    }

    const session = await stripe.checkout.sessions.create(sessionParams)
    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('Checkout session error:', err)
    return res.status(500).json({ error: 'Failed to create checkout session' })
  }
}
