import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'
import { eq } from 'drizzle-orm'
import { db } from '../_lib/db.js'
import { users } from '../../db/schema.js'
import { sendEmail, fabricatorOnboardingHtml, fabricatorOnboardingText } from '../_lib/email.js'

// Vercel must not parse the body — Stripe signature verification requires the raw bytes.
export const config = { api: { bodyParser: false } }

function getRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const testMode = process.env.STRIPE_TEST_MODE === 'true'

  const stripeKey = testMode ? process.env.STRIPE_TEST_SECRET_KEY : process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    console.error(`[webhook] ${testMode ? 'STRIPE_TEST_SECRET_KEY' : 'STRIPE_SECRET_KEY'} is not set`)
    return res.status(500).json({ error: 'Payment configuration error' })
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia' })

  const webhookSecret = testMode ? process.env.STRIPE_TEST_WEBHOOK_SECRET : process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error(`[webhook] ${testMode ? 'STRIPE_TEST_WEBHOOK_SECRET' : 'STRIPE_WEBHOOK_SECRET'} is not set`)
    return res.status(500).json({ error: 'Webhook secret not configured' })
  }

  console.log(`[webhook] running in ${testMode ? 'TEST' : 'LIVE'} mode`)

  const signature = req.headers['stripe-signature']
  if (!signature) {
    return res.status(400).json({ error: 'Missing stripe-signature header' })
  }

  let event: Stripe.Event
  try {
    const rawBody = await getRawBody(req)
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    console.error('[webhook] Signature verification failed:', (err as Error).message)
    return res.status(400).json({ error: 'Webhook signature verification failed' })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session

      const customerEmail = session.customer_details?.email
      const stripeCustomerId = typeof session.customer === 'string' ? session.customer : null
      const userIdFromMeta = session.metadata?.userId ? parseInt(session.metadata.userId, 10) : null

      if (!customerEmail && !userIdFromMeta) {
        console.warn('[webhook] checkout.session.completed: no email or userId in session')
        return res.status(200).json({ received: true })
      }

      // Prefer userId from metadata (set when checkout is initiated from the app);
      // fall back to email lookup for sessions initiated from the landing page.
      const whereClause = userIdFromMeta
        ? eq(users.id, userIdFromMeta)
        : eq(users.email, customerEmail!.toLowerCase())

      const [user] = await db
        .select({ id: users.id, email: users.email, role: users.role })
        .from(users)
        .where(whereClause)
        .limit(1)

      if (!user) {
        console.warn('[webhook] checkout.session.completed: no user found for', userIdFromMeta ?? customerEmail)
        return res.status(200).json({ received: true })
      }

      await db
        .update(users)
        .set({
          active: true,
          ...(stripeCustomerId ? { stripeCustomerId } : {}),
        } as Partial<typeof users.$inferInsert>)
        .where(eq(users.id, user.id))

      console.log(`[webhook] Activated fabricator account id=${user.id}`)

      try {
        await sendEmail(
          user.email,
          'Welcome to VesselRFQ — here\'s how to get your configurator live',
          fabricatorOnboardingHtml(user.id, user.email),
          fabricatorOnboardingText(user.id, user.email),
        )
        console.log(`[webhook] Onboarding email sent to ${user.email}`)
      } catch (emailErr) {
        // Log but don't fail the webhook — account is already activated
        console.error('[webhook] Failed to send onboarding email:', emailErr)
      }
    }

    else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription
      const stripeCustomerId = typeof subscription.customer === 'string' ? subscription.customer : null

      if (!stripeCustomerId) {
        console.warn('[webhook] customer.subscription.deleted: no customer ID on subscription')
        return res.status(200).json({ received: true })
      }

      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.stripeCustomerId, stripeCustomerId))
        .limit(1)

      if (!user) {
        console.warn('[webhook] customer.subscription.deleted: no user found for customer', stripeCustomerId)
        return res.status(200).json({ received: true })
      }

      await db
        .update(users)
        .set({ active: false } as Partial<typeof users.$inferInsert>)
        .where(eq(users.id, user.id))

      console.log(`[webhook] Deactivated fabricator account id=${user.id}`)
    }

    return res.status(200).json({ received: true })
  } catch (err) {
    console.error('[webhook] Handler error:', err)
    return res.status(500).json({ error: 'Webhook handler failed' })
  }
}
