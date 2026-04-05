import type { VercelRequest, VercelResponse } from '@vercel/node'
import { desc } from 'drizzle-orm'
import { db } from '../_lib/db.js'
import { users } from '../../db/schema.js'
import { requireAuth } from '../_lib/auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const auth = await requireAuth(req, res)
    if (!auth) return
    if (auth.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })

    const rows = await db
      .select({
        id:               users.id,
        email:            users.email,
        role:             users.role,
        active:           users.active,
        createdAt:        users.createdAt,
        stripeCustomerId: users.stripeCustomerId,
      })
      .from(users)
      .orderBy(desc(users.createdAt))

    return res.status(200).json({ users: rows })
  } catch (err) {
    console.error('[admin/users]', err)
    return res.status(500).json({ error: (err as Error).message ?? 'Internal server error' })
  }
}
