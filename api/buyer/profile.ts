import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq } from 'drizzle-orm'
import { db } from '../_lib/db.js'
import { buyerProfiles } from '../../db/schema.js'
import { requireAuth } from '../_lib/auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await requireAuth(req, res)
  if (!auth) return

  if (req.method === 'GET') {
    const [profile] = await db
      .select()
      .from(buyerProfiles)
      .where(eq(buyerProfiles.userId, auth.userId))
      .limit(1)

    if (!profile) {
      return res.status(200).json({ exists: false })
    }

    return res.status(200).json({
      exists: true,
      profile: {
        firstName:   profile.firstName,
        lastName:    profile.lastName,
        email:       profile.email,
        companyName: profile.companyName,
        jobTitle:    profile.jobTitle,
        phone:       profile.phone,
        city:        profile.city,
        state:       profile.state,
      },
    })
  }

  if (req.method === 'POST') {
    const { firstName, lastName, email, companyName, jobTitle, phone, city, state } = req.body as {
      firstName:   string
      lastName:    string
      email:       string
      companyName: string
      jobTitle:    string
      phone:       string
      city:        string
      state:       string
    }

    if (!firstName || !lastName || !email || !companyName || !jobTitle || !phone || !city || !state) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    await db
      .insert(buyerProfiles)
      .values({
        userId:      auth.userId,
        firstName:   firstName.trim(),
        lastName:    lastName.trim(),
        email:       email.trim().toLowerCase(),
        companyName: companyName.trim(),
        jobTitle:    jobTitle.trim(),
        phone:       phone.trim(),
        city:        city.trim(),
        state:       state.trim(),
      })
      .onConflictDoUpdate({
        target: buyerProfiles.userId,
        set: {
          firstName:   firstName.trim(),
          lastName:    lastName.trim(),
          email:       email.trim().toLowerCase(),
          companyName: companyName.trim(),
          jobTitle:    jobTitle.trim(),
          phone:       phone.trim(),
          city:        city.trim(),
          state:       state.trim(),
        },
      })

    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
