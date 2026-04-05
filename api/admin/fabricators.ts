import type { VercelRequest, VercelResponse } from '@vercel/node'
import { asc, desc, eq } from 'drizzle-orm'
import { db } from '../_lib/db.js'
import {
  users,
  fabricatorProfiles,
  fabricatorBidProfiles,
  embedVerifications,
} from '../../db/schema.js'
import { requireAuth } from '../_lib/auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const auth = await requireAuth(req, res)
    if (!auth) return
    if (auth.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })

    // Most recent embed verification per fabricator (PostgreSQL DISTINCT ON)
    const latestEmbed = db
      .selectDistinctOn([embedVerifications.userId], {
        userId:    embedVerifications.userId,
        checkedAt: embedVerifications.checkedAt,
        verified:  embedVerifications.verified,
      })
      .from(embedVerifications)
      .orderBy(embedVerifications.userId, desc(embedVerifications.checkedAt))
      .as('latest_embed')

    const rows = await db
      .select({
        id:               users.id,
        email:            users.email,
        active:           users.active,
        shopName:         fabricatorProfiles.shopName,
        city:             fabricatorProfiles.city,
        state:            fabricatorProfiles.state,
        stamps:           fabricatorProfiles.stamps,
        website:          fabricatorProfiles.website,
        profileComplete:  fabricatorBidProfiles.profileComplete,
        acceptingWork:    fabricatorBidProfiles.acceptingWork,
        equipmentTypes:   fabricatorBidProfiles.equipmentTypes,
        materials:        fabricatorBidProfiles.materials,
        shipToStates:     fabricatorBidProfiles.shipToStates,
        lastEmbedCheck:   latestEmbed.checkedAt,
        lastEmbedVerified: latestEmbed.verified,
      })
      .from(fabricatorProfiles)
      .innerJoin(users, eq(users.id, fabricatorProfiles.userId))
      .leftJoin(fabricatorBidProfiles, eq(fabricatorBidProfiles.userId, fabricatorProfiles.userId))
      .leftJoin(latestEmbed, eq(latestEmbed.userId, fabricatorProfiles.userId))
      .orderBy(asc(fabricatorProfiles.shopName))

    const result = rows.map(r => ({
      ...r,
      bidProfileExists: r.profileComplete !== null,
    }))

    return res.status(200).json({ fabricators: result })
  } catch (err) {
    console.error('[admin/fabricators]', err)
    return res.status(500).json({ error: (err as Error).message ?? 'Internal server error' })
  }
}
