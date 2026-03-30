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
        vesselType: rfqs.vesselType,
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
      vesselType?: string
      title?: string

      // Tank fields
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

      // HX fields
      orientation?: string
      temaFront?: string
      temaShell?: string
      temaRear?: string
      shellsInSeries?: string
      shellsInParallel?: string
      tubeCount?: string
      tubeOd?: string
      tubeBwg?: string
      tubeLength?: string
      tubeMaterial?: string
      tubeLayout?: string
      tubePitch?: string
      tubeJoint?: string
      baffleType?: string
      baffleCut?: string
      baffleSpacing?: string
      impingementPlate?: string
      shellMawp?: string
      shellDesignTemp?: string
      shellCorrosionAllowance?: string
      shellFluid?: string
      tubeMawp?: string
      tubeDesignTemp?: string
      tubeCorrosionAllowance?: string
      tubeFluid?: string

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
          buyerId:   auth.userId,
          title:     body.title!.trim(),
          status:    'submitted',
          vesselType: body.vesselType || 'tank',

          // Shell (shared)
          shellOd:       body.shellOd || null,
          shellLength:   body.shellLength || null,
          shellMaterial: body.shellMaterial || null,

          // Tank
          headType:          body.headType || null,
          mawp:              body.mawp || null,
          designTemp:        body.designTemp ? parseInt(body.designTemp) : null,
          corrosionAllowance: body.corrosionAllowance || null,
          supportType:       body.supportType || null,
          saddleHeight:      body.saddleHeight || null,
          saddleWidth:       body.saddleWidth || null,

          // HX
          orientation:      body.orientation || null,
          temaFront:        body.temaFront || null,
          temaShell:        body.temaShell || null,
          temaRear:         body.temaRear || null,
          shellsInSeries:   body.shellsInSeries ? parseInt(body.shellsInSeries) : null,
          shellsInParallel: body.shellsInParallel ? parseInt(body.shellsInParallel) : null,
          tubeCount:        body.tubeCount ? parseInt(body.tubeCount) : null,
          tubeOd:           body.tubeOd || null,
          tubeBwg:          body.tubeBwg || null,
          tubeLength:       body.tubeLength || null,
          tubeMaterial:     body.tubeMaterial || null,
          tubeLayout:       body.tubeLayout || null,
          tubePitch:        body.tubePitch || null,
          tubeJoint:        body.tubeJoint || null,
          baffleType:       body.baffleType || null,
          baffleCut:        body.baffleCut || null,
          baffleSpacing:    body.baffleSpacing || null,
          impingementPlate: body.impingementPlate || null,
          shellMawp:        body.shellMawp || null,
          shellDesignTemp:  body.shellDesignTemp ? parseInt(body.shellDesignTemp) : null,
          shellCorrosionAllowance: body.shellCorrosionAllowance || null,
          shellFluid:       body.shellFluid || null,
          tubeMawp:         body.tubeMawp || null,
          tubeDesignTemp:   body.tubeDesignTemp ? parseInt(body.tubeDesignTemp) : null,
          tubeCorrosionAllowance: body.tubeCorrosionAllowance || null,
          tubeFluid:        body.tubeFluid || null,

          notes: body.notes || null,
        })
        .returning()

      if (body.nozzles?.length) {
        await tx.insert(nozzles).values(
          body.nozzles.map((n) => ({
            rfqId:     created.id,
            mark:      n.mark,
            size:      n.size,
            rating:    n.rating,
            flangeType: n.flangeType,
            facing:    n.facing,
            material:  n.material,
            service:   n.service ?? null,
            quantity:  n.quantity,
            location:  n.location as 'shell' | 'left_head' | 'right_head',
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
