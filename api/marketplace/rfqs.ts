import type { VercelRequest, VercelResponse } from '@vercel/node'
import { and, eq } from 'drizzle-orm'
import { db } from '../_lib/db.js'
import {
  rfqs,
  fabricatorBidProfiles,
  fabricatorProfiles,
  users,
  marketplaceRfqs,
  marketplaceNotifications,
} from '../../db/schema.js'
import { requireAuth } from '../_lib/auth.js'
import { sendEmail } from '../_lib/email.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const auth = await requireAuth(req, res)
    if (!auth) return

    const { rfqId, installCity, installState, deadlineDays } = req.body as {
      rfqId:        number
      installCity:  string
      installState: string
      deadlineDays: number
    }

    // ── Validate ─────────────────────────────────────────────────────────────
    if (!rfqId)               return res.status(400).json({ error: 'rfqId is required' })
    if (!installCity?.trim()) return res.status(400).json({ error: 'installCity is required' })
    if (!installState?.trim()) return res.status(400).json({ error: 'installState is required' })
    if (![7, 14, 21, 30].includes(deadlineDays)) {
      return res.status(400).json({ error: 'deadlineDays must be 7, 14, 21, or 30' })
    }

    const normalizedState = installState.trim().toUpperCase()

    // ── Verify RFQ belongs to this buyer ──────────────────────────────────────
    const [rfq] = await db
      .select()
      .from(rfqs)
      .where(and(eq(rfqs.id, rfqId), eq(rfqs.buyerId, auth.userId)))
      .limit(1)

    if (!rfq) return res.status(404).json({ error: 'RFQ not found' })

    // ── Insert marketplace RFQ ────────────────────────────────────────────────
    const deadlineAt = new Date()
    deadlineAt.setDate(deadlineAt.getDate() + deadlineDays)

    const [marketplaceRfq] = await db
      .insert(marketplaceRfqs)
      .values({
        buyerId:      auth.userId,
        rfqId,
        status:       'open',
        installCity:  installCity.trim(),
        installState: normalizedState,
        deadlineAt,
      } as typeof marketplaceRfqs.$inferInsert)
      .returning()

    // ── Find eligible fabricators ─────────────────────────────────────────────
    const candidates = await db
      .select({
        userId:         fabricatorBidProfiles.userId,
        equipmentTypes: fabricatorBidProfiles.equipmentTypes,
        shipToStates:   fabricatorBidProfiles.shipToStates,
        rfqEmail:       fabricatorProfiles.rfqEmail,
        userEmail:      users.email,
      })
      .from(fabricatorBidProfiles)
      .innerJoin(users, eq(users.id, fabricatorBidProfiles.userId))
      .leftJoin(fabricatorProfiles, eq(fabricatorProfiles.userId, fabricatorBidProfiles.userId))
      .where(
        and(
          eq(fabricatorBidProfiles.profileComplete, true),
          eq(fabricatorBidProfiles.acceptingWork,   true),
          eq(users.active,                          true),
        )
      )

    const equipmentKey = rfq.vesselType === 'heat_exchanger' ? 'heat_exchanger' : 'pressure_vessel'

    const matched = candidates.filter(c =>
      c.equipmentTypes.includes(equipmentKey) &&
      (c.shipToStates.length === 0 || c.shipToStates.includes(normalizedState))
    )

    // ── Insert notifications + send emails ────────────────────────────────────
    if (matched.length > 0) {
      const now = new Date()

      await db
        .insert(marketplaceNotifications)
        .values(
          matched.map(c => ({
            marketplaceRfqId: marketplaceRfq.id,
            fabricatorId:     c.userId,
            notificationType: 'new_rfq' as const,
            sentAt:           now,
            emailSentTo:      c.rfqEmail ?? c.userEmail,
          })) as (typeof marketplaceNotifications.$inferInsert)[]
        )

      const vesselLabel   = rfq.vesselType === 'heat_exchanger' ? 'Heat Exchanger' : 'Pressure Vessel'
      const deadlineDateStr = deadlineAt.toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
      const dashboardUrl = 'https://vesselrfq.com/app/fabricator-dashboard'

      const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="background:#0f172a;padding:28px 32px">
      <div style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px">VesselRFQ</div>
      <div style="font-size:13px;color:#94a3b8;margin-top:2px">ASME Pressure Vessel Marketplace</div>
    </div>
    <div style="padding:32px">
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1e293b">New Marketplace RFQ</h1>
      <p style="margin:0 0 4px;font-size:15px;color:#475569">${rfq.title}</p>
      <p style="margin:0 0 24px;font-size:13px;color:#94a3b8">RFQ #${rfq.id} &nbsp;·&nbsp; ${vesselLabel}</p>
      <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6">
        A new RFQ has been posted to the VesselRFQ marketplace. Installation location:
        <strong>${installCity.trim()}, ${normalizedState}</strong>.
        Bid deadline: <strong>${deadlineDateStr}</strong>.
      </p>
      <p style="margin:24px 0 0">
        <a href="${dashboardUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:600;padding:10px 20px;border-radius:8px;text-decoration:none">View RFQ in Dashboard →</a>
      </p>
      <p style="margin:16px 0 0;font-size:13px;color:#94a3b8">
        Or copy this link: <a href="${dashboardUrl}" style="color:#3b82f6;text-decoration:none">${dashboardUrl}</a>
      </p>
    </div>
    <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0">
      <p style="margin:0;font-size:12px;color:#94a3b8">
        VesselRFQ &nbsp;·&nbsp; ASME Pressure Vessel Marketplace<br>
        You are receiving this because you are a registered fabricator on vesselrfq.com.
      </p>
    </div>
  </div>
</body>
</html>`

      const text = `New Marketplace RFQ — ${rfq.title}
RFQ #${rfq.id} · ${vesselLabel}

A new RFQ has been posted to the VesselRFQ marketplace.
Installation: ${installCity.trim()}, ${normalizedState}
Bid deadline: ${deadlineDateStr}

View this RFQ in your dashboard:
${dashboardUrl}

VesselRFQ · ASME Pressure Vessel Marketplace
vesselrfq.com`

      await Promise.allSettled(
        matched.map(c =>
          sendEmail(
            c.rfqEmail ?? c.userEmail,
            `New Marketplace RFQ — ${rfq.title}`,
            html,
            text,
          ).catch((err: unknown) =>
            console.error('[marketplace/rfqs] email failed for fabricator', c.userId, err)
          )
        )
      )
    }

    return res.status(200).json({ marketplaceRfqId: marketplaceRfq.id, notified: matched.length })
  } catch (err) {
    console.error('[marketplace/rfqs]', err)
    return res.status(500).json({ error: (err as Error).message ?? 'Internal server error' })
  }
}
