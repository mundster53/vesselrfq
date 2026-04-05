import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, desc, inArray } from 'drizzle-orm'
import { db } from '../_lib/db.js'
import { rfqs, nozzles, users } from '../../db/schema.js'
import { requireAuth } from '../_lib/auth.js'
import { sendEmail, buyerConfirmationHtml, buyerConfirmationText, adminNotificationHtml, adminNotificationText, fabricatorNotificationHtml, fabricatorNotificationText } from '../_lib/email.js'

const ADMIN_EMAIL = process.env.NOTIFICATION_EMAIL ?? 'rfqs@vesselrfq.com'

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
        corrosionAllowance: rfqs.corrosionAllowance,
        orientation: rfqs.orientation,
        supportType: rfqs.supportType,
        saddleHeight: rfqs.saddleHeight,
        saddleWidth: rfqs.saddleWidth,
        createdAt: rfqs.createdAt,
        // Painting & surface prep
        surfacePrep:         rfqs.surfacePrep,
        primer:              rfqs.primer,
        topcoat:             rfqs.topcoat,
        finishType:          rfqs.finishType,
        // Insulation
        insulated:           rfqs.insulated,
        insulationType:      rfqs.insulationType,
        insulationThickness: rfqs.insulationThickness,
        insulationJacket:    rfqs.insulationJacket,
        insulationShell:     rfqs.insulationShell,
        insulationHeads:     rfqs.insulationHeads,
        // Coils
        internalCoil:         rfqs.internalCoil,
        internalCoilPipeSize: rfqs.internalCoilPipeSize,
        internalCoilTurns:    rfqs.internalCoilTurns,
        externalCoil:         rfqs.externalCoil,
        externalCoilType:     rfqs.externalCoilType,
        externalCoilPipeSize: rfqs.externalCoilPipeSize,
        externalCoilCoverage: rfqs.externalCoilCoverage,
      })
      .from(rfqs)
      .where(eq(rfqs.buyerId, auth.userId))
      .orderBy(desc(rfqs.createdAt))

    const rfqIds = rows.map(r => r.id)
    const allNozzles = rfqIds.length > 0
      ? await db.select().from(nozzles).where(inArray(nozzles.rfqId, rfqIds))
      : []

    const result = rows.map(r => ({
      ...r,
      nozzleCount: allNozzles.filter(n => n.rfqId === r.id).length,
      nozzles: allNozzles.filter(n => n.rfqId === r.id),
    }))

    return res.status(200).json({ rfqs: result })
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

      fabricatorId?: string
      notes?: string

      // Painting & surface prep
      surfacePrep?: string
      primer?: string
      topcoat?: string
      finishType?: string

      // Insulation
      insulated?: boolean
      insulationType?: string
      insulationThickness?: string
      insulationJacket?: string
      insulationShell?: boolean
      insulationHeads?: boolean

      // Coils
      internalCoil?: boolean
      internalCoilPipeSize?: string
      internalCoilTurns?: number
      externalCoil?: boolean
      externalCoilType?: string
      externalCoilPipeSize?: string
      externalCoilCoverage?: string

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

          fabricatorId: body.fabricatorId || null,
          notes: body.notes || null,

          // Painting & surface prep
          surfacePrep:         body.surfacePrep ?? null,
          primer:              body.primer ?? null,
          topcoat:             body.topcoat ?? null,
          finishType:          body.finishType ?? null,

          // Insulation
          insulated:           body.insulated ?? null,
          insulationType:      body.insulationType ?? null,
          insulationThickness: body.insulationThickness ?? null,
          insulationJacket:    body.insulationJacket ?? null,
          insulationShell:     body.insulationShell ?? null,
          insulationHeads:     body.insulationHeads ?? null,

          // Coils
          internalCoil:         body.internalCoil ?? null,
          internalCoilPipeSize: body.internalCoilPipeSize ?? null,
          internalCoilTurns:    body.internalCoilTurns ?? null,
          externalCoil:         body.externalCoil ?? null,
          externalCoilType:     body.externalCoilType ?? null,
          externalCoilPipeSize: body.externalCoilPipeSize ?? null,
          externalCoilCoverage: body.externalCoilCoverage ?? null,
        } as typeof rfqs.$inferInsert)
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

    // Send emails — failure must not block the submission response
    try {
      const [buyer] = await db.select({ email: users.email }).from(users).where(eq(users.id, auth.userId))
      if (buyer) {
        const nozzleCount = body.nozzles?.length ?? 0
        const emailParams = {
          rfqId:   rfq.id,
          title:   rfq.title,
          vesselType: (rfq.vesselType ?? 'tank') as 'tank' | 'heat_exchanger',
          buyerEmail: buyer.email,
          shellOd:       rfq.shellOd,
          shellLength:   rfq.shellLength,
          shellMaterial: rfq.shellMaterial,
          headType:      rfq.headType,
          mawp:          rfq.mawp,
          designTemp:    rfq.designTemp,
          corrosionAllowance: rfq.corrosionAllowance,
          supportType:   rfq.supportType,
          temaFront:     rfq.temaFront,
          temaShell:     rfq.temaShell,
          temaRear:      rfq.temaRear,
          tubeCount:     rfq.tubeCount,
          tubeOd:        rfq.tubeOd,
          tubeBwg:       rfq.tubeBwg,
          tubeLength:    rfq.tubeLength,
          shellMawp:     rfq.shellMawp,
          shellDesignTemp: rfq.shellDesignTemp,
          tubeMawp:      rfq.tubeMawp,
          tubeDesignTemp: rfq.tubeDesignTemp,
          nozzleCount,
          notes:         rfq.notes,
        }
        const emailPromises: Promise<unknown>[] = [
          sendEmail(buyer.email, `RFQ Received — ${rfq.title}`, buyerConfirmationHtml(emailParams), buyerConfirmationText(emailParams)),
          sendEmail(ADMIN_EMAIL, `New RFQ #${rfq.id} — ${rfq.title}`, adminNotificationHtml(emailParams), adminNotificationText(emailParams)),
        ]

        // Notify fabricator if this RFQ was submitted through their embed
        if (rfq.fabricatorId) {
          const [fab] = await db.select({ email: users.email }).from(users).where(eq(users.id, parseInt(rfq.fabricatorId)))
          if (fab) {
            const vesselType = (rfq.vesselType ?? 'tank') as 'tank' | 'heat_exchanger'
            const vesselLabel = vesselType === 'heat_exchanger' ? 'Heat Exchanger' : 'Pressure Vessel'
            const odPart = rfq.shellOd ? ` ${rfq.shellOd}"` : ''
            const subject = `New RFQ — ${vesselLabel}${odPart} ${rfq.title}`
            emailPromises.push(sendEmail(fab.email, subject, fabricatorNotificationHtml(emailParams), fabricatorNotificationText(emailParams)))
          }
        }

        await Promise.all(emailPromises)
      }
    } catch (emailErr) {
      console.error('[rfqs] email send failed', emailErr)
    }

    return res.status(201).json({ rfq: { id: rfq.id, title: rfq.title, status: rfq.status, vesselType: rfq.vesselType, createdAt: rfq.createdAt } })
  }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('[rfqs]', err)
    return res.status(500).json({ error: (err as Error).message ?? 'Internal server error' })
  }
}
