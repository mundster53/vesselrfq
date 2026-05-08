import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../_lib/db.js'
import {
  marketplaceRfqs,
  rfqs,
  fabricatorProfiles,
  users,
  marketplaceNotifications,
} from '../../db/schema.js'
import { requireAuth } from '../_lib/auth.js'
import { sendEmail } from '../_lib/email.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const auth = await requireAuth(req, res)
    if (!auth) return
    if (auth.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })

    const { marketplaceRfqId, fabricatorIds } = req.body as {
      marketplaceRfqId?: number
      fabricatorIds?: number[]
    }

    if (!marketplaceRfqId || !Array.isArray(fabricatorIds) || fabricatorIds.length === 0) {
      return res.status(400).json({ error: 'marketplaceRfqId and fabricatorIds are required' })
    }

    // Get marketplace RFQ + spec
    const [mRfq] = await db
      .select()
      .from(marketplaceRfqs)
      .where(eq(marketplaceRfqs.id, marketplaceRfqId))
      .limit(1)

    if (!mRfq) return res.status(404).json({ error: 'Marketplace RFQ not found' })

    const [spec] = await db
      .select()
      .from(rfqs)
      .where(eq(rfqs.id, mRfq.rfqId))
      .limit(1)

    if (!spec) return res.status(404).json({ error: 'RFQ spec not found' })

    // Get fabricators
    const fabricators = await db
      .select({
        userId:   users.id,
        shopName: fabricatorProfiles.shopName,
        rfqEmail: fabricatorProfiles.rfqEmail,
        email:    users.email,
      })
      .from(fabricatorProfiles)
      .innerJoin(users, eq(users.id, fabricatorProfiles.userId))
      .where(inArray(users.id, fabricatorIds))

    const vesselLabel = spec.vesselType === 'heat_exchanger' ? 'Heat Exchanger' : 'Pressure Vessel'
    const dashboardUrl = `https://vesselrfq.com/app/fabricator-dashboard`

    let sent   = 0
    const errors: string[] = []

    for (const fab of fabricators) {
      const to = fab.rfqEmail ?? fab.email

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
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1e293b">New RFQ Available</h1>
      <p style="margin:0 0 4px;font-size:15px;color:#475569">${spec.title}</p>
      <p style="margin:0 0 24px;font-size:13px;color:#94a3b8">RFQ #${spec.id} &nbsp;·&nbsp; ${vesselLabel}</p>
      <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6">
        A new RFQ has been posted to the VesselRFQ marketplace that matches your capabilities. Review the specifications below and log in to your dashboard to submit a quote.
      </p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin:0 0 24px">
        <tbody>
          <tr style="background:#f8fafc">
            <td style="padding:8px 14px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.06em" colspan="2">Specifications</td>
          </tr>
          <tr><td style="padding:6px 14px;color:#64748b;font-size:13px;white-space:nowrap">Vessel Type</td><td style="padding:6px 14px;color:#1e293b;font-size:13px;font-weight:500">${vesselLabel}</td></tr>
          ${spec.shellOd ? `<tr><td style="padding:6px 14px;color:#64748b;font-size:13px;white-space:nowrap">Shell OD</td><td style="padding:6px 14px;color:#1e293b;font-size:13px;font-weight:500">${spec.shellOd}"</td></tr>` : ''}
          ${spec.shellLength ? `<tr><td style="padding:6px 14px;color:#64748b;font-size:13px;white-space:nowrap">Shell Length</td><td style="padding:6px 14px;color:#1e293b;font-size:13px;font-weight:500">${spec.shellLength}"</td></tr>` : ''}
          ${spec.shellMaterial ? `<tr><td style="padding:6px 14px;color:#64748b;font-size:13px;white-space:nowrap">Shell Material</td><td style="padding:6px 14px;color:#1e293b;font-size:13px;font-weight:500">${spec.shellMaterial}</td></tr>` : ''}
          ${spec.mawp ? `<tr><td style="padding:6px 14px;color:#64748b;font-size:13px;white-space:nowrap">MAWP</td><td style="padding:6px 14px;color:#1e293b;font-size:13px;font-weight:500">${spec.mawp} psig</td></tr>` : ''}
          ${spec.designTemp != null ? `<tr><td style="padding:6px 14px;color:#64748b;font-size:13px;white-space:nowrap">Design Temp</td><td style="padding:6px 14px;color:#1e293b;font-size:13px;font-weight:500">${spec.designTemp}°F</td></tr>` : ''}
          ${spec.headType ? `<tr><td style="padding:6px 14px;color:#64748b;font-size:13px;white-space:nowrap">Head Type</td><td style="padding:6px 14px;color:#1e293b;font-size:13px;font-weight:500">${spec.headType}</td></tr>` : ''}
          ${spec.supportType ? `<tr><td style="padding:6px 14px;color:#64748b;font-size:13px;white-space:nowrap">Supports</td><td style="padding:6px 14px;color:#1e293b;font-size:13px;font-weight:500">${spec.supportType}</td></tr>` : ''}
          ${mRfq.installCity && mRfq.installState ? `<tr><td style="padding:6px 14px;color:#64748b;font-size:13px;white-space:nowrap">Install Location</td><td style="padding:6px 14px;color:#1e293b;font-size:13px;font-weight:500">${mRfq.installCity}, ${mRfq.installState}</td></tr>` : ''}
        </tbody>
      </table>
      <p style="margin:0 0 16px">
        <a href="${dashboardUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:600;padding:10px 20px;border-radius:8px;text-decoration:none">View RFQ &amp; Submit Quote →</a>
      </p>
      <p style="margin:0;font-size:13px;color:#94a3b8">
        Questions? Reply to this email or contact us at <a href="mailto:rfqs@vesselrfq.com" style="color:#3b82f6;text-decoration:none">rfqs@vesselrfq.com</a>.
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

      const text = `New RFQ — ${spec.title} [VesselRFQ]

RFQ #${spec.id} · ${vesselLabel}
Install Location: ${mRfq.installCity}, ${mRfq.installState}

SPECIFICATIONS
Vessel Type: ${vesselLabel}
${spec.shellOd ? `Shell OD: ${spec.shellOd}"\n` : ''}${spec.shellLength ? `Shell Length: ${spec.shellLength}"\n` : ''}${spec.shellMaterial ? `Shell Material: ${spec.shellMaterial}\n` : ''}${spec.mawp ? `MAWP: ${spec.mawp} psig\n` : ''}${spec.designTemp != null ? `Design Temp: ${spec.designTemp}°F\n` : ''}
Log in to your dashboard to view the full RFQ and submit a quote:
${dashboardUrl}

VesselRFQ · ASME Pressure Vessel Marketplace
vesselrfq.com`

      try {
        await sendEmail(to, `New RFQ — ${spec.title} [VesselRFQ]`, html, text)
        await db.insert(marketplaceNotifications).values({
          marketplaceRfqId,
          fabricatorId:     fab.userId,
          notificationType: 'new_rfq',
          emailSentTo:      to,
        })
        sent++
      } catch (emailErr) {
        errors.push(`${fab.shopName} (${to}): ${(emailErr as Error).message}`)
      }
    }

    return res.status(200).json({ sent, errors })
  } catch (err) {
    console.error('[admin/notify-fabricators]', err)
    return res.status(500).json({ error: (err as Error).message ?? 'Internal server error' })
  }
}
