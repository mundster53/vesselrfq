import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq } from 'drizzle-orm'
import { db } from '../_lib/db.js'
import { fabricatorProfiles } from '../../db/schema.js'
import { requireAuth } from '../_lib/auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await requireAuth(req, res)
  if (!auth) return

  if (req.method === 'GET') {
    const [profile] = await db
      .select()
      .from(fabricatorProfiles)
      .where(eq(fabricatorProfiles.userId, auth.userId))
      .limit(1)

    if (!profile) {
      return res.status(200).json({ exists: false })
    }

    return res.status(200).json({
      exists: true,
      profile: {
        shopName:    profile.shopName,
        city:        profile.city,
        state:       profile.state,
        stamps:      profile.stamps,
        contactName: profile.contactName,
        phone:       profile.phone,
        website:     profile.website,
      },
    })
  }

  if (req.method === 'POST') {
    const { shopName, city, state, stamps, contactName, phone, website } = req.body as {
      shopName:    string
      city:        string
      state:       string
      stamps:      string[]
      contactName: string
      phone:       string
      website:     string | null
    }

    if (!shopName || !city || !state || !Array.isArray(stamps) || stamps.length === 0 || !contactName || !phone) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    await db
      .insert(fabricatorProfiles)
      .values({
        userId:      auth.userId,
        shopName:    shopName.trim(),
        city:        city.trim(),
        state:       state.trim(),
        stamps,
        contactName: contactName.trim(),
        phone:       phone.trim(),
        website:     website?.trim() || null,
      })
      .onConflictDoUpdate({
        target: fabricatorProfiles.userId,
        set: {
          shopName:    shopName.trim(),
          city:        city.trim(),
          state:       state.trim(),
          stamps,
          contactName: contactName.trim(),
          phone:       phone.trim(),
          website:     website?.trim() || null,
        },
      })

    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
