import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, desc, sql } from 'drizzle-orm'
import { db } from '../_lib/db'
import { rfqs, nozzles } from '../../db/schema'
import { requireAuth } from '../_lib/auth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
  const auth = await requireAuth(req, res)
  if (!auth) return

  // ─── GET — list buyer's RFQs ────────────────────────────────────────────────
  if (req.method === 'GET') {
    const rows = await db
      .select({
        id: rfqs.id,
        title: rfqs.title,
        status: rfqs.status,
        shellOd: rfqs.shellOd,
        shellLength: rfqs.shellLength,
        shellMaterial: rfqs.shellMaterial,
        headType: rfqs.headType,
        mawp: rfqs.mawp,
        designTemp: rfqs.designTemp,
        createdAt: rfqs.createdAt,
        nozzleCount: sql<number>`(select count(*) from nozzles where nozzles.rfq_id = ${rfqs.id})::int`,
      })
      .from(rfqs)
      .where(eq(rfqs.buyerId, auth.userId))
      .orderBy(desc(rfqs.createdAt))

    return res.status(200).json({ rfqs: rows })
  }

  // ─── POST — create RFQ ──────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = req.body as {
      title?: string
      shellOd?: string
      shellLength?: string
      shellMaterial?: string
      headType?: string
      mawp?: string
      designTemp?: string
      corrosionAllowance?: string
      supportType?: string
      saddleHeight?: string
      saddleWidth?: string
      notes?: string
      nozzles?: Array<{
        mark: string
        size: string
        rating: string
        flangeType: string
        facing: string
        material: string
        service?: string
        quantity: number
        location: string
      }>
    }

    if (!body.title?.trim()) return res.status(400).json({ error: 'RFQ title is required' })

    const rfq = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(rfqs)
        .values({
          buyerId: auth.userId,
          title: body.title!.trim(),
          status: 'submitted',
          shellOd: body.shellOd || null,
          shellLength: body.shellLength || null,
          shellMaterial: body.shellMaterial || null,
          headType: body.headType || null,
          mawp: body.mawp || null,
          designTemp: body.designTemp ? parseInt(body.designTemp) : null,
          corrosionAllowance: body.corrosionAllowance || null,
          supportType: body.supportType || null,
          saddleHeight: body.saddleHeight || null,
          saddleWidth: body.saddleWidth || null,
          notes: body.notes || null,
        })
        .returning()

      if (body.nozzles?.length) {
        await tx.insert(nozzles).values(
          body.nozzles.map((n) => ({
            rfqId: created.id,
            mark: n.mark,
            size: n.size,
            rating: n.rating,
            flangeType: n.flangeType,
            facing: n.facing,
            material: n.material,
            service: n.service ?? null,
            quantity: n.quantity,
            location: n.location as 'shell' | 'left_head' | 'right_head',
          })),
        )
      }

      return created
    })

    return res.status(201).json({ rfq: { id: rfq.id, title: rfq.title, status: rfq.status, createdAt: rfq.createdAt } })
  }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('[rfqs]', err)
    return res.status(500).json({ error: (err as Error).message ?? 'Internal server error' })
  }
}
