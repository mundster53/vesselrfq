// Required environment variables:
//   CRON_SECRET — shared secret; Vercel injects Authorization: Bearer <CRON_SECRET> on cron invocations

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, and, inArray, desc } from 'drizzle-orm'
import { db } from './_lib/db.js'
import { users, fabricatorBidProfiles, embedVerifications } from '../db/schema.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization
  const expected = `Bearer ${process.env.CRON_SECRET}`
  if (!authHeader || authHeader !== expected) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    // 1. Get all active fabricators
    const fabricators = await db
      .select({ userId: users.id })
      .from(users)
      .where(and(eq(users.role, 'fabricator'), eq(users.active, true)))

    if (fabricators.length === 0) {
      return res.status(200).json({ checked: 0, verified: 0, failed: 0, accessSuspended: 0 })
    }

    // 2. Build base URL from the incoming request
    const proto = Array.isArray(req.headers['x-forwarded-proto'])
      ? req.headers['x-forwarded-proto'][0]
      : (req.headers['x-forwarded-proto'] ?? 'https')
    const baseUrl = `${proto}://${req.headers.host}`

    // 3. Run all verify-embed calls concurrently
    const results = await Promise.allSettled(
      fabricators.map(({ userId }) =>
        fetch(`${baseUrl}/api/verify-embed`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ userId }),
        }).then(r => r.json() as Promise<{ verified: boolean }>)
      )
    )

    const checked  = results.length
    const verified = results.filter(r => r.status === 'fulfilled' && r.value.verified).length
    const failed   = checked - verified

    // 4. Find fabricators whose most recent verification failed
    const userIds = fabricators.map(f => f.userId)
    const allChecks = await db
      .select({
        userId:   embedVerifications.userId,
        verified: embedVerifications.verified,
      })
      .from(embedVerifications)
      .where(inArray(embedVerifications.userId, userIds))
      .orderBy(desc(embedVerifications.checkedAt))

    // Results are checkedAt DESC — first hit per userId is the latest check
    const latestByUser = new Map<number, boolean>()
    for (const row of allChecks) {
      if (!latestByUser.has(row.userId)) {
        latestByUser.set(row.userId, row.verified ?? false)
      }
    }

    const failedUserIds = [...latestByUser.entries()]
      .filter(([, v]) => !v)
      .map(([id]) => id)

    // 5. Suspend marketplace access for any fabricator whose latest check failed
    let accessSuspended = 0
    if (failedUserIds.length > 0) {
      const suspended = await db
        .update(fabricatorBidProfiles)
        .set({ profileComplete: false })
        .where(
          and(
            inArray(fabricatorBidProfiles.userId, failedUserIds),
            eq(fabricatorBidProfiles.profileComplete, true)
          )
        )
        .returning({ userId: fabricatorBidProfiles.userId })
      accessSuspended = suspended.length
    }

    return res.status(200).json({ checked, verified, failed, accessSuspended })
  } catch (err) {
    console.error('[cron-verify-embeds]', err)
    return res.status(500).json({ error: (err as Error).message ?? 'Internal server error' })
  }
}
