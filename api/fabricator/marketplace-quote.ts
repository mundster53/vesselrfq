import type { VercelRequest, VercelResponse } from '@vercel/node'
import { and, eq } from 'drizzle-orm'
import { db } from '../_lib/db.js'
import {
  marketplaceRfqs, marketplaceQuotes, fabricatorBidProfiles, users,
} from '../../db/schema.js'
import { requireAuth } from '../_lib/auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const auth = await requireAuth(req, res)
    if (!auth) return
    if (auth.role !== 'fabricator') return res.status(403).json({ error: 'Fabricator access required' })

    // ── Eligibility check ─────────────────────────────────────────────────────
    const [userRecord] = await db
      .select({ active: users.active })
      .from(users)
      .where(eq(users.id, auth.userId))
      .limit(1)

    const [bidProfile] = await db
      .select({ profileComplete: fabricatorBidProfiles.profileComplete })
      .from(fabricatorBidProfiles)
      .where(eq(fabricatorBidProfiles.userId, auth.userId))
      .limit(1)

    if (!userRecord?.active || !bidProfile?.profileComplete) {
      return res.status(403).json({ error: 'Not eligible to submit quotes' })
    }

    // ── Validate input ────────────────────────────────────────────────────────
    const { marketplaceRfqId, fabricatedPrice, estimatedFreight, leadTimeWeeks, qualifications } = req.body as {
      marketplaceRfqId: unknown
      fabricatedPrice:  unknown
      estimatedFreight: unknown
      leadTimeWeeks:    unknown
      qualifications:   unknown
    }

    if (
      typeof marketplaceRfqId !== 'number' ||
      typeof fabricatedPrice  !== 'number' || fabricatedPrice  <= 0 ||
      typeof estimatedFreight !== 'number' || estimatedFreight <  0 ||
      typeof leadTimeWeeks    !== 'number' || leadTimeWeeks    <  1
    ) {
      return res.status(400).json({ error: 'marketplaceRfqId, fabricatedPrice, estimatedFreight, and leadTimeWeeks are required' })
    }

    // ── Verify the marketplace RFQ is still open ──────────────────────────────
    const [mrfq] = await db
      .select({ status: marketplaceRfqs.status })
      .from(marketplaceRfqs)
      .where(eq(marketplaceRfqs.id, marketplaceRfqId))
      .limit(1)

    if (!mrfq) return res.status(404).json({ error: 'Marketplace RFQ not found' })
    if (mrfq.status !== 'open') return res.status(409).json({ error: 'This RFQ is no longer open for quotes' })

    // ── Prevent duplicate quotes ──────────────────────────────────────────────
    const [existing] = await db
      .select({ id: marketplaceQuotes.id })
      .from(marketplaceQuotes)
      .where(
        and(
          eq(marketplaceQuotes.marketplaceRfqId, marketplaceRfqId),
          eq(marketplaceQuotes.fabricatorId, auth.userId),
        )
      )
      .limit(1)

    if (existing) {
      return res.status(409).json({ error: 'You have already submitted a quote for this RFQ', quoteId: existing.id })
    }

    // ── Insert quote ──────────────────────────────────────────────────────────
    const [inserted] = await db
      .insert(marketplaceQuotes)
      .values({
        marketplaceRfqId,
        fabricatorId:    auth.userId,
        fabricatedPrice: String(fabricatedPrice),
        estimatedFreight: String(estimatedFreight),
        leadTimeWeeks,
        qualifications: typeof qualifications === 'string' && qualifications.trim() ? qualifications.trim() : null,
      })
      .returning({ id: marketplaceQuotes.id })

    return res.status(201).json({ quoteId: inserted.id })
  } catch (err) {
    console.error('[fabricator/marketplace-quote]', err)
    return res.status(500).json({ error: (err as Error).message ?? 'Internal server error' })
  }
}
