// api/stripe/create-checkout-session.js
// Creates a Stripe Checkout Session and returns the redirect URL.
// Called by PaywallPage and OrgBillingPage when a user clicks "Subscribe".

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Verify Supabase JWT from Authorization header
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { priceId, orgId, successPath = '/?checkout=success', cancelPath = '/' } = req.body

  if (!priceId) return res.status(400).json({ error: 'priceId is required' })

  const baseUrl = process.env.APP_URL || `https://${req.headers.host}`

  try {
    // Build metadata so the webhook knows which user/org this is for
    const metadata = { user_id: user.id }
    if (orgId) metadata.org_id = orgId

    // Look up existing customer ID to avoid duplicate Stripe customers
    let customerId
    if (orgId) {
      const { data: org } = await supabase
        .from('organizations')
        .select('stripe_customer_id')
        .eq('id', orgId)
        .single()
      customerId = org?.stripe_customer_id || undefined
    } else {
      const { data: userStripe } = await supabase
        .from('user_stripe')
        .select('stripe_customer_id')
        .eq('user_id', user.id)
        .single()
      customerId = userStripe?.stripe_customer_id || undefined
    }

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

    // Apply 30-day trial only for new individual subscribers with no prior subscription
    if (!orgId) {
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .single()

      if (!existingSub) {
        sessionParams.subscription_data.trial_period_days = 30
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams)
    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('Checkout session error:', err)
    return res.status(500).json({ error: 'Failed to create checkout session' })
  }
}
