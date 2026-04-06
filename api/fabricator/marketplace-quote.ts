import type { VercelRequest, VercelResponse } from '@vercel/node'
import { and, eq, ne, sql } from 'drizzle-orm'
import { db } from '../_lib/db.js'
import {
  marketplaceRfqs, marketplaceQuotes, fabricatorBidProfiles, rfqs, users,
} from '../../db/schema.js'
import { requireAuth } from '../_lib/auth.js'
import { sendEmail } from '../_lib/email.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const auth = await requireAuth(req, res)
    if (!auth) return
    if (auth.role !== 'fabricator') return res.status(403).json({ error: 'Fabricator access required' })

    // ── Eligibility check ─────────────────────────────────────────────────────
    const [userRecord] = await db
      .select({ active: users.active })
      .from(users)
      .where(eq(users.id, auth.userId))
      .limit(1)

    const [bidProfile] = await db
      .select({ profileComplete: fabricatorBidProfiles.profileComplete })
      .from(fabricatorBidProfiles)
      .where(eq(fabricatorBidProfiles.userId, auth.userId))
      .limit(1)

    if (!userRecord?.active || !bidProfile?.profileComplete) {
      return res.status(403).json({ error: 'Not eligible to submit quotes' })
    }

    // ── Validate input ────────────────────────────────────────────────────────
    const { marketplaceRfqId, fabricatedPrice, estimatedFreight, leadTimeWeeks, qualifications } = req.body as {
      marketplaceRfqId: unknown
      fabricatedPrice:  unknown
      estimatedFreight: unknown
      leadTimeWeeks:    unknown
      qualifications:   unknown
    }

    if (
      typeof marketplaceRfqId !== 'number' ||
      typeof fabricatedPrice  !== 'number' || fabricatedPrice  <= 0 ||
      typeof estimatedFreight !== 'number' || estimatedFreight <  0 ||
      typeof leadTimeWeeks    !== 'number' || leadTimeWeeks    <  1
    ) {
      return res.status(400).json({ error: 'marketplaceRfqId, fabricatedPrice, estimatedFreight, and leadTimeWeeks are required' })
    }

    // ── Verify the marketplace RFQ is still open ──────────────────────────────
    const [mrfq] = await db
      .select({ status: marketplaceRfqs.status })
      .from(marketplaceRfqs)
      .where(eq(marketplaceRfqs.id, marketplaceRfqId))
      .limit(1)

    if (!mrfq) return res.status(404).json({ error: 'Marketplace RFQ not found' })
    if (mrfq.status !== 'open') return res.status(409).json({ error: 'This RFQ is no longer open for quotes' })

    // ── Prevent duplicate quotes ──────────────────────────────────────────────
    const [existing] = await db
      .select({ id: marketplaceQuotes.id })
      .from(marketplaceQuotes)
      .where(
        and(
          eq(marketplaceQuotes.marketplaceRfqId, marketplaceRfqId),
          eq(marketplaceQuotes.fabricatorId, auth.userId),
        )
      )
      .limit(1)

    if (existing) {
      return res.status(409).json({ error: 'You have already submitted a quote for this RFQ', quoteId: existing.id })
    }

    // ── Check if this is the first quote ──────────────────────────────────────
    const [{ existingCount }] = await db
      .select({ existingCount: sql<number>`cast(count(*) as int)` })
      .from(marketplaceQuotes)
      .where(
        and(
          eq(marketplaceQuotes.marketplaceRfqId, marketplaceRfqId),
          ne(marketplaceQuotes.status, 'withdrawn'),
        )
      )

    const isFirstQuote = existingCount === 0

    // ── Insert quote ──────────────────────────────────────────────────────────
    const [inserted] = await db
      .insert(marketplaceQuotes)
      .values({
        marketplaceRfqId,
        fabricatorId:     auth.userId,
        fabricatedPrice:  String(fabricatedPrice),
        estimatedFreight: String(estimatedFreight),
        leadTimeWeeks,
        qualifications: typeof qualifications === 'string' && qualifications.trim() ? qualifications.trim() : null,
      })
      .returning({ id: marketplaceQuotes.id })

    // ── Buyer notification (first quote only) ─────────────────────────────────
    if (isFirstQuote) {
      try {
        const [rfqData] = await db
          .select({
            buyerId:      marketplaceRfqs.buyerId,
            installCity:  marketplaceRfqs.installCity,
            installState: marketplaceRfqs.installState,
            deadlineAt:   marketplaceRfqs.deadlineAt,
            rfqTitle:     rfqs.title,
            vesselType:   rfqs.vesselType,
            shellOd:      rfqs.shellOd,
          })
          .from(marketplaceRfqs)
          .innerJoin(rfqs, eq(rfqs.id, marketplaceRfqs.rfqId))
          .where(eq(marketplaceRfqs.id, marketplaceRfqId))
          .limit(1)

        if (rfqData) {
          const [buyer] = await db
            .select({ email: users.email })
            .from(users)
            .where(eq(users.id, rfqData.buyerId))
            .limit(1)

          if (buyer) {
            const vesselLabel     = rfqData.vesselType === 'heat_exchanger' ? 'Heat Exchanger' : 'Pressure Vessel'
            const deadlineDateStr = rfqData.deadlineAt
              ? new Date(rfqData.deadlineAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
              : '—'
            const dashboardUrl = 'https://vesselrfq.com/app/dashboard'

            const tdLabel = 'style="padding:6px 12px;color:#64748b;font-size:13px;white-space:nowrap"'
            const tdValue = 'style="padding:6px 12px;color:#1e293b;font-size:13px;font-weight:500"'

            const infoRows = [
              `<tr><td ${tdLabel}>Vessel Type</td><td ${tdValue}>${vesselLabel}</td></tr>`,
              rfqData.shellOd
                ? `<tr><td ${tdLabel}>Shell OD</td><td ${tdValue}>${rfqData.shellOd}"</td></tr>`
                : '',
              `<tr><td ${tdLabel}>Install Location</td><td ${tdValue}>${rfqData.installCity}, ${rfqData.installState}</td></tr>`,
              `<tr><td ${tdLabel}>Bid Deadline</td><td ${tdValue}>${deadlineDateStr}</td></tr>`,
              `<tr><td ${tdLabel}>Quotes Received</td><td ${tdValue}>1</td></tr>`,
            ].join('')

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
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1e293b">New Quote Received</h1>
      <p style="margin:0 0 4px;font-size:15px;color:#475569">${rfqData.rfqTitle}</p>
      <p style="margin:0 0 24px;font-size:13px;color:#94a3b8">${vesselLabel}</p>
      <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6">
        A fabricator has submitted a quote for your marketplace RFQ. Log in to your dashboard to review it.
      </p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin:16px 0">
        <tbody>${infoRows}</tbody>
      </table>
      <p style="margin:24px 0 0">
        <a href="${dashboardUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:600;padding:10px 20px;border-radius:8px;text-decoration:none">View Quotes in Dashboard →</a>
      </p>
      <p style="margin:16px 0 0;font-size:13px;color:#94a3b8">
        Or copy this link: <a href="${dashboardUrl}" style="color:#3b82f6;text-decoration:none">${dashboardUrl}</a>
      </p>
    </div>
    <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0">
      <p style="margin:0;font-size:12px;color:#94a3b8">
        VesselRFQ &nbsp;·&nbsp; ASME Pressure Vessel Marketplace<br>
        You are receiving this because you submitted an RFQ at vesselrfq.com.
      </p>
    </div>
  </div>
</body>
</html>`

            const text = `New Quote Received — ${rfqData.rfqTitle}

A fabricator has submitted a quote for your marketplace RFQ. Log in to your dashboard to review it.

Vessel Type: ${vesselLabel}${rfqData.shellOd ? `\nShell OD: ${rfqData.shellOd}"` : ''}
Install Location: ${rfqData.installCity}, ${rfqData.installState}
Bid Deadline: ${deadlineDateStr}
Quotes Received: 1

View your quotes here:
${dashboardUrl}

VesselRFQ · ASME Pressure Vessel Marketplace
vesselrfq.com`

            await sendEmail(buyer.email, `New Quote Received — ${rfqData.rfqTitle}`, html, text)
          }
        }
      } catch (emailErr) {
        console.error('[fabricator/marketplace-quote] buyer notification failed', emailErr)
      }
    }

    return res.status(201).json({ quoteId: inserted.id })
  } catch (err) {
    console.error('[fabricator/marketplace-quote]', err)
    return res.status(500).json({ error: (err as Error).message ?? 'Internal server error' })
  }
}
