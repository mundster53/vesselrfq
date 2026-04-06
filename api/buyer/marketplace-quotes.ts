import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, desc, asc, inArray } from 'drizzle-orm'
import { db } from '../_lib/db.js'
import {
  marketplaceRfqs, marketplaceQuotes, rfqs,
  fabricatorProfiles,
} from '../../db/schema.js'
import { requireAuth } from '../_lib/auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const auth = await requireAuth(req, res)
    if (!auth) return
    if (auth.role !== 'buyer') return res.status(403).json({ error: 'Buyer access required' })

    // ── Fetch this buyer's marketplace RFQs ───────────────────────────────────
    const buyerMrfqs = await db
      .select({
        marketplaceRfqId: marketplaceRfqs.id,
        rfqId:            marketplaceRfqs.rfqId,
        status:           marketplaceRfqs.status,
        installCity:      marketplaceRfqs.installCity,
        installState:     marketplaceRfqs.installState,
        deadlineAt:       marketplaceRfqs.deadlineAt,
        rfqTitle:         rfqs.title,
        vesselType:       rfqs.vesselType,
        shellOd:          rfqs.shellOd,
      })
      .from(marketplaceRfqs)
      .innerJoin(rfqs, eq(rfqs.id, marketplaceRfqs.rfqId))
      .where(eq(marketplaceRfqs.buyerId, auth.userId))
      .orderBy(desc(marketplaceRfqs.createdAt))

    if (buyerMrfqs.length === 0) return res.status(200).json({ rfqs: [] })

    // ── Fetch all quotes for those marketplace RFQs ───────────────────────────
    const mrfqIds = buyerMrfqs.map(r => r.marketplaceRfqId)

    const allQuotes = await db
      .select({
        quoteId:             marketplaceQuotes.id,
        marketplaceRfqId:    marketplaceQuotes.marketplaceRfqId,
        fabricatorId:        marketplaceQuotes.fabricatorId,
        fabricatedPrice:     marketplaceQuotes.fabricatedPrice,
        estimatedFreight:    marketplaceQuotes.estimatedFreight,
        totalDeliveredPrice: marketplaceQuotes.totalDeliveredPrice,
        leadTimeWeeks:       marketplaceQuotes.leadTimeWeeks,
        qualifications:      marketplaceQuotes.qualifications,
        status:              marketplaceQuotes.status,
        submittedAt:         marketplaceQuotes.submittedAt,
        shopName:            fabricatorProfiles.shopName,
        city:                fabricatorProfiles.city,
        state:               fabricatorProfiles.state,
      })
      .from(marketplaceQuotes)
      .innerJoin(fabricatorProfiles, eq(fabricatorProfiles.userId, marketplaceQuotes.fabricatorId))
      .where(inArray(marketplaceQuotes.marketplaceRfqId, mrfqIds))
      .orderBy(asc(marketplaceQuotes.totalDeliveredPrice))

    // ── Group quotes by marketplaceRfqId ──────────────────────────────────────
    const quotesByMrfq = new Map<number, typeof allQuotes>()
    for (const q of allQuotes) {
      const arr = quotesByMrfq.get(q.marketplaceRfqId) ?? []
      arr.push(q)
      quotesByMrfq.set(q.marketplaceRfqId, arr)
    }

    // ── Build response ────────────────────────────────────────────────────────
    const result = buyerMrfqs.map(r => ({
      marketplaceRfqId: r.marketplaceRfqId,
      rfqId:            r.rfqId,
      rfqTitle:         r.rfqTitle,
      vesselType:       r.vesselType,
      shellOd:          r.shellOd,
      installCity:      r.installCity,
      installState:     r.installState,
      deadlineAt:       r.deadlineAt,
      status:           r.status,
      quotes: (quotesByMrfq.get(r.marketplaceRfqId) ?? []).map(q => ({
        quoteId:             q.quoteId,
        fabricatorId:        q.fabricatorId,
        shopName:            q.shopName,
        city:                q.city,
        state:               q.state,
        fabricatedPrice:     q.fabricatedPrice,
        estimatedFreight:    q.estimatedFreight,
        totalDeliveredPrice: q.totalDeliveredPrice,
        leadTimeWeeks:       q.leadTimeWeeks,
        qualifications:      q.qualifications,
        status:              q.status,
        submittedAt:         q.submittedAt,
      })),
    }))

    return res.status(200).json({ rfqs: result })
  } catch (err) {
    console.error('[buyer/marketplace-quotes]', err)
    return res.status(500).json({ error: (err as Error).message ?? 'Internal server error' })
  }
}
