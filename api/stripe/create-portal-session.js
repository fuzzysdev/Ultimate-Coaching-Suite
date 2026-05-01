// api/stripe/create-portal-session.js
// Creates a Stripe Customer Portal session and returns the redirect URL.
// Called from SubscriptionTab and OrgBillingPage "Manage Billing" buttons.

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

  // Verify Supabase JWT
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { orgId, returnPath = '/' } = req.body
  const baseUrl = process.env.APP_URL || `https://${req.headers.host}`

  try {
    let customerId

    if (orgId) {
      // Org billing portal
      const { data: org } = await supabase
        .from('organizations')
        .select('stripe_customer_id')
        .eq('id', orgId)
        .single()
      customerId = org?.stripe_customer_id
    } else {
      // Individual billing portal
      const { data: userStripe } = await supabase
        .from('user_stripe')
        .select('stripe_customer_id')
        .eq('user_id', user.id)
        .single()
      customerId = userStripe?.stripe_customer_id
    }

    if (!customerId) {
      return res.status(404).json({ error: 'No billing account found. Subscribe first.' })
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}${returnPath}`,
    })

    return res.status(200).json({ url: portalSession.url })
  } catch (err) {
    console.error('Portal session error:', err)
    return res.status(500).json({ error: 'Failed to create billing portal session' })
  }
}
