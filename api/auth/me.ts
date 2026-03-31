import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq } from 'drizzle-orm'
import { db } from '../_lib/db.js'
import { users } from '../../db/schema.js'
import { requireAuth } from '../_lib/auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

    const auth = await requireAuth(req, res)
    if (!auth) return

    const [user] = await db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(eq(users.id, auth.userId))
      .limit(1)

    if (!user) return res.status(404).json({ error: 'User not found' })

    return res.status(200).json({ user })
  } catch (err) {
    console.error('[me]', err)
    return res.status(500).json({ error: (err as Error).message ?? 'Internal server error' })
  }
}
