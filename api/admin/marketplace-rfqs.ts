import type { VercelRequest, VercelResponse } from '@vercel/node'
import { desc, eq, sql } from 'drizzle-orm'
import { db } from '../_lib/db.js'
import { marketplaceRfqs, marketplaceQuotes, rfqs, users } from '../../db/schema.js'
import { requireAuth } from '../_lib/auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const auth = await requireAuth(req, res)
    if (!auth) return
    if (auth.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })

    const rows = await db
      .select({
        id:           marketplaceRfqs.id,
        rfqId:        marketplaceRfqs.rfqId,
        status:       marketplaceRfqs.status,
        installCity:  marketplaceRfqs.installCity,
        installState: marketplaceRfqs.installState,
        deadlineAt:   marketplaceRfqs.deadlineAt,
        createdAt:    marketplaceRfqs.createdAt,
        rfqTitle:     rfqs.title,
        vesselType:   rfqs.vesselType,
        shellOd:      rfqs.shellOd,
        buyerEmail:   users.email,
        quoteCount:   sql<number>`cast(count(${marketplaceQuotes.id}) as int)`,
      })
      .from(marketplaceRfqs)
      .innerJoin(rfqs,  eq(rfqs.id,  marketplaceRfqs.rfqId))
      .innerJoin(users, eq(users.id, marketplaceRfqs.buyerId))
      .leftJoin(marketplaceQuotes, eq(marketplaceQuotes.marketplaceRfqId, marketplaceRfqs.id))
      .groupBy(marketplaceRfqs.id, rfqs.id, users.id)
      .orderBy(desc(marketplaceRfqs.createdAt))

    return res.status(200).json({ rfqs: rows })
  } catch (err) {
    console.error('[admin/marketplace-rfqs]', err)
    return res.status(500).json({ error: (err as Error).message ?? 'Internal server error' })
  }
}
