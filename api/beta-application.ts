import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from './_lib/db.js'
import { betaApplications } from '../db/schema.js'
import { sendEmail } from './_lib/email.js'

interface BetaPayload {
  firstName?: string
  lastName?: string
  title?: string
  companyName?: string
  email?: string
  phone?: string
  city?: string
  state?: string
  asmeStamps?: string[]
  vesselTypesFabricated?: string[]
  vesselTypesPreferred?: string[]
  materials?: string[]
  annualRevenue?: string
  additionalInfo?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = req.body as BetaPayload

  const { firstName, lastName, title, companyName, email, phone, city, state } = body

  if (!firstName || !lastName || !title || !companyName || !email || !phone || !city || !state) {
    return res.status(400).json({ error: 'All required fields must be filled in.' })
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' })
  }

  try {
    await db.insert(betaApplications).values({
      firstName:             firstName.trim(),
      lastName:              lastName.trim(),
      title:                 title.trim(),
      companyName:           companyName.trim(),
      email:                 email.trim().toLowerCase(),
      phone:                 phone.trim(),
      city:                  city.trim(),
      state:                 state.trim(),
      asmeStamps:            Array.isArray(body.asmeStamps) ? body.asmeStamps : [],
      vesselTypesFabricated: Array.isArray(body.vesselTypesFabricated) ? body.vesselTypesFabricated : [],
      vesselTypesPreferred:  Array.isArray(body.vesselTypesPreferred) ? body.vesselTypesPreferred : [],
      materials:             Array.isArray(body.materials) ? body.materials : [],
      annualRevenue:         body.annualRevenue || null,
      additionalInfo:        body.additionalInfo?.trim() || null,
    } as typeof betaApplications.$inferInsert)

    // GHL inbound webhook
    fetch('https://services.leadconnectorhq.com/hooks/KvDwmAsIEkRO0W8xkt2d/webhook-trigger/1d097ae4-ed7f-4642-9e09-2489d4cfd420', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName,
        lastName,
        title,
        companyName,
        email,
        phone,
        city,
        state,
        asmeStamps:            body.asmeStamps,
        vesselTypesFabricated: body.vesselTypesFabricated,
        vesselTypesPreferred:  body.vesselTypesPreferred,
        materials:             body.materials,
        annualRevenue:         body.annualRevenue,
        additionalInfo:        body.additionalInfo,
      }),
    }).catch((err) => console.error('[beta-application] GHL webhook error:', err))

    // Confirmation to applicant
    await sendEmail(
      email.trim(),
      'Your VesselRFQ Beta Application Was Received',
      confirmationHtml(firstName.trim()),
      `Thank you for applying for VesselRFQ beta access. We received your application and will be in touch shortly to discuss next steps. — Bret Mundt, VesselRFQ`,
    ).catch((err) => console.error('[beta-application] confirmation email failed:', err))

    // Notification to Bret
    await sendEmail(
      'bret@vesselrfq.com',
      `New Beta Application — ${companyName.trim()}`,
      notificationHtml(body),
      notificationText(body),
    ).catch((err) => console.error('[beta-application] notification email failed:', err))

    // GHL contact creation
    try {
      const ghlRes = await fetch('https://services.leadconnectorhq.com/contacts/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locationId:  process.env.GHL_LOCATION_ID,
          firstName:   firstName.trim(),
          lastName:    lastName.trim(),
          email:       email.trim().toLowerCase(),
          phone:       phone.trim(),
          companyName: companyName.trim(),
          city:        city.trim(),
          state:       state.trim(),
          source:      'VesselRFQ Beta Application',
          tags:        ['Beta Applicant', 'Fabricator'],
        }),
      })
      if (!ghlRes.ok) {
        const text = await ghlRes.text().catch(() => '')
        console.error(`[beta-application] GHL contact creation failed: ${ghlRes.status}`, text)
      } else {
        console.log(`[beta-application] GHL contact created for ${email.trim()}`)
      }
    } catch (err) {
      console.error('[beta-application] GHL contact creation error:', err)
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[beta-application]', err)
    return res.status(500).json({ error: 'Failed to save application. Please try again.' })
  }
}

function confirmationHtml(name: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="background:#0f172a;padding:28px 32px">
      <div style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px">VesselRFQ</div>
      <div style="font-size:13px;color:#94a3b8;margin-top:2px">ASME Pressure Vessel Marketplace</div>
    </div>
    <div style="padding:32px">
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1e293b">Hi ${name},</h1>
      <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.7">
        Thank you for applying for VesselRFQ beta access. We received your application and will be in touch shortly to discuss next steps.
      </p>
      <p style="margin:0;font-size:14px;color:#475569;line-height:1.8">
        — <strong>Bret Mundt</strong><br>VesselRFQ<br>
        <a href="https://vesselrfq.com" style="color:#2563eb;text-decoration:none">vesselrfq.com</a>
      </p>
    </div>
    <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0">
      <p style="margin:0;font-size:12px;color:#94a3b8">
        VesselRFQ &nbsp;·&nbsp; Questions? Reply to this email or contact <a href="mailto:bret@vesselrfq.com" style="color:#94a3b8">bret@vesselrfq.com</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

function fmtArr(arr: string[] | undefined): string {
  if (!arr || arr.length === 0) return '—'
  return arr.join(', ')
}

function notificationHtml(b: BetaPayload): string {
  const rows = [
    ['Name',                   `${b.firstName ?? ''} ${b.lastName ?? ''}`],
    ['Title',                  b.title ?? ''],
    ['Company',                b.companyName ?? ''],
    ['Email',                  b.email ?? ''],
    ['Phone',                  b.phone ?? ''],
    ['Location',               `${b.city ?? ''}, ${b.state ?? ''}`],
    ['ASME Stamps',            fmtArr(b.asmeStamps)],
    ['Vessel Types Fabricated',fmtArr(b.vesselTypesFabricated)],
    ['Preferred to Quote',     fmtArr(b.vesselTypesPreferred)],
    ['Materials',              fmtArr(b.materials)],
    ['Annual Revenue',         b.annualRevenue || '—'],
    ['Additional Info',        b.additionalInfo || '—'],
  ].map(([label, value]) => `
    <tr>
      <td style="padding:7px 14px;font-size:13px;color:#64748b;white-space:nowrap;border-bottom:1px solid #e2e8f0">${label}</td>
      <td style="padding:7px 14px;font-size:13px;color:#1e293b;border-bottom:1px solid #e2e8f0">${value}</td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="background:#0f172a;padding:20px 32px">
      <div style="font-size:16px;font-weight:700;color:#ffffff">New Beta Application — ${b.companyName ?? ''}</div>
    </div>
    <div style="padding:24px 32px">
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>
</body>
</html>`
}

function notificationText(b: BetaPayload): string {
  return `New Beta Application — ${b.companyName ?? ''}

Name: ${b.firstName ?? ''} ${b.lastName ?? ''}
Title: ${b.title ?? ''}
Company: ${b.companyName ?? ''}
Email: ${b.email ?? ''}
Phone: ${b.phone ?? ''}
Location: ${b.city ?? ''}, ${b.state ?? ''}
ASME Stamps: ${fmtArr(b.asmeStamps)}
Vessel Types Fabricated: ${fmtArr(b.vesselTypesFabricated)}
Preferred to Quote: ${fmtArr(b.vesselTypesPreferred)}
Materials: ${fmtArr(b.materials)}
Annual Revenue: ${b.annualRevenue || '—'}
Additional Info: ${b.additionalInfo || '—'}`
}
