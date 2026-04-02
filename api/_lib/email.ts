import Mailgun from 'mailgun.js'
import FormData from 'form-data'

const mg = new Mailgun(FormData)
const client = mg.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY ?? '',
  url: 'https://api.mailgun.net',
})

const FROM = 'VesselRFQ <rfqs@vesselrfq.com>'
const REPLY_TO = 'rfqs@vesselrfq.com'
const DOMAIN = process.env.MAILGUN_DOMAIN ?? 'mg.vesselrfq.com'

export async function sendEmail(to: string, subject: string, html: string, text?: string) {
  await client.messages.create(DOMAIN, {
    from: FROM,
    to,
    subject,
    html,
    'h:Reply-To': REPLY_TO,
    ...(text ? { text } : {}),
  })
}

// ─── Fabricator onboarding email ─────────────────────────────────────────────

function firstName(email: string): string {
  const local = email.split('@')[0] ?? ''
  if (!local || !/^[a-zA-Z]/.test(local)) return 'there'
  return local.charAt(0).toUpperCase() + local.slice(1).toLowerCase()
}

export function fabricatorOnboardingText(userId: number, email: string): string {
  const name = firstName(email)
  const embedSrc = `https://vesselrfq.com/app/embed?shop=${userId}`
  const iframeSnippet = `<iframe src="${embedSrc}" width="100%" height="900" frameborder="0" style="border:none;"></iframe>`
  return `Hi ${name},

Your VesselRFQ account is active. Here's everything you need to get your vessel configurator live on your website.

YOUR DASHBOARD
You can access your RFQ dashboard at any time here:
https://vesselrfq.com/app/fabricator-dashboard

Log in with the email and password you used to register.

YOUR CONFIGURATOR EMBED
To add the vessel configurator to your website, paste the following code into any page on your site where you want the configurator to appear:

${iframeSnippet}

Replace the page content around it with whatever heading or instructions you want your customers to see.

NEED HELP?
If you have any questions about installation or your account, reply to this email and we'll get back to you within one business day.

Welcome aboard.

Bret Mundt
VesselRFQ
vesselrfq.com`
}

export function fabricatorOnboardingHtml(userId: number, email: string): string {
  const name = firstName(email)
  const dashboardUrl = 'https://vesselrfq.com/app/fabricator-dashboard'
  const embedSrc = `https://vesselrfq.com/app/embed?shop=${userId}`
  const iframeSnippet = `&lt;iframe src="${embedSrc}" width="100%" height="900" frameborder="0" style="border:none;"&gt;&lt;/iframe&gt;`

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
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1e293b">Hi ${name},</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6">
        Your VesselRFQ account is active. Here's everything you need to get your vessel configurator live on your website.
      </p>

      <!-- Dashboard -->
      <h2 style="margin:0 0 8px;font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.07em">Your Dashboard</h2>
      <p style="margin:0 0 8px;font-size:14px;color:#475569;line-height:1.6">
        You can access your RFQ dashboard at any time here:
      </p>
      <p style="margin:0 0 24px">
        <a href="${dashboardUrl}" style="color:#2563eb;font-size:14px;text-decoration:none;font-weight:500">${dashboardUrl}</a>
      </p>
      <p style="margin:0 0 32px;font-size:13px;color:#94a3b8">Log in with the email and password you used to register.</p>

      <!-- Embed -->
      <h2 style="margin:0 0 8px;font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.07em">Your Configurator Embed</h2>
      <p style="margin:0 0 12px;font-size:14px;color:#475569;line-height:1.6">
        To add the vessel configurator to your website, paste the following code into any page where you want the configurator to appear:
      </p>
      <div style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;margin:0 0 12px;overflow-x:auto">
        <code style="font-family:'Courier New',Courier,monospace;font-size:12px;color:#1e293b;white-space:pre-wrap;word-break:break-all">${iframeSnippet}</code>
      </div>
      <p style="margin:0 0 32px;font-size:13px;color:#94a3b8">Replace the page content around it with whatever heading or instructions you want your customers to see.</p>

      <!-- Help -->
      <div style="padding:16px;background:#f0fdf4;border-left:4px solid #22c55e;border-radius:0 8px 8px 0;margin:0 0 32px">
        <p style="margin:0;font-size:13px;color:#166534;line-height:1.6">
          <strong>Need help?</strong><br>
          If you have any questions about installation or your account, reply to this email and we'll get back to you within one business day.
        </p>
      </div>

      <p style="margin:0;font-size:14px;color:#475569;line-height:1.8">
        Welcome aboard.<br><br>
        <strong>Bret Mundt</strong><br>
        VesselRFQ<br>
        <a href="https://vesselrfq.com" style="color:#2563eb;text-decoration:none">vesselrfq.com</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0">
      <p style="margin:0;font-size:12px;color:#94a3b8">
        VesselRFQ &nbsp;·&nbsp; ASME Pressure Vessel Marketplace<br>
        You are receiving this because you created a fabricator account at vesselrfq.com.
      </p>
    </div>
  </div>
</body>
</html>`
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

export function buyerConfirmationText(p: RfqEmailParams): string {
  const isTank = p.vesselType === 'tank'
  const temaCode = (!isTank && p.temaFront && p.temaShell && p.temaRear)
    ? `${p.temaFront}-${p.temaShell}-${p.temaRear}`
    : null

  const specs: string[] = isTank
    ? [
        p.shellOd            ? `Shell OD: ${p.shellOd}"` : '',
        p.shellLength        ? `Shell Length: ${p.shellLength}"` : '',
        p.shellMaterial      ? `Shell Material: ${p.shellMaterial}` : '',
        p.headType           ? `Head Type: ${p.headType}` : '',
        p.mawp               ? `MAWP: ${p.mawp} psig` : '',
        p.designTemp != null ? `Design Temp: ${p.designTemp}°F` : '',
        p.corrosionAllowance ? `Corrosion Allowance: ${p.corrosionAllowance}"` : '',
        p.supportType        ? `Supports: ${p.supportType}` : '',
        p.nozzleCount        ? `Nozzles: ${p.nozzleCount}` : '',
      ].filter(Boolean)
    : [
        temaCode             ? `TEMA Designation: ${temaCode}` : '',
        p.shellOd            ? `Shell OD: ${p.shellOd}"` : '',
        p.shellLength        ? `Shell Length: ${p.shellLength}"` : '',
        p.shellMaterial      ? `Shell Material: ${p.shellMaterial}` : '',
        p.tubeCount          ? `Tube Count: ${p.tubeCount}` : '',
        p.tubeOd             ? `Tube OD: ${p.tubeOd}"` : '',
        p.tubeBwg            ? `Tube BWG: ${p.tubeBwg}` : '',
        p.tubeLength         ? `Tube Length: ${p.tubeLength}'` : '',
        p.shellMawp          ? `Shell MAWP: ${p.shellMawp} psig` : '',
        p.shellDesignTemp != null ? `Shell Design Temp: ${p.shellDesignTemp}°F` : '',
        p.tubeMawp           ? `Tube MAWP: ${p.tubeMawp} psig` : '',
        p.tubeDesignTemp != null  ? `Tube Design Temp: ${p.tubeDesignTemp}°F` : '',
        p.nozzleCount        ? `Nozzles: ${p.nozzleCount}` : '',
      ].filter(Boolean)

  return `RFQ Received — ${p.title}
RFQ #${p.rfqId} · ${isTank ? 'Pressure Vessel' : 'Heat Exchanger'}

Your RFQ has been submitted to the VesselRFQ marketplace. Qualified ASME fabricators in your region will receive your specifications and submit quotes. You can expect to hear back within 5–7 business days.

SPECIFICATIONS SUMMARY
${specs.join('\n')}${p.notes ? `\n\nRemarks: ${p.notes}` : ''}

WHAT HAPPENS NEXT?
Your RFQ will be routed to a maximum of 3 qualified fabricators with protected territories in your region. Each fabricator receives your full specifications and will contact you directly to discuss scope and pricing.

Questions? Reply to this email or contact us at rfqs@vesselrfq.com.

VesselRFQ · ASME Pressure Vessel Marketplace
vesselrfq.com`
}

