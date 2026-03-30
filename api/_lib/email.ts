import Mailgun from 'mailgun.js'
import FormData from 'form-data'

const mg = new Mailgun(FormData)
const client = mg.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY ?? '',
  url: 'https://api.mailgun.net',
})

const FROM = 'VesselRFQ <rfqs@vesselrfq.com>'
const DOMAIN = process.env.MAILGUN_DOMAIN ?? 'vesselrfq.com'

export async function sendEmail(to: string, subject: string, html: string) {
  await client.messages.create(DOMAIN, { from: FROM, to, subject, html })
}

export interface RfqEmailParams {
  rfqId: number
  title: string
  vesselType: 'tank' | 'heat_exchanger'
  buyerEmail: string

  // Tank
  shellOd?: string | null
  shellLength?: string | null
  shellMaterial?: string | null
  headType?: string | null
  mawp?: string | null
  designTemp?: number | null
  corrosionAllowance?: string | null
  supportType?: string | null

  // HX
  temaFront?: string | null
  temaShell?: string | null
  temaRear?: string | null
  tubeCount?: number | null
  tubeOd?: string | null
  tubeBwg?: string | null
  tubeLength?: string | null
  shellMawp?: string | null
  shellDesignTemp?: number | null
  tubeMawp?: string | null
  tubeDesignTemp?: number | null

  nozzleCount: number
  notes?: string | null
}

function row(label: string, value: string | number | null | undefined) {
  if (!value && value !== 0) return ''
  return `
    <tr>
      <td style="padding:6px 12px;color:#64748b;font-size:13px;white-space:nowrap">${label}</td>
      <td style="padding:6px 12px;color:#1e293b;font-size:13px;font-weight:500">${value}</td>
    </tr>`
}

function tableWrap(rows: string) {
  return `
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin:16px 0">
      <tbody>${rows}</tbody>
    </table>`
}

