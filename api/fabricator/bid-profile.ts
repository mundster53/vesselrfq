import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq } from 'drizzle-orm'
import { db } from '../_lib/db.js'
import { fabricatorBidProfiles } from '../../db/schema.js'
import { requireAuth } from '../_lib/auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const auth = await requireAuth(req, res)
    if (!auth) return

    if (auth.role !== 'fabricator') {
      return res.status(403).json({ error: 'Fabricator access required' })
    }

    // ── GET — load existing bid profile ──────────────────────────────────────
    if (req.method === 'GET') {
      const [row] = await db
        .select()
        .from(fabricatorBidProfiles)
        .where(eq(fabricatorBidProfiles.userId, auth.userId))
        .limit(1)

      if (!row) return res.status(200).json({ exists: false })

      return res.status(200).json({ exists: true, ...row })
    }

    // ── POST — save bid profile ───────────────────────────────────────────────
    if (req.method === 'POST') {
      const body = req.body as {
        equipmentTypes:    string[]
        materials:         string[]
        maxDiameterInches: number | null
        maxLengthInches:   number | null
        maxWeightLbs:      number | null
        shipToStates:      string[]
        acceptingWork:     boolean
      }

      if (!Array.isArray(body.equipmentTypes) || body.equipmentTypes.length === 0) {
        return res.status(400).json({ error: 'At least one equipment type is required' })
      }
      if (!Array.isArray(body.materials) || body.materials.length === 0) {
        return res.status(400).json({ error: 'At least one material is required' })
      }

      const profileComplete = body.equipmentTypes.length > 0 && body.materials.length > 0
      const now = new Date()

      const values = {
        userId:            auth.userId,
        equipmentTypes:    body.equipmentTypes,
        materials:         body.materials,
        maxDiameterInches: body.maxDiameterInches?.toString() ?? null,
        maxLengthInches:   body.maxLengthInches?.toString()   ?? null,
        maxWeightLbs:      body.maxWeightLbs?.toString()       ?? null,
        shipToStates:      Array.isArray(body.shipToStates) ? body.shipToStates : [],
        acceptingWork:     body.acceptingWork ?? true,
        profileComplete,
        updatedAt:         now,
      }

      const [saved] = await db
        .insert(fabricatorBidProfiles)
        .values({ ...values, createdAt: now } as typeof fabricatorBidProfiles.$inferInsert)
        .onConflictDoUpdate({
          target: fabricatorBidProfiles.userId,
          set:    values as Partial<typeof fabricatorBidProfiles.$inferInsert>,
        })
        .returning()

      return res.status(200).json({ exists: true, ...saved })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('[fabricator/bid-profile]', err)
    return res.status(500).json({ error: (err as Error).message ?? 'Internal server error' })
  }
}
