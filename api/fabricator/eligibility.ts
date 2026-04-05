import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, desc } from 'drizzle-orm'
import { db } from '../_lib/db.js'
import { users, embedVerifications, fabricatorBidProfiles } from '../../db/schema.js'
import { requireAuth } from '../_lib/auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const auth = await requireAuth(req, res)
    if (!auth) return

    if (auth.role !== 'fabricator') {
      return res.status(403).json({ error: 'Fabricator access required' })
    }

    const [userRow, latestCheck, bidProfile] = await Promise.all([
      db
        .select({ active: users.active })
        .from(users)
        .where(eq(users.id, auth.userId))
        .limit(1),

      db
        .select({ verified: embedVerifications.verified, checkedAt: embedVerifications.checkedAt })
        .from(embedVerifications)
        .where(eq(embedVerifications.userId, auth.userId))
        .orderBy(desc(embedVerifications.checkedAt))
        .limit(1),

      db
        .select({ profileComplete: fabricatorBidProfiles.profileComplete })
        .from(fabricatorBidProfiles)
        .where(eq(fabricatorBidProfiles.userId, auth.userId))
        .limit(1),
    ])

    const subscriptionActive = userRow[0]?.active === true

    const latestEmbedRow = latestCheck[0] ?? null
    const thirtyDaysAgo  = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const embedVerified  = !!(
      latestEmbedRow?.verified === true &&
      latestEmbedRow.checkedAt >= thirtyDaysAgo
    )
    const lastEmbedCheck = latestEmbedRow?.checkedAt
      ? latestEmbedRow.checkedAt.toISOString()
      : null

    const bidProfileComplete = bidProfile[0]?.profileComplete === true

    return res.status(200).json({
      subscriptionActive,
      embedVerified,
      bidProfileComplete,
      lastEmbedCheck,
    })
  } catch (err) {
    console.error('[fabricator/eligibility]', err)
    return res.status(500).json({ error: (err as Error).message ?? 'Internal server error' })
  }
}
