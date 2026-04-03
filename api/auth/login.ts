import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq } from 'drizzle-orm'
import { db } from '../_lib/db.js'
import { users } from '../../db/schema.js'
import { verifyPassword, signToken } from '../_lib/auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const { email, password } = req.body as { email?: string; password?: string }

    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1)

    if (!user) return res.status(401).json({ error: 'Invalid email or password' })

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' })

    const token = await signToken({ userId: user.id, role: user.role })

    return res.status(200).json({
      token,
      user: { id: user.id, email: user.email, role: user.role, active: user.active },
    })
  } catch (err) {
    console.error('[login]', err)
    return res.status(500).json({ error: (err as Error).message ?? 'Internal server error' })
  }
}
