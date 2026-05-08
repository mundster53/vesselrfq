import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq } from 'drizzle-orm'
import { db } from '../_lib/db.js'
import {
  marketplaceRfqs,
  marketplaceQuotes,
  rfqs,
  nozzles,
  fabricatorProfiles,
} from '../../db/schema.js'
import { requireAuth } from '../_lib/auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const auth = await requireAuth(req, res)
    if (!auth) return
    if (auth.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })

    const id = Number(req.query.id)
    if (!id || isNaN(id)) return res.status(400).json({ error: 'Missing or invalid id' })

    // 1. Get marketplaceRfqs row
    const [mRfq] = await db
      .select()
      .from(marketplaceRfqs)
      .where(eq(marketplaceRfqs.id, id))
      .limit(1)

    if (!mRfq) return res.status(404).json({ error: 'Marketplace RFQ not found' })

    // 2. Get rfqs spec
    const [spec] = await db
      .select()
      .from(rfqs)
      .where(eq(rfqs.id, mRfq.rfqId))
      .limit(1)

    // 3. Get nozzles
    const nozzleRows = spec
      ? await db.select().from(nozzles).where(eq(nozzles.rfqId, spec.id))
      : []

    // 4. Get quotes joined with fabricatorProfiles
    const quoteRows = await db
      .select({
        id:                  marketplaceQuotes.id,
        shopName:            fabricatorProfiles.shopName,
        contactName:         fabricatorProfiles.contactName,
        fabricatedPrice:     marketplaceQuotes.fabricatedPrice,
        estimatedFreight:    marketplaceQuotes.estimatedFreight,
        totalDeliveredPrice: marketplaceQuotes.totalDeliveredPrice,
        leadTimeWeeks:       marketplaceQuotes.leadTimeWeeks,
        qualifications:      marketplaceQuotes.qualifications,
        status:              marketplaceQuotes.status,
        submittedAt:         marketplaceQuotes.submittedAt,
      })
      .from(marketplaceQuotes)
      .leftJoin(fabricatorProfiles, eq(fabricatorProfiles.userId, marketplaceQuotes.fabricatorId))
      .where(eq(marketplaceQuotes.marketplaceRfqId, id))

    return res.status(200).json({
      spec: spec ?? null,
      nozzles: nozzleRows,
      quotes: quoteRows,
    })
  } catch (err) {
    console.error('[admin/rfq-detail]', err)
    return res.status(500).json({ error: (err as Error).message ?? 'Internal server error' })
  }
}