export function adminNotificationText(p: RfqEmailParams): string {
  const isTank = p.vesselType === 'tank'
  const temaCode = (!isTank && p.temaFront && p.temaShell && p.temaRear)
    ? `${p.temaFront}-${p.temaShell}-${p.temaRear}`
    : null

  const specs: string[] = isTank
    ? [
        `Vessel Type: Pressure Vessel / Tank`,
        p.shellOd            ? `Shell OD: ${p.shellOd}"` : '',
        p.shellLength        ? `Shell Length: ${p.shellLength}"` : '',
        p.shellMaterial      ? `Shell Material: ${p.shellMaterial}` : '',
        p.headType           ? `Head Type: ${p.headType}` : '',
        p.mawp               ? `MAWP: ${p.mawp} psig` : '',
        p.designTemp != null ? `Design Temp: ${p.designTemp}°F` : '',
        p.corrosionAllowance ? `Corrosion Allowance: ${p.corrosionAllowance}"` : '',
        p.supportType        ? `Supports: ${p.supportType}` : '',
        `Nozzle Count: ${p.nozzleCount}`,
        p.notes              ? `Notes: ${p.notes}` : '',
      ].filter(Boolean)
    : [
        `Vessel Type: Heat Exchanger`,
        temaCode             ? `TEMA Designation: ${temaCode}` : '',
        p.shellOd            ? `Shell OD: ${p.shellOd}"` : '',
        p.shellLength        ? `Shell Length: ${p.shellLength}"` : '',
        p.shellMaterial      ? `Shell Material: ${p.shellMaterial}` : '',
        p.tubeCount          ? `Tube Count: ${p.tubeCount}` : '',
        p.tubeOd             ? `Tube OD: ${p.tubeOd}"` : '',
        p.tubeBwg            ? `Tube BWG: ${p.tubeBwg}` : '',
        p.tubeLength         ? `Tube Length: ${p.tubeLength}'` : '',
        p.shellMawp          ? `Shell MAWP: ${p.shellMawp} psig` : '',
        p.shellDesignTemp != null ? `Shell Design Temp: ${p.shellDesignTemp}°F` : '',
        p.tubeMawp           ? `Tube MAWP: ${p.tubeMawp} psig` : '',
        p.tubeDesignTemp != null  ? `Tube Design Temp: ${p.tubeDesignTemp}°F` : '',
        `Nozzle Count: ${p.nozzleCount}`,
        p.notes              ? `Notes: ${p.notes}` : '',
      ].filter(Boolean)

  return `New RFQ Submitted — VesselRFQ

${p.title}
RFQ #${p.rfqId} · Buyer: ${p.buyerEmail}

${specs.join('\n')}`
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
