import type { VercelRequest, VercelResponse } from '@vercel/node'
import { asc, eq } from 'drizzle-orm'
import { db } from '../_lib/db.js'
import {
  marketplaceRfqs, marketplaceQuotes, rfqs, fabricatorProfiles, users,
} from '../../db/schema.js'
import { requireAuth } from '../_lib/auth.js'
import { sendEmail } from '../_lib/email.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function fmtPrice(val: string | null): string {
  if (!val) return '—'
  const n = parseFloat(val)
  return isNaN(n) ? '—' : `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function fmtDate(d: Date | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const auth = await requireAuth(req, res)
    if (!auth) return
    if (auth.role !== 'buyer') return res.status(403).json({ error: 'Buyer access required' })

    // ── Validate input ────────────────────────────────────────────────────────
    const { marketplaceRfqId, recipientName, recipientEmail } = req.body as {
      marketplaceRfqId: unknown
      recipientName:    unknown
      recipientEmail:   unknown
    }

    if (typeof marketplaceRfqId !== 'number') {
      return res.status(400).json({ error: 'marketplaceRfqId is required' })
    }
    if (typeof recipientName !== 'string' || !recipientName.trim()) {
      return res.status(400).json({ error: 'recipientName is required' })
    }
    if (typeof recipientEmail !== 'string' || !EMAIL_RE.test(recipientEmail)) {
      return res.status(400).json({ error: 'A valid recipientEmail is required' })
    }

    // ── Verify this marketplace RFQ belongs to this buyer ─────────────────────
    const [mrfq] = await db
      .select({
        buyerId:      marketplaceRfqs.buyerId,
        installCity:  marketplaceRfqs.installCity,
        installState: marketplaceRfqs.installState,
        deadlineAt:   marketplaceRfqs.deadlineAt,
        status:       marketplaceRfqs.status,
        rfqTitle:     rfqs.title,
        vesselType:   rfqs.vesselType,
        quantity:     rfqs.quantity,
        shellOd:      rfqs.shellOd,
        shellLength:  rfqs.shellLength,
        mawp:         rfqs.mawp,
      })
      .from(marketplaceRfqs)
      .innerJoin(rfqs, eq(rfqs.id, marketplaceRfqs.rfqId))
      .where(eq(marketplaceRfqs.id, marketplaceRfqId))
      .limit(1)

    if (!mrfq || mrfq.buyerId !== auth.userId) {
      return res.status(404).json({ error: 'Marketplace RFQ not found' })
    }

    // ── Fetch buyer email for CC ──────────────────────────────────────────────
    const [buyer] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, auth.userId))
      .limit(1)

    // ── Fetch quotes ordered by total delivered price asc ─────────────────────
    const quotes = await db
      .select({
        fabricatedPrice:     marketplaceQuotes.fabricatedPrice,
        estimatedFreight:    marketplaceQuotes.estimatedFreight,
        totalDeliveredPrice: marketplaceQuotes.totalDeliveredPrice,
        leadTimeWeeks:       marketplaceQuotes.leadTimeWeeks,
        qualifications:      marketplaceQuotes.qualifications,
        shopName:            fabricatorProfiles.shopName,
        city:                fabricatorProfiles.city,
        state:               fabricatorProfiles.state,
        phone:               fabricatorProfiles.phone,
        website:             fabricatorProfiles.website,
        rfqEmail:            fabricatorProfiles.rfqEmail,
      })
      .from(marketplaceQuotes)
      .innerJoin(fabricatorProfiles, eq(fabricatorProfiles.userId, marketplaceQuotes.fabricatorId))
      .where(eq(marketplaceQuotes.marketplaceRfqId, marketplaceRfqId))
      .orderBy(asc(marketplaceQuotes.totalDeliveredPrice))

    // ── Build email ───────────────────────────────────────────────────────────
    const vesselLabel = mrfq.vesselType === 'heat_exchanger' ? 'Heat Exchanger' : 'Pressure Vessel'
    const deadlineStr = fmtDate(mrfq.deadlineAt)
    const name        = recipientName.trim()

    const quoteRows = quotes.length === 0
      ? `<tr><td colspan="8" style="padding:16px 12px;text-align:center;color:#94a3b8;font-size:13px">No quotes received</td></tr>`
      : quotes.map((q, i) => {
          const isTop    = i === 0
          const rowBg    = isTop ? 'background:#f0fdf4' : (i % 2 === 0 ? 'background:#ffffff' : 'background:#f8fafc')
          const rankCell = isTop
            ? `<td style="padding:10px 12px;${rowBg};color:#16a34a;font-weight:700;font-size:13px">#1 ✓</td>`
            : `<td style="padding:10px 12px;${rowBg};color:#94a3b8;font-size:13px">#${i + 1}</td>`
          const notes = q.qualifications
            ? (q.qualifications.length > 60 ? q.qualifications.slice(0, 60) + '…' : q.qualifications)
            : '—'
          return `<tr>
            ${rankCell}
            <td style="padding:10px 12px;${rowBg};color:#1e293b;font-size:13px;font-weight:500">${q.shopName}</td>
            <td style="padding:10px 12px;${rowBg};color:#475569;font-size:13px">${q.city}, ${q.state}</td>
            <td style="padding:10px 12px;${rowBg};color:#475569;font-size:13px;text-align:right">${fmtPrice(q.fabricatedPrice)}</td>
            <td style="padding:10px 12px;${rowBg};color:#475569;font-size:13px;text-align:right">${fmtPrice(q.estimatedFreight)}</td>
            <td style="padding:10px 12px;${rowBg};color:#1e293b;font-size:13px;font-weight:700;text-align:right">${fmtPrice(q.totalDeliveredPrice)}</td>
            <td style="padding:10px 12px;${rowBg};color:#475569;font-size:13px;text-align:center">${q.leadTimeWeeks} wks</td>
            <td style="padding:10px 12px;${rowBg};color:#94a3b8;font-size:12px;max-width:160px">${notes}</td>
          </tr>`
        }).join('')

    const contactRows = quotes.length === 0
      ? `<tr><td colspan="6" style="padding:16px 12px;text-align:center;color:#94a3b8;font-size:13px">No quotes received</td></tr>`
      : quotes.map((q, i) => {
          const rowBg      = i % 2 === 0 ? 'background:#ffffff' : 'background:#f8fafc'
          const emailCell  = q.rfqEmail
            ? `<a href="mailto:${q.rfqEmail}" style="color:#2563eb;text-decoration:none;font-size:13px">${q.rfqEmail}</a>`
            : '<span style="color:#94a3b8;font-size:13px">—</span>'
          const websiteCell = q.website
            ? `<a href="${q.website}" style="color:#2563eb;text-decoration:none;font-size:13px">${q.website.replace(/^https?:\/\//, '')}</a>`
            : '<span style="color:#94a3b8;font-size:13px">—</span>'
          return `<tr>
            <td style="padding:10px 12px;${rowBg};color:#64748b;font-size:13px">#${i + 1}</td>
            <td style="padding:10px 12px;${rowBg};color:#1e293b;font-size:13px;font-weight:500">${q.shopName}</td>
            <td style="padding:10px 12px;${rowBg};color:#475569;font-size:13px">${q.city}, ${q.state}</td>
            <td style="padding:10px 12px;${rowBg};color:#475569;font-size:13px">${q.phone}</td>
            <td style="padding:10px 12px;${rowBg}">${emailCell}</td>
            <td style="padding:10px 12px;${rowBg}">${websiteCell}</td>
          </tr>`
        }).join('')

    const thStyle  = 'padding:8px 12px;text-align:left;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;background:#f1f5f9;border-bottom:1px solid #e2e8f0'
    const thRight  = thStyle + ';text-align:right'
    const thCenter = thStyle + ';text-align:center'

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:780px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">

    <!-- Header -->
    <div style="background:#0f172a;padding:28px 32px">
      <div style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px">VesselRFQ</div>
      <div style="font-size:13px;color:#94a3b8;margin-top:2px">ASME Pressure Vessel Marketplace</div>
    </div>

    <!-- Body -->
    <div style="padding:32px">
      <h1 style="margin:0 0 4px;font-size:24px;font-weight:700;color:#1e293b">Bid Tabulation Report</h1>
      <p style="margin:0 0 28px;font-size:13px;color:#94a3b8">Generated by VesselRFQ</p>

      <p style="margin:0 0 24px;font-size:15px;color:#1e293b">Dear ${name},</p>
      <p style="margin:0 0 28px;font-size:14px;color:#475569;line-height:1.6">
        Please find below the bid tabulation for the following project. Quotes are ranked by total delivered price, lowest first.
      </p>

      <!-- Project summary -->
      <h2 style="margin:0 0 12px;font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.07em">Project Summary</h2>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin:0 0 28px">
        <tbody>
          <tr><td style="padding:8px 14px;color:#64748b;font-size:13px;white-space:nowrap;background:#f8fafc;border-bottom:1px solid #e2e8f0">RFQ</td><td style="padding:8px 14px;color:#1e293b;font-size:13px;font-weight:500;border-bottom:1px solid #e2e8f0">${mrfq.rfqTitle}</td></tr>
          <tr><td style="padding:8px 14px;color:#64748b;font-size:13px;white-space:nowrap;background:#f8fafc;border-bottom:1px solid #e2e8f0">Vessel Type</td><td style="padding:8px 14px;color:#1e293b;font-size:13px;font-weight:500;border-bottom:1px solid #e2e8f0">${vesselLabel}</td></tr>
          ${mrfq.shellOd ? `<tr><td style="padding:8px 14px;color:#64748b;font-size:13px;white-space:nowrap;background:#f8fafc;border-bottom:1px solid #e2e8f0">Shell OD</td><td style="padding:8px 14px;color:#1e293b;font-size:13px;font-weight:500;border-bottom:1px solid #e2e8f0">${mrfq.shellOd}"</td></tr>` : ''}
          <tr><td style="padding:8px 14px;color:#64748b;font-size:13px;white-space:nowrap;background:#f8fafc;border-bottom:1px solid #e2e8f0">Quantity</td><td style="padding:8px 14px;color:#1e293b;font-size:13px;font-weight:500;border-bottom:1px solid #e2e8f0">${mrfq.quantity}</td></tr>
          <tr><td style="padding:8px 14px;color:#64748b;font-size:13px;white-space:nowrap;background:#f8fafc;border-bottom:1px solid #e2e8f0">Install Location</td><td style="padding:8px 14px;color:#1e293b;font-size:13px;font-weight:500;border-bottom:1px solid #e2e8f0">${mrfq.installCity}, ${mrfq.installState}</td></tr>
          <tr><td style="padding:8px 14px;color:#64748b;font-size:13px;white-space:nowrap;background:#f8fafc;border-bottom:1px solid #e2e8f0">Bid Deadline</td><td style="padding:8px 14px;color:#1e293b;font-size:13px;font-weight:500;border-bottom:1px solid #e2e8f0">${deadlineStr}</td></tr>
          <tr><td style="padding:8px 14px;color:#64748b;font-size:13px;white-space:nowrap;background:#f8fafc">Bids Received</td><td style="padding:8px 14px;color:#1e293b;font-size:13px;font-weight:500">${quotes.length}</td></tr>
        </tbody>
      </table>

      <!-- Bid tabulation table -->
      <h2 style="margin:0 0 12px;font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.07em">Bid Tabulation</h2>
      <div style="overflow-x:auto;margin:0 0 28px">
        <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;min-width:600px">
          <thead>
            <tr>
              <th style="${thStyle}">Rank</th>
              <th style="${thStyle}">Fabricator</th>
              <th style="${thStyle}">Location</th>
              <th style="${thRight}">Fab Price</th>
              <th style="${thRight}">Est. Freight</th>
              <th style="${thRight}">Total Delivered</th>
              <th style="${thCenter}">Lead Time</th>
              <th style="${thStyle}">Notes</th>
            </tr>
          </thead>
          <tbody>
            ${quoteRows}
          </tbody>
        </table>
      </div>

      <!-- Fabricator contact information -->
      <h2 style="margin:0 0 12px;font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.07em">Fabricator Contact Information</h2>
      <div style="overflow-x:auto;margin:0 0 28px">
        <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;min-width:500px">
          <thead>
            <tr>
              <th style="${thStyle}">Rank</th>
              <th style="${thStyle}">Shop Name</th>
              <th style="${thStyle}">Location</th>
              <th style="${thStyle}">Phone</th>
              <th style="${thStyle}">Email</th>
              <th style="${thStyle}">Website</th>
            </tr>
          </thead>
          <tbody>
            ${contactRows}
          </tbody>
        </table>
      </div>

      <!-- Footer note -->
      <div style="padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px">
        <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6">
          This bid tabulation was generated by VesselRFQ (<a href="https://vesselrfq.com" style="color:#3b82f6;text-decoration:none">vesselrfq.com</a>).
          Prices shown are fabricator estimates and subject to formal quotation.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0">
      <p style="margin:0;font-size:12px;color:#94a3b8">
        VesselRFQ &nbsp;·&nbsp; ASME Pressure Vessel Marketplace &nbsp;·&nbsp; vesselrfq.com
      </p>
    </div>
  </div>
