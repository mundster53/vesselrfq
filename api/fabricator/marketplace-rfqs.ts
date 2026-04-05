import type { VercelRequest, VercelResponse } from '@vercel/node'
import { and, eq, inArray, sql } from 'drizzle-orm'
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
        buyerCompany:     buyerProfiles.companyName,
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

    // ── Nozzle counts for matched RFQs ────────────────────────────────────────
    const matchedRfqIds = matched.map(r => r.rfqId)
    const nozzleCounts = await db
      .select({
        rfqId: nozzles.rfqId,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(nozzles)
      .where(inArray(nozzles.rfqId, matchedRfqIds))
      .groupBy(nozzles.rfqId)

    const nozzleCountMap = new Map(nozzleCounts.map(n => [n.rfqId, n.count]))

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
      marketplaceRfqId: r.marketplaceRfqId,
      rfqId:            r.rfqId,
      status:           r.status,
      installCity:      r.installCity,
      installState:     r.installState,
      deadlineAt:       r.deadlineAt,
      createdAt:        r.createdAt,
      title:            r.title,
      vesselType:       r.vesselType,
      shellOd:          r.shellOd,
      shellLength:      r.shellLength,
      shellMaterial:    r.shellMaterial,
      mawp:             r.mawp,
      designTemp:       r.designTemp,
      headType:         r.headType,
      supportType:      r.supportType,
      nozzleCount:      nozzleCountMap.get(r.rfqId) ?? 0,
      buyerCompany:     r.buyerCompany ?? null,
      alreadyQuoted:    quoteMap.has(r.marketplaceRfqId),
      quoteId:          quoteMap.get(r.marketplaceRfqId) ?? null,
    }))

    return res.status(200).json({ rfqs: result })
  } catch (err) {
    console.error('[fabricator/marketplace-rfqs]', err)
    return res.status(500).json({ error: (err as Error).message ?? 'Internal server error' })
  }
}
