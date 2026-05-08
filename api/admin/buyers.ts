import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, sql, desc } from 'drizzle-orm'
import { db } from '../_lib/db.js'
import { users, buyerProfiles, rfqs } from '../../db/schema.js'
import { requireAuth } from '../_lib/auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const auth = await requireAuth(req, res)
    if (!auth) return
    if (auth.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })

    // Subquery: rfq counts per buyer
    const rfqStats = db
      .select({
        buyerId:   rfqs.buyerId,
        rfqCount:  sql<number>`cast(count(${rfqs.id}) as int)`.as('rfq_count'),
        lastRfqAt: sql<string>`max(${rfqs.createdAt})`.as('last_rfq_at'),
      })
      .from(rfqs)
      .groupBy(rfqs.buyerId)
      .as('rfq_stats')

    const rows = await db
      .select({
        id:          users.id,
        email:       users.email,
        active:      users.active,
        createdAt:   users.createdAt,
        firstName:   buyerProfiles.firstName,
        lastName:    buyerProfiles.lastName,
        companyName: buyerProfiles.companyName,
        rfqCount:    sql<number>`coalesce(${rfqStats.rfqCount}, 0)`,
        lastRfqAt:   rfqStats.lastRfqAt,
      })
      .from(users)
      .leftJoin(buyerProfiles, eq(buyerProfiles.userId, users.id))
      .leftJoin(rfqStats, eq(rfqStats.buyerId, users.id))
      .where(eq(users.role, 'buyer'))
      .orderBy(desc(users.createdAt))

    return res.status(200).json({ buyers: rows })
  } catch (err) {
    console.error('[admin/buyers]', err)
    return res.status(500).json({ error: (err as Error).message ?? 'Internal server error' })
  }
}