</body>
</html>`

    const textRows = quotes.length === 0
      ? '  No quotes received'
      : quotes.map((q, i) =>
          `  #${i + 1}  ${q.shopName} (${q.city}, ${q.state})\n` +
          `       Fab: ${fmtPrice(q.fabricatedPrice)}  Freight: ${fmtPrice(q.estimatedFreight)}  ` +
          `Total Delivered: ${fmtPrice(q.totalDeliveredPrice)}  Lead Time: ${q.leadTimeWeeks} wks` +
          (q.qualifications ? `\n       Notes: ${q.qualifications}` : '')
        ).join('\n\n')

    const contactTextRows = quotes.length === 0
      ? '  No quotes received'
      : quotes.map((q, i) => {
          const lines = [
            `  #${i + 1}  ${q.shopName} (${q.city}, ${q.state})`,
            `       Phone: ${q.phone}`,
            ...(q.rfqEmail ? [`       Email: ${q.rfqEmail}`] : []),
            ...(q.website  ? [`       Web:   ${q.website}`]  : []),
          ]
          return lines.join('\n')
        }).join('\n\n')

    const subject = `Bid Tabulation — ${mrfq.rfqTitle} — VesselRFQ`

    const text = `Bid Tabulation Report — VesselRFQ

Dear ${name},

Please find below the bid tabulation for the following project. Quotes are ranked by total delivered price, lowest first.

PROJECT SUMMARY
RFQ: ${mrfq.rfqTitle}
Vessel Type: ${vesselLabel}${mrfq.shellOd ? `\nShell OD: ${mrfq.shellOd}"` : ''}
Quantity: ${mrfq.quantity}
Install Location: ${mrfq.installCity}, ${mrfq.installState}
Bid Deadline: ${deadlineStr}
Bids Received: ${quotes.length}

BID TABULATION
${textRows}

FABRICATOR CONTACT INFORMATION
${contactTextRows}

---
This bid tabulation was generated by VesselRFQ (vesselrfq.com). Prices shown are fabricator estimates and subject to formal quotation.

VesselRFQ · ASME Pressure Vessel Marketplace · vesselrfq.com`

    // Send to recipient + CC buyer (second send since sendEmail has no CC param)
    const sends: Promise<unknown>[] = [
      sendEmail(recipientEmail, subject, html, text),
    ]
    if (buyer && buyer.email !== recipientEmail) {
      sends.push(sendEmail(buyer.email, subject, html, text))
    }
    await Promise.all(sends)

    return res.status(200).json({ sent: true, recipientEmail })
  } catch (err) {
    console.error('[buyer/send-bid-tab]', err)
    return res.status(500).json({ error: (err as Error).message ?? 'Internal server error' })
  }
}
