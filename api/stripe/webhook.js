// api/stripe/webhook.js
// Stripe webhook handler — Vercel serverless function.
// IMPORTANT: Must receive the raw request body for signature verification.
// Supabase writes use the SERVICE ROLE KEY (never exposed to client).

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const config = { api: { bodyParser: false } }

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const rawBody = await getRawBody(req)
  const sig = req.headers['stripe-signature']

  let event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return res.status(400).json({ error: `Webhook error: ${err.message}` })
  }

  // Respond immediately — process async
  res.status(200).json({ received: true })

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object)
        break
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object)
        break
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object)
        break
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object)
        break
      default:
        // Unhandled event type — ignore
        break
    }
  } catch (err) {
    console.error(`Error processing event ${event.type}:`, err)
  }
}

async function handleCheckoutComplete(session) {
  // Retrieve full subscription object with price metadata
  const subscription = await stripe.subscriptions.retrieve(session.subscription, {
    expand: ['items.data.price'],
  })

  const price = subscription.items.data[0]?.price
  const metadata = price?.metadata || {}
  const subscriptionType = metadata.subscription_type || 'individual'
  const seatCount = parseInt(metadata.seats || '1', 10)
  const lookupKey = price?.lookup_key || null

  // Determine user_id and org_id from session metadata
  const userId = session.metadata?.user_id || null
  const orgId = session.metadata?.org_id || null
  const customerId = session.customer

  // Upsert subscription row
  const { error: subError } = await supabase.from('subscriptions').upsert({
    user_id: subscriptionType === 'individual' ? userId : null,
    organization_id: subscriptionType === 'org' ? orgId : null,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_price_id: price?.id,
    price_lookup_key: lookupKey,
    subscription_type: subscriptionType,
    seat_count: seatCount,
    status: subscription.status,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    trial_end: subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'stripe_subscription_id' })

  if (subError) console.error('Subscription upsert error:', subError)

  // Store Stripe customer ID mapping
  if (subscriptionType === 'individual' && userId) {
    await supabase.from('user_stripe').upsert(
      { user_id: userId, stripe_customer_id: customerId },
      { onConflict: 'user_id' }
    )
  } else if (subscriptionType === 'org' && orgId) {
    await supabase.from('organizations')
      .update({ stripe_customer_id: customerId })
      .eq('id', orgId)
  }

  // Auto-assign all org seats to existing members (up to seat_count)
  if (subscriptionType === 'org' && orgId && seatCount > 0) {
    const { data: members } = await supabase
      .from('user_organizations')
      .select('user_id')
      .eq('organization_id', orgId)
      .limit(seatCount)

    for (const member of members || []) {
      await supabase.from('org_seat_assignments').upsert(
        { organization_id: orgId, user_id: member.user_id, assigned_by: userId },
        { onConflict: 'organization_id,user_id' }
      )
    }
  }
}

async function handleSubscriptionUpdated(subscription) {
  const price = subscription.items?.data[0]?.price
  const metadata = price?.metadata || {}
  const seatCount = parseInt(metadata.seats || '1', 10)

  const { error } = await supabase.from('subscriptions').upsert({
    stripe_subscription_id: subscription.id,
    stripe_price_id: price?.id,
    price_lookup_key: price?.lookup_key || null,
    seat_count: seatCount,
    status: subscription.status,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: subscription.canceled_at
      ? new Date(subscription.canceled_at * 1000).toISOString()
      : null,
    trial_end: subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'stripe_subscription_id' })

  if (error) console.error('Subscription update error:', error)
}

async function handleSubscriptionDeleted(subscription) {
  const { error } = await supabase.from('subscriptions')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', subscription.id)

  if (error) console.error('Subscription delete error:', error)
}

async function handlePaymentFailed(invoice) {
  if (!invoice.subscription) return
  const { error } = await supabase.from('subscriptions')
    .update({ status: 'past_due', updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', invoice.subscription)

  if (error) console.error('Payment failed update error:', error)
}

async function handlePaymentSucceeded(invoice) {
  if (!invoice.subscription) return

  // Retrieve subscription to get updated period_end
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription)

  const { error } = await supabase.from('subscriptions').upsert({
    stripe_subscription_id: invoice.subscription,
    status: 'active',
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'stripe_subscription_id' })

  if (error) console.error('Payment succeeded update error:', error)
}
