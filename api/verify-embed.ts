import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq } from 'drizzle-orm'
import { db } from './_lib/db.js'
import { fabricatorProfiles, embedVerifications } from '../db/schema.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { userId } = req.body as { userId: number }
    if (!userId) return res.status(400).json({ error: 'userId is required' })

    const checkedAt = new Date()

    // Look up the fabricator's website
    const [profile] = await db
      .select({ website: fabricatorProfiles.website })
      .from(fabricatorProfiles)
      .where(eq(fabricatorProfiles.userId, userId))
      .limit(1)

    if (!profile?.website) {
      await db.insert(embedVerifications).values({
        userId,
        embedUrl:      '',
        verified:      false,
        checkedAt,
        failureReason: 'No website on file',
      })
      return res.status(200).json({
        verified:   false,
        reason:     'No website on file',
        checkedUrl: '',
        checkedAt:  checkedAt.toISOString(),
      })
    }

    const checkedUrl = profile.website

    // Fetch the website with a 10-second timeout
    let verified = false
    let failureReason: string | null = null

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 10_000)

      let body: string
      try {
        const response = await fetch(checkedUrl, { signal: controller.signal })
        body = await response.text()
      } finally {
        clearTimeout(timer)
      }

      if (/vesselrfq/i.test(body)) {
        verified = true
      } else {
        failureReason = 'Embed code not detected on website'
      }
    } catch {
      failureReason = 'Website unreachable'
    }

    await db.insert(embedVerifications).values({
      userId,
      embedUrl:      checkedUrl,
      verified,
      checkedAt,
      failureReason,
    })

    return res.status(200).json({
      verified,
      ...(failureReason ? { reason: failureReason } : {}),
      checkedUrl,
      checkedAt: checkedAt.toISOString(),
    })
  } catch (err) {
    console.error('[verify-embed]', err)
    return res.status(500).json({ error: (err as Error).message ?? 'Internal server error' })
  }
}
