import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth } from '../_lib/auth.js'
import { sendEmail } from '../_lib/email.js'

function htmlEscape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const auth = await requireAuth(req, res)
    if (!auth) return
    if (auth.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })

    const { to, subject, body } = req.body as { to?: string; subject?: string; body?: string }

    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'to, subject, and body are required' })
    }

    const escapedBody = htmlEscape(body)
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="background:#0f172a;padding:20px 32px">
      <div style="font-size:16px;font-weight:700;color:#ffffff">VesselRFQ</div>
    </div>
    <div style="padding:32px">
      <div style="font-size:14px;color:#1e293b;line-height:1.7;white-space:pre-wrap">${escapedBody}</div>
    </div>
    <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0">
      <p style="margin:0;font-size:12px;color:#94a3b8">VesselRFQ &nbsp;·&nbsp; ASME Pressure Vessel Marketplace</p>
    </div>
  </div>
</body>
</html>`

    await sendEmail(to, subject, html, body)

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[admin/email-buyer]', err)
    return res.status(500).json({ error: (err as Error).message ?? 'Internal server error' })
  }
}
