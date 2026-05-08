import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, sql } from 'drizzle-orm'
import { db } from '../_lib/db.js'
import {
  users,
  rfqs,
  marketplaceRfqs,
  marketplaceQuotes,
  fabricatorBidProfiles,
} from '../../db/schema.js'
import { requireAuth } from '../_lib/auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const auth = await requireAuth(req, res)
    if (!auth) return
    if (auth.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })

    // Platform stats
    const [rfqCountRow] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(marketplaceRfqs)

    const [quoteCountRow] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(marketplaceQuotes)

    const totalRfqs   = rfqCountRow?.count ?? 0
    const totalQuotes = quoteCountRow?.count ?? 0
    const avgQuotesPerRfq   = totalRfqs > 0 ? totalQuotes / totalRfqs : 0
    const quoteResponseRate = totalRfqs > 0 ? (totalRfqs > 0 ? (totalQuotes > 0 ? Math.min(totalQuotes / totalRfqs / 3, 1) : 0) : 0) : 0

    // Fabricator stats
    const [fabTotalRow] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(users)
      .where(eq(users.role, 'fabricator'))

    const [fabActiveRow] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(users)
      .where(eq(users.role, 'fabricator') && sql`${users.active} = true`)

    // Active subscriptions = active fabricators
    const [activeSubsRow] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(users)
      .where(sql`${users.role} = 'fabricator' AND ${users.active} = true`)

    // Embed verified: most recent embed_verification per user where verified = true
    const embedVerifiedResult = await db.execute(sql`
      SELECT cast(count(*) as int) as count
      FROM (
        SELECT DISTINCT ON (user_id) user_id, verified
        FROM embed_verifications
        ORDER BY user_id, checked_at DESC
      ) latest
      WHERE latest.verified = true
    `)
    const embedVerified = Number((embedVerifiedResult.rows?.[0] as { count: string | number } | undefined)?.count ?? 0)

    // Marketplace eligible: active=true AND profile_complete=true AND latest embed verified=true
    const marketplaceEligibleResult = await db.execute(sql`
      SELECT cast(count(*) as int) as count
      FROM users u
      INNER JOIN fabricator_bid_profiles fbp ON fbp.user_id = u.id
      INNER JOIN (
        SELECT DISTINCT ON (user_id) user_id, verified
        FROM embed_verifications
        ORDER BY user_id, checked_at DESC
      ) latest_embed ON latest_embed.user_id = u.id
      WHERE u.role = 'fabricator'
        AND u.active = true
        AND fbp.profile_complete = true
        AND latest_embed.verified = true
    `)
    const marketplaceEligible = Number((marketplaceEligibleResult.rows?.[0] as { count: string | number } | undefined)?.count ?? 0)

    // Buyer stats
    const [buyerTotalRow] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(users)
      .where(eq(users.role, 'buyer'))

    const [buyerRfqRow] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(rfqs)

    const totalBuyers  = buyerTotalRow?.count ?? 0
    const totalBuyerRfqs = buyerRfqRow?.count ?? 0
    const avgRfqsPerBuyer = totalBuyers > 0 ? totalBuyerRfqs / totalBuyers : 0

    return res.status(200).json({
      platform: {
        totalRfqs,
        totalQuotes,
        avgQuotesPerRfq,
        quoteResponseRate,
      },
      fabricators: {
        total:                fabTotalRow?.count ?? 0,
        activeSubscriptions:  activeSubsRow?.count ?? 0,
        embedVerified,
        marketplaceEligible,
      },
      buyers: {
        total:        totalBuyers,
        totalRfqs:    totalBuyerRfqs,
        avgRfqsPerBuyer,
      },
    })
  } catch (err) {
    console.error('[admin/analytics]', err)
    return res.status(500).json({ error: (err as Error).message ?? 'Internal server error' })
  }
}
