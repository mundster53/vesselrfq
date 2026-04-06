import type { VercelRequest, VercelResponse } from '@vercel/node'
import { and, eq } from 'drizzle-orm'
import { db } from '../_lib/db.js'
import {
  marketplaceRfqs, rfqs,
  fabricatorBidProfiles, fabricatorProfiles, users, marketplaceNotifications,
} from '../../db/schema.js'
import { requireAuth } from '../_lib/auth.js'
import { sendEmail } from '../_lib/email.js'

const REOPEN_WINDOW_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const auth = await requireAuth(req, res)
    if (!auth) return
    if (auth.role !== 'buyer') return res.status(403).json({ error: 'Buyer access required' })

    // ── Validate input ────────────────────────────────────────────────────────
    const { marketplaceRfqId, deadlineDays } = req.body as {
      marketplaceRfqId: unknown
      deadlineDays:     unknown
    }

    if (typeof marketplaceRfqId !== 'number') {
      return res.status(400).json({ error: 'marketplaceRfqId is required' })
    }
    if (![7, 14, 21, 30].includes(deadlineDays as number)) {
      return res.status(400).json({ error: 'deadlineDays must be 7, 14, 21, or 30' })
    }

    // ── Verify RFQ belongs to this buyer ──────────────────────────────────────
    const [mrfq] = await db
      .select({
        id:           marketplaceRfqs.id,
        buyerId:      marketplaceRfqs.buyerId,
        status:       marketplaceRfqs.status,
        closedAt:     marketplaceRfqs.closedAt,
        installCity:  marketplaceRfqs.installCity,
        installState: marketplaceRfqs.installState,
        rfqId:        marketplaceRfqs.rfqId,
        rfqTitle:     rfqs.title,
        vesselType:   rfqs.vesselType,
      })
      .from(marketplaceRfqs)
      .innerJoin(rfqs, eq(rfqs.id, marketplaceRfqs.rfqId))
      .where(eq(marketplaceRfqs.id, marketplaceRfqId))
      .limit(1)

    if (!mrfq || mrfq.buyerId !== auth.userId) {
      return res.status(404).json({ error: 'Marketplace RFQ not found' })
    }

    // ── Eligibility checks ────────────────────────────────────────────────────
    if (mrfq.status !== 'closed') {
      return res.status(400).json({ error: `Cannot reopen an RFQ with status '${mrfq.status}'` })
    }
    const now = new Date()
    if (!mrfq.closedAt || now.getTime() - new Date(mrfq.closedAt).getTime() > REOPEN_WINDOW_MS) {
      return res.status(400).json({ error: 'Reopen window has expired (30 days after close)' })
    }

    // ── Transaction: reopen ───────────────────────────────────────────────────
    const deadlineAt = new Date(now.getTime() + (deadlineDays as number) * 86400000)

    await db.transaction(async (tx) => {
      await tx
        .update(marketplaceRfqs)
        .set({ status: 'open', deadlineAt, closedAt: null, updatedAt: now })
        .where(eq(marketplaceRfqs.id, marketplaceRfqId))
    })

    // ── Find eligible fabricators (same matching logic as marketplace/rfqs.ts) ─
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

    const equipmentKey = mrfq.vesselType === 'heat_exchanger' ? 'heat_exchanger' : 'pressure_vessel'
    const matched = candidates.filter(c =>
      c.equipmentTypes.includes(equipmentKey) &&
      (c.shipToStates.length === 0 || c.shipToStates.includes(mrfq.installState))
    )

    if (matched.length > 0) {
      const deadlineDateStr = deadlineAt.toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
      const dashboardUrl = 'https://vesselrfq.com/app/fabricator-dashboard'

      await db
        .insert(marketplaceNotifications)
        .values(
          matched.map(c => ({
            marketplaceRfqId,
            fabricatorId:     c.userId,
            notificationType: 'new_rfq' as const,
            sentAt:           now,
            emailSentTo:      c.rfqEmail ?? c.userEmail,
          })) as (typeof marketplaceNotifications.$inferInsert)[]
        )

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
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1e293b">RFQ Reopened</h1>
      <p style="margin:0 0 4px;font-size:15px;color:#475569">${mrfq.rfqTitle}</p>
      <p style="margin:0 0 24px;font-size:13px;color:#94a3b8">${mrfq.installCity}, ${mrfq.installState}</p>
      <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6">
        A marketplace RFQ you may be eligible to bid on has been reopened with a new deadline.
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

      const text = `RFQ Reopened — ${mrfq.rfqTitle}
${mrfq.installCity}, ${mrfq.installState}

A marketplace RFQ you may be eligible to bid on has been reopened with a new deadline.
Bid deadline: ${deadlineDateStr}

View this RFQ in your dashboard:
${dashboardUrl}

VesselRFQ · ASME Pressure Vessel Marketplace
vesselrfq.com`

      await Promise.allSettled(
        matched.map(c =>
          sendEmail(
            c.rfqEmail ?? c.userEmail,
            `RFQ Reopened — ${mrfq.rfqTitle}`,
            html,
            text,
          ).catch((err: unknown) =>
            console.error('[buyer/reopen-rfq] email failed for fabricator', c.userId, err)
          )
        )
      )
    }

    return res.status(200).json({ reopened: true, newDeadline: deadlineAt.toISOString(), notified: matched.length })
  } catch (err) {
    console.error('[buyer/reopen-rfq]', err)
    return res.status(500).json({ error: (err as Error).message ?? 'Internal server error' })
  }
}
