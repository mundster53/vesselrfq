import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, desc, inArray } from 'drizzle-orm'
import { db } from '../_lib/db.js'
import { rfqs, nozzles, users } from '../../db/schema.js'
import { requireAuth } from '../_lib/auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const auth = await requireAuth(req, res)
    if (!auth) return

    if (auth.role !== 'fabricator') {
      return res.status(403).json({ error: 'Fabricator access required' })
    }

    const [fabricator] = await db
      .select({ active: users.active })
      .from(users)
      .where(eq(users.id, auth.userId))
      .limit(1)

    if (!fabricator?.active) {
      return res.status(403).json({ error: 'Account inactive. Please check your subscription.' })
    }

    const rows = await db
      .select({
        id: rfqs.id,
        title: rfqs.title,
        status: rfqs.status,
        vesselType: rfqs.vesselType,
        shellOd: rfqs.shellOd,
        shellLength: rfqs.shellLength,
        shellMaterial: rfqs.shellMaterial,
        headType: rfqs.headType,
        mawp: rfqs.mawp,
        designTemp: rfqs.designTemp,
        corrosionAllowance: rfqs.corrosionAllowance,
        orientation: rfqs.orientation,
        supportType: rfqs.supportType,
        createdAt: rfqs.createdAt,
        buyerEmail: users.email,
      })
      .from(rfqs)
      .innerJoin(users, eq(rfqs.buyerId, users.id))
      .where(eq(rfqs.status, 'submitted'))
      .orderBy(desc(rfqs.createdAt))

    const rfqIds = rows.map(r => r.id)
    const allNozzles = rfqIds.length > 0
      ? await db.select().from(nozzles).where(inArray(nozzles.rfqId, rfqIds))
      : []

    const result = rows.map(r => ({
      ...r,
      nozzles: allNozzles.filter(n => n.rfqId === r.id),
    }))

    return res.status(200).json({ rfqs: result })
  } catch (err) {
    console.error('[rfqs/all]', err)
    return res.status(500).json({ error: (err as Error).message ?? 'Internal server error' })
  }
}
