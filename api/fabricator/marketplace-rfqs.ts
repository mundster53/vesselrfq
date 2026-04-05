import type { VercelRequest, VercelResponse } from '@vercel/node'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../_lib/db.js'
import {
  marketplaceRfqs, marketplaceQuotes, rfqs,
  buyerProfiles, fabricatorBidProfiles, nozzles, users,
} from '../../db/schema.js'
import { requireAuth } from '../_lib/auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

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
      .select({
        profileComplete: fabricatorBidProfiles.profileComplete,
        equipmentTypes:  fabricatorBidProfiles.equipmentTypes,
        shipToStates:    fabricatorBidProfiles.shipToStates,
      })
      .from(fabricatorBidProfiles)
      .where(eq(fabricatorBidProfiles.userId, auth.userId))
      .limit(1)

    if (!userRecord?.active || !bidProfile?.profileComplete) {
      return res.status(403).json({
        error:  'Not eligible to view marketplace RFQs',
        reason: 'complete your bid profile and ensure your subscription is active',
      })
    }

    // ── Query all open marketplace RFQs ───────────────────────────────────────
    const openRfqs = await db
      .select({
        marketplaceRfqId: marketplaceRfqs.id,
        rfqId:            marketplaceRfqs.rfqId,
        status:           marketplaceRfqs.status,
        installCity:      marketplaceRfqs.installCity,
        installState:     marketplaceRfqs.installState,
        deadlineAt:       marketplaceRfqs.deadlineAt,
        createdAt:        marketplaceRfqs.createdAt,
        title:            rfqs.title,
        vesselType:       rfqs.vesselType,
        shellOd:          rfqs.shellOd,
        shellLength:      rfqs.shellLength,
        shellMaterial:    rfqs.shellMaterial,
        mawp:             rfqs.mawp,
        designTemp:       rfqs.designTemp,
        headType:         rfqs.headType,
        supportType:      rfqs.supportType,
        corrosionAllowance: rfqs.corrosionAllowance,
        notes:            rfqs.notes,
        buyerCompany:     buyerProfiles.companyName,

        // Painting & surface prep
        surfacePrep:  rfqs.surfacePrep,
        primer:       rfqs.primer,
        topcoat:      rfqs.topcoat,
        finishType:   rfqs.finishType,

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

        // HX — TEMA
        temaFront: rfqs.temaFront,
        temaShell: rfqs.temaShell,
        temaRear:  rfqs.temaRear,

        // HX — shell configuration
        orientation:      rfqs.orientation,
        shellsInSeries:   rfqs.shellsInSeries,
        shellsInParallel: rfqs.shellsInParallel,

        // HX — tube bundle
        tubeCount:    rfqs.tubeCount,
        tubeOd:       rfqs.tubeOd,
        tubeBwg:      rfqs.tubeBwg,
        tubeLength:   rfqs.tubeLength,
        tubeMaterial: rfqs.tubeMaterial,
        tubeLayout:   rfqs.tubeLayout,
        tubePitch:    rfqs.tubePitch,
        tubeJoint:    rfqs.tubeJoint,

        // HX — baffles
        baffleType:       rfqs.baffleType,
        baffleCut:        rfqs.baffleCut,
        baffleSpacing:    rfqs.baffleSpacing,
        impingementPlate: rfqs.impingementPlate,

        // HX — shell side
        shellMawp:               rfqs.shellMawp,
        shellDesignTemp:         rfqs.shellDesignTemp,
        shellCorrosionAllowance: rfqs.shellCorrosionAllowance,
        shellFluid:              rfqs.shellFluid,

        // HX — tube side
        tubeMawp:               rfqs.tubeMawp,
        tubeDesignTemp:         rfqs.tubeDesignTemp,
        tubeCorrosionAllowance: rfqs.tubeCorrosionAllowance,
        tubeFluid:              rfqs.tubeFluid,
      })
      .from(marketplaceRfqs)
      .innerJoin(rfqs, eq(rfqs.id, marketplaceRfqs.rfqId))
      .leftJoin(buyerProfiles, eq(buyerProfiles.userId, marketplaceRfqs.buyerId))
      .where(eq(marketplaceRfqs.status, 'open'))

    // ── Filter by equipment type and ship-to state ────────────────────────────
    const matched = openRfqs.filter(r => {
      const equipmentKey = r.vesselType === 'heat_exchanger' ? 'heat_exchanger' : 'pressure_vessel'
      return (
        bidProfile.equipmentTypes.includes(equipmentKey) &&
        (bidProfile.shipToStates.length === 0 || bidProfile.shipToStates.includes(r.installState))
      )
    })

    if (matched.length === 0) return res.status(200).json({ rfqs: [] })

    // ── Nozzles for matched RFQs ──────────────────────────────────────────────
    const matchedRfqIds = matched.map(r => r.rfqId)
    const allNozzles = await db
      .select()
      .from(nozzles)
      .where(inArray(nozzles.rfqId, matchedRfqIds))

    const nozzlesByRfq = new Map<number, typeof allNozzles>()
    for (const n of allNozzles) {
      const arr = nozzlesByRfq.get(n.rfqId) ?? []
      arr.push(n)
      nozzlesByRfq.set(n.rfqId, arr)
    }

    // ── Existing quotes by this fabricator ────────────────────────────────────
    const matchedMarketplaceRfqIds = matched.map(r => r.marketplaceRfqId)
    const existingQuotes = await db
      .select({
        id:               marketplaceQuotes.id,
        marketplaceRfqId: marketplaceQuotes.marketplaceRfqId,
      })
      .from(marketplaceQuotes)
      .where(
        and(
          inArray(marketplaceQuotes.marketplaceRfqId, matchedMarketplaceRfqIds),
          eq(marketplaceQuotes.fabricatorId, auth.userId),
        )
      )

    const quoteMap = new Map(existingQuotes.map(q => [q.marketplaceRfqId, q.id]))

    // ── Build response ────────────────────────────────────────────────────────
    const result = matched.map(r => ({
      ...r,
      nozzles:       nozzlesByRfq.get(r.rfqId) ?? [],
      alreadyQuoted: quoteMap.has(r.marketplaceRfqId),
      quoteId:       quoteMap.get(r.marketplaceRfqId) ?? null,
    }))

    return res.status(200).json({ rfqs: result })
  } catch (err) {
    console.error('[fabricator/marketplace-rfqs]', err)
    return res.status(500).json({ error: (err as Error).message ?? 'Internal server error' })
  }
}
