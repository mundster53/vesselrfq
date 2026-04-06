import type { VercelRequest, VercelResponse } from '@vercel/node'
import { and, eq, ne } from 'drizzle-orm'
import { db } from '../_lib/db.js'
import {
  marketplaceRfqs, marketplaceQuotes, rfqs, fabricatorProfiles, users,
} from '../../db/schema.js'
import { requireAuth } from '../_lib/auth.js'
import { sendEmail } from '../_lib/email.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const auth = await requireAuth(req, res)
    if (!auth) return
    if (auth.role !== 'buyer') return res.status(403).json({ error: 'Buyer access required' })

    // ── Validate input ────────────────────────────────────────────────────────
    const { marketplaceRfqId, quoteId } = req.body as {
      marketplaceRfqId: unknown
      quoteId:          unknown
    }

    if (typeof marketplaceRfqId !== 'number' || typeof quoteId !== 'number') {
      return res.status(400).json({ error: 'marketplaceRfqId and quoteId are required' })
    }

    // ── Verify marketplace RFQ belongs to this buyer and is awardable ─────────
    const [mrfq] = await db
      .select({
        id:           marketplaceRfqs.id,
        buyerId:      marketplaceRfqs.buyerId,
        status:       marketplaceRfqs.status,
        installCity:  marketplaceRfqs.installCity,
        installState: marketplaceRfqs.installState,
        rfqTitle:     rfqs.title,
      })
      .from(marketplaceRfqs)
      .innerJoin(rfqs, eq(rfqs.id, marketplaceRfqs.rfqId))
      .where(eq(marketplaceRfqs.id, marketplaceRfqId))
      .limit(1)

    if (!mrfq || mrfq.buyerId !== auth.userId) {
      return res.status(404).json({ error: 'Marketplace RFQ not found' })
    }
    if (mrfq.status === 'awarded' || mrfq.status === 'cancelled') {
      return res.status(400).json({ error: `RFQ is already ${mrfq.status}` })
    }

    // ── Verify the winning quote exists and belongs to this RFQ ───────────────
    const [winningQuote] = await db
      .select({
        id:                  marketplaceQuotes.id,
        fabricatorId:        marketplaceQuotes.fabricatorId,
        totalDeliveredPrice: marketplaceQuotes.totalDeliveredPrice,
      })
      .from(marketplaceQuotes)
      .where(
        and(
          eq(marketplaceQuotes.id, quoteId),
          eq(marketplaceQuotes.marketplaceRfqId, marketplaceRfqId),
        )
      )
      .limit(1)

    if (!winningQuote) {
      return res.status(404).json({ error: 'Quote not found on this RFQ' })
    }

    const now = new Date()

    // ── Transaction: award RFQ + update quote statuses ────────────────────────
    await db.transaction(async (tx) => {
      await tx
        .update(marketplaceRfqs)
        .set({ status: 'awarded', awardedQuoteId: quoteId, updatedAt: now })
        .where(eq(marketplaceRfqs.id, marketplaceRfqId))

      await tx
        .update(marketplaceQuotes)
        .set({ status: 'awarded', updatedAt: now })
        .where(eq(marketplaceQuotes.id, quoteId))

      await tx
        .update(marketplaceQuotes)
        .set({ status: 'not_awarded', updatedAt: now })
        .where(
          and(
            eq(marketplaceQuotes.marketplaceRfqId, marketplaceRfqId),
            ne(marketplaceQuotes.id, quoteId),
          )
        )
    })

    // ── Fetch fabricator contact info for notifications ───────────────────────
    const allQuotes = await db
      .select({
        id:           marketplaceQuotes.id,
        fabricatorId: marketplaceQuotes.fabricatorId,
        rfqEmail:     fabricatorProfiles.rfqEmail,
        userEmail:    users.email,
      })
      .from(marketplaceQuotes)
      .innerJoin(users, eq(users.id, marketplaceQuotes.fabricatorId))
      .leftJoin(fabricatorProfiles, eq(fabricatorProfiles.userId, marketplaceQuotes.fabricatorId))
      .where(eq(marketplaceQuotes.marketplaceRfqId, marketplaceRfqId))

    const winner     = allQuotes.find(q => q.id === quoteId)
    const nonWinners = allQuotes.filter(q => q.id !== quoteId)

    const location   = `${mrfq.installCity}, ${mrfq.installState}`
    const totalStr   = winningQuote.totalDeliveredPrice
      ? `$${parseFloat(winningQuote.totalDeliveredPrice).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
      : '—'
    const fabDashUrl = 'https://vesselrfq.com/app/fabricator-dashboard'

    const sends: Promise<unknown>[] = []

    // ── Award email to winning fabricator ─────────────────────────────────────
    if (winner) {
      const to      = winner.rfqEmail ?? winner.userEmail
      const subject = `You've Been Awarded — ${mrfq.rfqTitle}`

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
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1e293b">Congratulations — You've Been Awarded</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#475569">${mrfq.rfqTitle}</p>
      <div style="margin:0 0 20px;padding:16px;background:#f0fdf4;border-left:4px solid #22c55e;border-radius:0 8px 8px 0">
        <p style="margin:0;font-size:13px;color:#166534;line-height:1.6">
          <strong>The buyer has selected your quote.</strong><br>
          Total Delivered: ${totalStr} &nbsp;·&nbsp; ${location}
        </p>
      </div>
      <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6">
        The buyer will be in contact with you directly to discuss next steps and proceed with the order.
      </p>
      <p style="margin:24px 0 0">
        <a href="${fabDashUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:600;padding:10px 20px;border-radius:8px;text-decoration:none">View in Dashboard →</a>
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

      const text = `Congratulations — You've Been Awarded\n${mrfq.rfqTitle}\n\nThe buyer has selected your quote.\nTotal Delivered: ${totalStr} · ${location}\n\nThe buyer will be in contact with you directly to discuss next steps and proceed with the order.\n\nView your dashboard: ${fabDashUrl}\n\nVesselRFQ · ASME Pressure Vessel Marketplace · vesselrfq.com`

      sends.push(
        sendEmail(to, subject, html, text).catch((err: unknown) =>
          console.error('[buyer/award-quote] winner email failed', winner.fabricatorId, err)
        )
      )
    }

    // ── Not-awarded emails to remaining fabricators ───────────────────────────
    for (const q of nonWinners) {
      const to      = q.rfqEmail ?? q.userEmail
      const subject = `Bid Result — ${mrfq.rfqTitle}`

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
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1e293b">Bid Result</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#475569">${mrfq.rfqTitle}</p>
      <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6">
        Thank you for submitting a quote on this RFQ. After reviewing all submissions, the buyer has selected another fabricator for this project.
      </p>
      <p style="margin:0;font-size:14px;color:#475569;line-height:1.6">
        We appreciate your participation on the VesselRFQ marketplace and look forward to connecting you with future opportunities.
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

      const text = `Bid Result — ${mrfq.rfqTitle}\n\nThank you for submitting a quote on this RFQ. After reviewing all submissions, the buyer has selected another fabricator for this project.\n\nWe appreciate your participation on the VesselRFQ marketplace and look forward to connecting you with future opportunities.\n\nVesselRFQ · ASME Pressure Vessel Marketplace · vesselrfq.com`

      sends.push(
        sendEmail(to, subject, html, text).catch((err: unknown) =>
          console.error('[buyer/award-quote] not-awarded email failed', q.fabricatorId, err)
        )
      )
    }

    await Promise.allSettled(sends)

    return res.status(200).json({ awarded: true, winningQuoteId: quoteId })
  } catch (err) {
    console.error('[buyer/award-quote]', err)
    return res.status(500).json({ error: (err as Error).message ?? 'Internal server error' })
  }
}
