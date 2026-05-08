import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, desc } from 'drizzle-orm'
import { db } from '../_lib/db.js'
import {
  marketplaceNotifications,
  marketplaceRfqs,
  rfqs,
  fabricatorProfiles,
  users,
} from '../../db/schema.js'
import { requireAuth } from '../_lib/auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const auth = await requireAuth(req, res)
    if (!auth) return
    if (auth.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })

    const rows = await db
      .select({
        id:               marketplaceNotifications.id,
        shopName:         fabricatorProfiles.shopName,
        fabricatorEmail:  marketplaceNotifications.emailSentTo,
        rfqTitle:         rfqs.title,
        marketplaceRfqId: marketplaceNotifications.marketplaceRfqId,
        notificationType: marketplaceNotifications.notificationType,
        sentAt:           marketplaceNotifications.sentAt,
      })
      .from(marketplaceNotifications)
      .innerJoin(marketplaceRfqs, eq(marketplaceRfqs.id, marketplaceNotifications.marketplaceRfqId))
      .innerJoin(rfqs, eq(rfqs.id, marketplaceRfqs.rfqId))
      .leftJoin(fabricatorProfiles, eq(fabricatorProfiles.userId, marketplaceNotifications.fabricatorId))
      .orderBy(desc(marketplaceNotifications.sentAt))

    return res.status(200).json({ notifications: rows })
  } catch (err) {
    console.error('[admin/notification-log]', err)
    return res.status(500).json({ error: (err as Error).message ?? 'Internal server error' })
  }
}
