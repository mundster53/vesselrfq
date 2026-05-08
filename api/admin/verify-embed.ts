import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from '../_lib/db.js'
import { embedVerifications } from '../../db/schema.js'
import { requireAuth } from '../_lib/auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const auth = await requireAuth(req, res)
    if (!auth) return
    if (auth.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })

    const { userId } = req.body as { userId?: number }

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }

    await db.insert(embedVerifications).values({
      userId,
      embedUrl:  `https://vesselrfq.com/app/embed?shop=${userId}`,
      verified:  true,
    })

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[admin/verify-embed]', err)
    return res.status(500).json({ error: (err as Error).message ?? 'Internal server error' })
  }
}
