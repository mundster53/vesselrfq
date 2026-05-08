import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq } from 'drizzle-orm'
import { db } from '../_lib/db.js'
import { users } from '../../db/schema.js'
import { requireAuth } from '../_lib/auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const auth = await requireAuth(req, res)
    if (!auth) return
    if (auth.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })

    const { userId, active } = req.body as { userId?: number; active?: boolean }

    if (userId === undefined || active === undefined) {
      return res.status(400).json({ error: 'userId and active are required' })
    }

    await db
      .update(users)
      .set({ active })
      .where(eq(users.id, userId))

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[admin/toggle-user-active]', err)
    return res.status(500).json({ error: (err as Error).message ?? 'Internal server error' })
  }
}
