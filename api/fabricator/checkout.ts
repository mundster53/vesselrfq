import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2025-02-24.acacia',
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
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

    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('[checkout] stripe error', err)
    return res.status(500).json({ error: 'Failed to create checkout session' })
  }
}
