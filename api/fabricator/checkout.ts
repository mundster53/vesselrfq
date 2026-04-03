import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'
import { eq } from 'drizzle-orm'
import { db } from '../_lib/db.js'
import { users } from '../../db/schema.js'
import { requireAuth } from '../_lib/auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const testMode = process.env.STRIPE_TEST_MODE === 'true'
    const stripeKey = testMode
      ? process.env.STRIPE_TEST_SECRET_KEY
      : process.env.STRIPE_SECRET_KEY

    if (!stripeKey) {
      console.error(`[checkout] ${testMode ? 'STRIPE_TEST_SECRET_KEY' : 'STRIPE_SECRET_KEY'} is not set`)
      return res.status(500).json({ error: 'Payment configuration error' })
    }

    console.log(`[checkout] running in ${testMode ? 'TEST' : 'LIVE'} mode`)

    const stripe = new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia' })

    const auth = await requireAuth(req, res)
    if (!auth) return

    const [user] = await db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(eq(users.id, auth.userId))
      .limit(1)

    if (!user) return res.status(404).json({ error: 'User not found' })
    if (user.role !== 'fabricator') return res.status(403).json({ error: 'Fabricator access required' })

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: user.email,
      metadata: { userId: String(user.id) },
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'VesselRFQ — Founding Fabricator',
              description:
                'Monthly subscription — vessel configurator on your website, RFQ dashboard, customer reactivation emails',
            },
            unit_amount: 19700, // $197.00
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      success_url: 'https://vesselrfq.com/fabricators/success',
      cancel_url: 'https://vesselrfq.com/fabricators',
    })

    if (!session.url) {
      console.error('[checkout] Stripe session created but URL is null', { sessionId: session.id })
      return res.status(500).json({ error: 'Checkout session URL unavailable' })
    }

    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('[checkout] error', err)
    return res.status(500).json({ error: 'Failed to create checkout session' })
  }
}