export function buyerConfirmationHtml(p: RfqEmailParams): string {
  const isTank = p.vesselType === 'tank'
  const temaCode = (!isTank && p.temaFront && p.temaShell && p.temaRear)
    ? `${p.temaFront}-${p.temaShell}-${p.temaRear}`
    : null

  const specsRows = isTank
    ? [
        row('Shell OD', p.shellOd ? `${p.shellOd}"` : null),
        row('Shell Length', p.shellLength ? `${p.shellLength}"` : null),
        row('Shell Material', p.shellMaterial),
        row('Head Type', p.headType),
        row('MAWP', p.mawp ? `${p.mawp} psig` : null),
        row('Design Temp', p.designTemp != null ? `${p.designTemp}°F` : null),
        row('Corrosion Allowance', p.corrosionAllowance ? `${p.corrosionAllowance}"` : null),
        row('Supports', p.supportType),
        row('Nozzles', p.nozzleCount || null),
      ].join('')
    : [
        row('TEMA Designation', temaCode),
        row('Shell OD', p.shellOd ? `${p.shellOd}"` : null),
        row('Shell Length', p.shellLength ? `${p.shellLength}"` : null),
        row('Shell Material', p.shellMaterial),
        row('Tube Count', p.tubeCount),
        row('Tube OD', p.tubeOd ? `${p.tubeOd}"` : null),
        row('Tube BWG', p.tubeBwg),
        row('Tube Length', p.tubeLength ? `${p.tubeLength}'` : null),
        row('Shell MAWP', p.shellMawp ? `${p.shellMawp} psig` : null),
        row('Shell Design Temp', p.shellDesignTemp != null ? `${p.shellDesignTemp}°F` : null),
        row('Tube MAWP', p.tubeMawp ? `${p.tubeMawp} psig` : null),
        row('Tube Design Temp', p.tubeDesignTemp != null ? `${p.tubeDesignTemp}°F` : null),
        row('Nozzles', p.nozzleCount || null),
      ].join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">

    <!-- Header -->
    <div style="background:#0f172a;padding:28px 32px">
      <div style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px">VesselRFQ</div>
      <div style="font-size:13px;color:#94a3b8;margin-top:2px">ASME Pressure Vessel Marketplace</div>
    </div>

    <!-- Body -->
    <div style="padding:32px">
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1e293b">RFQ Received</h1>
      <p style="margin:0 0 4px;font-size:15px;color:#475569">${p.title}</p>
      <p style="margin:0 0 24px;font-size:13px;color:#94a3b8">RFQ #${p.rfqId} &nbsp;·&nbsp; ${isTank ? 'Pressure Vessel' : 'Heat Exchanger'}</p>

      <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6">
        Your RFQ has been submitted to the VesselRFQ marketplace. Qualified ASME fabricators
        in your region will receive your specifications and submit quotes. You can expect to
        hear back within <strong>5–7 business days</strong>.
      </p>

      <h2 style="margin:24px 0 0;font-size:14px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Specifications Summary</h2>
      ${tableWrap(specsRows)}

      ${p.notes ? `<p style="margin:16px 0 0;font-size:13px;color:#64748b"><strong>Remarks:</strong> ${p.notes}</p>` : ''}

      <!-- Info box -->
      <div style="margin:24px 0 0;padding:16px;background:#eff6ff;border-left:4px solid #3b82f6;border-radius:0 8px 8px 0">
        <p style="margin:0;font-size:13px;color:#1e40af;line-height:1.6">
          <strong>What happens next?</strong><br>
          Your RFQ will be routed to a maximum of 3 qualified fabricators with
          protected territories in your region. Each fabricator receives your full
          specifications and will contact you directly to discuss scope and pricing.
        </p>
      </div>

      <p style="margin:24px 0 0;font-size:13px;color:#94a3b8">
        Questions? Reply to this email or contact us at
        <a href="mailto:rfqs@vesselrfq.com" style="color:#3b82f6;text-decoration:none">rfqs@vesselrfq.com</a>.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0">
      <p style="margin:0;font-size:12px;color:#94a3b8">
        VesselRFQ &nbsp;·&nbsp; ASME Pressure Vessel Marketplace<br>
        You are receiving this because you submitted an RFQ at vesselrfq.com.
      </p>
    </div>
  </div>
</body>
</html>`
}

export function adminNotificationHtml(p: RfqEmailParams): string {
  const isTank = p.vesselType === 'tank'
  const temaCode = (!isTank && p.temaFront && p.temaShell && p.temaRear)
    ? `${p.temaFront}-${p.temaShell}-${p.temaRear}`
    : null

  const specsRows = isTank
    ? [
        row('Vessel Type', 'Pressure Vessel / Tank'),
        row('Shell OD', p.shellOd ? `${p.shellOd}"` : null),
        row('Shell Length', p.shellLength ? `${p.shellLength}"` : null),
        row('Shell Material', p.shellMaterial),
        row('Head Type', p.headType),
        row('MAWP', p.mawp ? `${p.mawp} psig` : null),
        row('Design Temp', p.designTemp != null ? `${p.designTemp}°F` : null),
        row('Corrosion Allowance', p.corrosionAllowance ? `${p.corrosionAllowance}"` : null),
        row('Supports', p.supportType),
        row('Nozzle Count', p.nozzleCount),
        row('Notes', p.notes),
      ].join('')
    : [
        row('Vessel Type', 'Heat Exchanger'),
        row('TEMA Designation', temaCode),
        row('Shell OD', p.shellOd ? `${p.shellOd}"` : null),
        row('Shell Length', p.shellLength ? `${p.shellLength}"` : null),
        row('Shell Material', p.shellMaterial),
        row('Tube Count', p.tubeCount),
        row('Tube OD', p.tubeOd ? `${p.tubeOd}"` : null),
        row('Tube BWG', p.tubeBwg),
        row('Tube Length', p.tubeLength ? `${p.tubeLength}'` : null),
        row('Shell MAWP', p.shellMawp ? `${p.shellMawp} psig` : null),
        row('Shell Design Temp', p.shellDesignTemp != null ? `${p.shellDesignTemp}°F` : null),
        row('Tube MAWP', p.tubeMawp ? `${p.tubeMawp} psig` : null),
        row('Tube Design Temp', p.tubeDesignTemp != null ? `${p.tubeDesignTemp}°F` : null),
        row('Nozzle Count', p.nozzleCount),
        row('Notes', p.notes),
      ].join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="background:#0f172a;padding:20px 32px">
      <div style="font-size:16px;font-weight:700;color:#ffffff">New RFQ Submitted — VesselRFQ</div>
    </div>
    <div style="padding:24px 32px">
      <h2 style="margin:0 0 4px;font-size:18px;font-weight:700;color:#1e293b">${p.title}</h2>
      <p style="margin:0 0 20px;font-size:13px;color:#64748b">RFQ #${p.rfqId} &nbsp;·&nbsp; Buyer: ${p.buyerEmail}</p>
      ${tableWrap(specsRows)}
    </div>
  </div>
</body>
</html>`
}
