import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq } from 'drizzle-orm'
import { db } from '../_lib/db.js'
import { users } from '../../db/schema.js'
import { hashPassword, signToken } from '../_lib/auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const { email, password } = req.body as { email?: string; password?: string }

    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email address' })

    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase())).limit(1)
    if (existing.length) return res.status(409).json({ error: 'An account with that email already exists' })

    const passwordHash = await hashPassword(password)
    const [user] = await db
      .insert(users)
      .values({ email: email.toLowerCase(), passwordHash, role: 'buyer' })
      .returning({ id: users.id, email: users.email, role: users.role })

    const token = await signToken({ userId: user.id, role: user.role })

    return res.status(201).json({ token, user })
  } catch (err) {
    console.error('[register]', err)
    return res.status(500).json({ error: (err as Error).message ?? 'Internal server error' })
  }
}
