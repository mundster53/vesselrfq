import type { VercelRequest, VercelResponse } from '@vercel/node'
import { and, eq, lt, inArray } from 'drizzle-orm'
import { db } from './_lib/db.js'
import {
  marketplaceRfqs, marketplaceQuotes, marketplaceNotifications,
  rfqs, fabricatorProfiles, users,
} from '../db/schema.js'
import { sendEmail } from './_lib/email.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = req.headers['authorization']
  if (!auth || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const now = new Date()

    // ── Find all expired open RFQs ────────────────────────────────────────────
    const expired = await db
      .select({
        marketplaceRfqId: marketplaceRfqs.id,
        installCity:      marketplaceRfqs.installCity,
        installState:     marketplaceRfqs.installState,
        rfqTitle:         rfqs.title,
        vesselType:       rfqs.vesselType,
      })
      .from(marketplaceRfqs)
      .innerJoin(rfqs, eq(rfqs.id, marketplaceRfqs.rfqId))
      .where(
        and(
          eq(marketplaceRfqs.status, 'open'),
          lt(marketplaceRfqs.deadlineAt, now),
        )
      )

    if (expired.length === 0) {
      return res.status(200).json({ closed: 0, fabricatorsNotified: 0 })
    }

    let fabricatorsNotified = 0
    const expiredIds = expired.map(r => r.marketplaceRfqId)

    // ── Close all expired RFQs in one update ──────────────────────────────────
    await db
      .update(marketplaceRfqs)
      .set({ status: 'closed', closedAt: now, updatedAt: now })
      .where(inArray(marketplaceRfqs.id, expiredIds))

    // ── For each expired RFQ, notify fabricators who submitted quotes ─────────
    for (const rfq of expired) {
      const submittedQuotes = await db
        .select({
          fabricatorId: marketplaceQuotes.fabricatorId,
          shopName:     fabricatorProfiles.shopName,
          rfqEmail:     fabricatorProfiles.rfqEmail,
          userEmail:    users.email,
        })
        .from(marketplaceQuotes)
        .innerJoin(users, eq(users.id, marketplaceQuotes.fabricatorId))
        .leftJoin(fabricatorProfiles, eq(fabricatorProfiles.userId, marketplaceQuotes.fabricatorId))
        .where(
          and(
            eq(marketplaceQuotes.marketplaceRfqId, rfq.marketplaceRfqId),
            eq(marketplaceQuotes.status, 'submitted'),
          )
        )

      if (submittedQuotes.length === 0) continue

      const vesselLabel = rfq.vesselType === 'heat_exchanger' ? 'Heat Exchanger' : 'Pressure Vessel'

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
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1e293b">Bidding Period Closed</h1>
      <p style="margin:0 0 4px;font-size:15px;color:#475569">${rfq.rfqTitle}</p>
      <p style="margin:0 0 24px;font-size:13px;color:#94a3b8">${vesselLabel} &nbsp;·&nbsp; ${rfq.installCity}, ${rfq.installState}</p>
      <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6">
        The bidding period for this RFQ has closed. The buyer is now reviewing all submitted quotes
        and will make an award decision. You will be notified by email when the buyer has made their selection.
      </p>
      <div style="margin:24px 0;padding:16px;background:#f0fdf4;border-left:4px solid #22c55e;border-radius:0 8px 8px 0">
        <p style="margin:0;font-size:13px;color:#166534;line-height:1.6">
          <strong>Your quote is in review.</strong><br>
          No action is required on your end at this time. We'll be in touch once the buyer has made a decision.
        </p>
      </div>
      <p style="margin:0;font-size:13px;color:#94a3b8">
        Questions? Reply to this email or contact us at
        <a href="mailto:rfqs@vesselrfq.com" style="color:#3b82f6;text-decoration:none">rfqs@vesselrfq.com</a>.
      </p>
    </div>
    <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0">
      <p style="margin:0;font-size:12px;color:#94a3b8">
        VesselRFQ &nbsp;·&nbsp; ASME Pressure Vessel Marketplace<br>
        You are receiving this because you submitted a quote at vesselrfq.com.
      </p>
    </div>
  </div>
</body>
</html>`

      const text = `Bidding Period Closed — ${rfq.rfqTitle}
${vesselLabel} · ${rfq.installCity}, ${rfq.installState}

The bidding period for this RFQ has closed. The buyer is now reviewing all submitted quotes and will make an award decision. You will be notified by email when the buyer has made their selection.

Your quote is in review — no action is required at this time.

Questions? Reply to this email or contact rfqs@vesselrfq.com.

VesselRFQ · ASME Pressure Vessel Marketplace
vesselrfq.com`

      const notificationValues = submittedQuotes.map(q => ({
        marketplaceRfqId: rfq.marketplaceRfqId,
        fabricatorId:     q.fabricatorId,
        notificationType: 'rfq_deadline_reminder' as const,
        sentAt:           now,
        emailSentTo:      q.rfqEmail ?? q.userEmail,
      }))

      await Promise.allSettled([
        db.insert(marketplaceNotifications).values(notificationValues),
        ...submittedQuotes.map(q =>
          sendEmail(
            q.rfqEmail ?? q.userEmail,
            `Bidding Closed — ${rfq.rfqTitle}`,
            html,
            text,
          ).catch((err: unknown) =>
            console.error('[cron-close-rfqs] email failed for fabricator', q.fabricatorId, err)
          )
        ),
      ])

      fabricatorsNotified += submittedQuotes.length
    }

    return res.status(200).json({ closed: expired.length, fabricatorsNotified })
  } catch (err) {
    console.error('[cron-close-rfqs]', err)
    return res.status(500).json({ error: (err as Error).message ?? 'Internal server error' })
  }
}
