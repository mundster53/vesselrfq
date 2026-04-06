import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq } from 'drizzle-orm'
import { db } from '../_lib/db.js'
import { rfqs, nozzles } from '../../db/schema.js'
import { requireAuth } from '../_lib/auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const auth = await requireAuth(req, res)
    if (!auth) return
    if (auth.role !== 'buyer') return res.status(403).json({ error: 'Buyer access required' })

    const { rfqId } = req.body as { rfqId: unknown }
    if (typeof rfqId !== 'number') {
      return res.status(400).json({ error: 'rfqId is required' })
    }

    // ── Verify RFQ exists and belongs to this buyer ───────────────────────────
    const [original] = await db
      .select()
      .from(rfqs)
      .where(eq(rfqs.id, rfqId))
      .limit(1)

    if (!original || original.buyerId !== auth.userId) {
      return res.status(404).json({ error: 'RFQ not found' })
    }

    const now = new Date()

    // ── Transaction: copy rfq + nozzles ───────────────────────────────────────
    const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = original

    const newRfq = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(rfqs)
        .values({
          ...rest,
          title:        `${original.title} (Copy)`,
          status:       'draft',
          buyerId:      auth.userId,
          fabricatorId: null,
          createdAt:    now,
          updatedAt:    now,
        })
        .returning({ id: rfqs.id, title: rfqs.title })

      const originalNozzles = await tx
        .select()
        .from(nozzles)
        .where(eq(nozzles.rfqId, rfqId))

      if (originalNozzles.length > 0) {
        await tx.insert(nozzles).values(
          originalNozzles.map(({ id: _nid, rfqId: _nrfqId, ...nozzleRest }) => ({
            ...nozzleRest,
            rfqId: inserted.id,
          }))
        )
      }

      return inserted
    })

    return res.status(200).json({ rfqId: newRfq.id, title: newRfq.title })
  } catch (err) {
    console.error('[rfqs/copy]', err)
    return res.status(500).json({ error: (err as Error).message ?? 'Internal server error' })
  }
}
