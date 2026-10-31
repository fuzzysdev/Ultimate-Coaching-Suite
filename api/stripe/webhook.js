// api/stripe/webhook.js
// Stripe webhook handler — Vercel serverless function.
// IMPORTANT: Must receive the raw request body for signature verification.
// Supabase writes use the SERVICE ROLE KEY (never exposed to client).
//
// Written for Stripe API 2025-03-31 (basil) and later, where:
//   - current_period_start/end live on subscription ITEMS, not the subscription
//   - invoice.subscription moved to invoice.parent.subscription_details.subscription

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

// Unix seconds → ISO string, or null when Stripe omits the field
const toIso = (secs) => (secs ? new Date(secs * 1000).toISOString() : null)

// Period dates moved to subscription items in newer API versions
function periodOf(subscription) {
  const item = subscription.items?.data?.[0]
  return {
    current_period_start: toIso(item?.current_period_start ?? subscription.current_period_start),
    current_period_end:   toIso(item?.current_period_end   ?? subscription.current_period_end),
  }
}

function invoiceSubscriptionId(invoice) {
  const sub = invoice.parent?.subscription_details?.subscription ?? invoice.subscription
  return typeof sub === 'string' ? sub : sub?.id || null
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
    return res.status(400).json({ error: 'Invalid signature' })
  }

  // Process BEFORE responding: Vercel may freeze the function once the response
  // is sent, and a non-2xx response makes Stripe retry the event later.
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
    return res.status(500).json({ error: 'Processing failed' })
  }

  return res.status(200).json({ received: true })
}

// Throws on Supabase error so the handler returns 500 and Stripe retries
function check(error, label) {
  if (error) {
    console.error(`${label}:`, error)
    throw new Error(label)
  }
}

async function handleCheckoutComplete(session) {
  if (!session.subscription) return

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
    ...periodOf(subscription),
    cancel_at_period_end: subscription.cancel_at_period_end,
    trial_end: toIso(subscription.trial_end),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'stripe_subscription_id' })
  check(subError, 'Subscription upsert error')

  // Store Stripe customer ID mapping
  if (subscriptionType === 'individual' && userId) {
    const { error } = await supabase.from('user_stripe').upsert(
      { user_id: userId, stripe_customer_id: customerId },
      { onConflict: 'user_id' }
    )
    check(error, 'user_stripe upsert error')
  } else if (subscriptionType === 'org' && orgId) {
    const { error } = await supabase.from('organizations')
      .update({ stripe_customer_id: customerId })
      .eq('id', orgId)
    check(error, 'organizations customer update error')
  }

  // Auto-assign all org seats to existing members (up to seat_count)
  if (subscriptionType === 'org' && orgId && seatCount > 0) {
    const { data: members } = await supabase
      .from('user_organizations')
      .select('user_id')
      .eq('organization_id', orgId)
      .limit(seatCount)

    const rows = (members || []).map(m => ({
      organization_id: orgId, user_id: m.user_id, assigned_by: userId,
    }))
    if (rows.length > 0) {
      const { error } = await supabase.from('org_seat_assignments')
        .upsert(rows, { onConflict: 'organization_id,user_id' })
      check(error, 'Seat assignment error')
    }
  }
}

async function handleSubscriptionUpdated(subscription) {
  const price = subscription.items?.data[0]?.price
  const metadata = price?.metadata || {}
  const seatCount = parseInt(metadata.seats || '1', 10)

  // update (not upsert): the row is created by checkout.session.completed, and
  // an upsert here could create an orphan row with no user/org if events arrive out of order.
  const { error } = await supabase.from('subscriptions').update({
    stripe_price_id: price?.id,
    price_lookup_key: price?.lookup_key || null,
    seat_count: seatCount,
    status: subscription.status,
    ...periodOf(subscription),
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: toIso(subscription.canceled_at),
    trial_end: toIso(subscription.trial_end),
    updated_at: new Date().toISOString(),
  }).eq('stripe_subscription_id', subscription.id)
  check(error, 'Subscription update error')
}

async function handleSubscriptionDeleted(subscription) {
  const { error } = await supabase.from('subscriptions')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', subscription.id)
  check(error, 'Subscription delete error')
}

async function handlePaymentFailed(invoice) {
  const subId = invoiceSubscriptionId(invoice)
  if (!subId) return
  const { error } = await supabase.from('subscriptions')
    .update({ status: 'past_due', updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', subId)
  check(error, 'Payment failed update error')
}

async function handlePaymentSucceeded(invoice) {
  const subId = invoiceSubscriptionId(invoice)
  if (!subId) return

  // Retrieve subscription to get the real status and updated period
  const subscription = await stripe.subscriptions.retrieve(subId)

  const { error } = await supabase.from('subscriptions').update({
    status: subscription.status,
    ...periodOf(subscription),
    updated_at: new Date().toISOString(),
  }).eq('stripe_subscription_id', subId)
  check(error, 'Payment succeeded update error')
}
