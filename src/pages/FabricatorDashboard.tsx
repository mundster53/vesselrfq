import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

type RfqStatus = 'received' | 'reviewed' | 'quoted' | 'awarded'
type FilterState = RfqStatus | 'all'

interface NozzleItem {
  mark: string
  size: string
  rating: string | null
  flangeType: string | null
  facing: string | null
  material: string | null
  service: string | null
  quantity: number
  location: string | null
}

interface Buyer {
  initials: string
  name: string
  company: string
  email: string
}

interface RfqRecord {
  id: string
  vesselType: string
  shellId: string
  ttLength: string
  orientation: string
  headType: string
  supportType: string
  designPressure: string
  designTemp: string
  material: string
  corrosionAllowance: string
  service: string
  nozzles: NozzleItem[]
  buyer: Buyer
  status: RfqStatus
  dateReceived: string
  quoteAmount: string
  // Painting
  surfacePrep: string | null
  primer: string | null
  topcoat: string | null
  finishType: string | null
  // Insulation
  insulated: boolean | null
  insulationType: string | null
  insulationThickness: string | null
  insulationJacket: string | null
  insulationShell: boolean | null
  insulationHeads: boolean | null
  // Coils
  internalCoil: boolean | null
  internalCoilPipeSize: string | null
  internalCoilTurns: number | null
  externalCoil: boolean | null
  externalCoilType: string | null
  externalCoilPipeSize: string | null
  externalCoilCoverage: string | null
}

interface SpecItem {
  label: string
  value: string
  fullWidth?: boolean
}

// ── API types ─────────────────────────────────────────────────────────────────

interface ApiNozzle {
  id: number
  rfqId: number
  mark: string
  size: string
  rating: string
  flangeType: string
  facing: string
  material: string
  service: string | null
  quantity: number
  location: string
}

interface ApiRfq {
  id: number
  title: string
  status: string
  vesselType: string | null
  shellOd: string | null
  shellLength: string | null
  shellMaterial: string | null
  headType: string | null
  mawp: string | null
  designTemp: number | null
  corrosionAllowance: string | null
  orientation: string | null
  supportType: string | null
  createdAt: string
  buyerEmail: string
  nozzles: ApiNozzle[]
  // Painting
  surfacePrep: string | null
  primer: string | null
  topcoat: string | null
  finishType: string | null
  // Insulation
  insulated: boolean | null
  insulationType: string | null
  insulationThickness: string | null
  insulationJacket: string | null
  insulationShell: boolean | null
  insulationHeads: boolean | null
  // Coils
  internalCoil: boolean | null
  internalCoilPipeSize: string | null
  internalCoilTurns: number | null
  externalCoil: boolean | null
  externalCoilType: string | null
  externalCoilPipeSize: string | null
  externalCoilCoverage: string | null
}

// ── Mapping helpers ───────────────────────────────────────────────────────────

function mapDbStatus(s: string): RfqStatus {
  if (s === 'quoted')  return 'quoted'
  if (s === 'awarded') return 'awarded'
  return 'received'
}

function fmtReceived(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function buyerInitials(email: string): string {
  return email.charAt(0).toUpperCase()
}

function mapApiRfq(r: ApiRfq): RfqRecord {
  return {
    id: `RFQ-${r.id}`,
    vesselType: r.vesselType === 'heat_exchanger' ? 'Heat Exchanger' : 'Pressure Vessel',
    shellId:           r.shellOd        ? `${r.shellOd}"` : '—',
    ttLength:          r.shellLength    ? `${r.shellLength}"` : '—',
    orientation:       r.orientation   ?? '—',
    headType:          r.headType      ?? '—',
    supportType:       r.supportType   ?? '—',
    designPressure:    r.mawp          ? `${r.mawp} PSI` : '—',
    designTemp:        r.designTemp    ? `${r.designTemp}°F` : '—',
    material:          r.shellMaterial ?? '—',
    corrosionAllowance: r.corrosionAllowance ? `${r.corrosionAllowance}"` : '—',
    service: '—',
    nozzles: r.nozzles.map(n => ({
      mark:      n.mark,
      size:      n.size,
      rating:    n.rating,
      flangeType: n.flangeType,
      facing:    n.facing,
      material:  n.material,
      service:   n.service,
      quantity:  n.quantity,
      location:  n.location,
    })),
    buyer: {
      initials: buyerInitials(r.buyerEmail),
      name:     r.buyerEmail,
      company:  '',
      email:    r.buyerEmail,
    },
    status:       mapDbStatus(r.status),
    dateReceived: fmtReceived(r.createdAt),
    quoteAmount:  '',
    surfacePrep:         r.surfacePrep,
    primer:              r.primer,
    topcoat:             r.topcoat,
    finishType:          r.finishType,
    insulated:           r.insulated,
    insulationType:      r.insulationType,
    insulationThickness: r.insulationThickness,
    insulationJacket:    r.insulationJacket,
    insulationShell:     r.insulationShell,
    insulationHeads:     r.insulationHeads,
    internalCoil:         r.internalCoil,
    internalCoilPipeSize: r.internalCoilPipeSize,
    internalCoilTurns:    r.internalCoilTurns,
    externalCoil:         r.externalCoil,
    externalCoilType:     r.externalCoilType,
    externalCoilPipeSize: r.externalCoilPipeSize,
    externalCoilCoverage: r.externalCoilCoverage,
  }
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<RfqStatus, { label: string; bg: string; color: string; border: string }> = {
  received: { label: 'Received', bg: '#1e293b', color: '#94a3b8', border: '#334155' },
  reviewed: { label: 'Reviewed', bg: '#1e3a5f', color: '#93c5fd', border: '#1d4ed8' },
  quoted:   { label: 'Quoted',   bg: '#2d1b69', color: '#c4b5fd', border: '#7c3aed' },
  awarded:  { label: 'Awarded',  bg: '#052e16', color: '#86efac', border: '#16a34a' },
}

// ── Filter options ────────────────────────────────────────────────────────────

const FILTER_OPTIONS: { value: FilterState; label: string }[] = [
  { value: 'all',      label: 'All' },
  { value: 'received', label: 'Received' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'quoted',   label: 'Quoted' },
  { value: 'awarded',  label: 'Awarded' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCurrency(val: string): string {
  const n = parseFloat(val.replace(/[$,]/g, ''))
  if (isNaN(n)) return '—'
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function StatusBadge({ status }: { status: RfqStatus }) {
  const c = STATUS_CFG[status]
  return (
    <span style={{
      background: c.bg,
      color: c.color,
      border: `1px solid ${c.border}`,
      borderRadius: 20,
      padding: '2px 8px',
      fontSize: 10,
      fontWeight: 500,
      whiteSpace: 'nowrap',
    }}>
      {c.label}
    </span>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: '#1e293b',
      border: '0.5px solid #334155',
      borderRadius: 8,
      padding: '10px 14px',
    }}>
      <div style={{ fontSize: 20, fontWeight: 600, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{label}</div>
    </div>
  )
}

function Th({ children, align = 'left' }: { children: ReactNode; align?: 'left' | 'right' }) {
  return (
    <th style={{
      padding: '8px 16px',
      textAlign: align,
      fontSize: 10,
      fontWeight: 500,
      color: '#475569',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      background: '#0f172a',
      position: 'sticky',
      top: 0,
      zIndex: 1,
      borderBottom: '0.5px solid #1e293b',
    }}>
      {children}
    </th>
  )
}

function NTh({ children }: { children: ReactNode }) {
  return (
    <th style={{
      padding: '4px 8px',
      textAlign: 'left',
      fontSize: 10,
      fontWeight: 500,
      color: '#475569',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      borderBottom: '0.5px solid #334155',
    }}>
      {children}
    </th>
  )
}

function Section({ label, children, noDivider }: { label: string; children: ReactNode; noDivider?: boolean }) {
  return (
    <div style={{
      padding: '16px 20px',
      borderBottom: noDivider ? 'none' : '0.5px solid #334155',
    }}>
      <div style={{
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: '#475569',
        marginBottom: 12,
      }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function SpecGrid({ items }: { items: SpecItem[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
      {items.map(item => (
        <div
          key={item.label}
          style={{
            gridColumn: item.fullWidth ? '1 / -1' : undefined,
            background: '#0f172a',
            border: '0.5px solid #334155',
            borderRadius: 6,
            padding: '7px 10px',
          }}
        >
          <div style={{ fontSize: 10, color: '#475569', marginBottom: 3 }}>{item.label}</div>
          <div style={{ fontSize: 12, color: '#f1f5f9', fontWeight: 500 }}>{item.value}</div>
        </div>
      ))}
    </div>
  )
}

// ── PDF export ────────────────────────────────────────────────────────────────

function printRfq(rfq: RfqRecord) {
  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) return
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  const specRow = (label: string, value: string) =>
    `<tr><td class="spec-label">${label}</td><td class="spec-value">${value}</td></tr>`

  const nozzleRows = rfq.nozzles.map((n, i) =>
    `<tr class="${i % 2 === 0 ? 'even' : ''}">
      <td>${n.mark}</td><td>${n.size}</td><td>${n.rating || '—'}</td><td>${n.quantity}</td><td>${n.flangeType || '—'}</td><td>${n.facing || '—'}</td><td>${n.material || '—'}</td><td>${(n.location || '—').replace('_', ' ')}</td><td>${n.service || '—'}</td>
    </tr>`
  ).join('')

  w.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${rfq.id} — VesselRFQ</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1e293b; background: #fff; padding: 40px 48px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1e293b; padding-bottom: 16px; margin-bottom: 24px; }
  .logo { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
  .logo span { color: #2563eb; }
  .logo-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
  .rfq-meta { text-align: right; }
  .rfq-num { font-size: 18px; font-weight: 700; color: #1e293b; }
  .rfq-type { font-size: 12px; color: #64748b; margin-top: 2px; }
  .rfq-title { font-size: 15px; font-weight: 600; color: #1e293b; margin: 0 0 4px; }
  h2 { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: #64748b; margin: 20px 0 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; }
  .spec-table .spec-label { width: 180px; color: #64748b; font-size: 12px; padding: 5px 8px 5px 0; vertical-align: top; }
  .spec-table .spec-value { font-weight: 500; color: #1e293b; font-size: 12px; padding: 5px 0; }
  .nozzle-table th { text-align: left; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; padding: 6px 10px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
  .nozzle-table td { padding: 6px 10px; color: #1e293b; font-size: 12px; }
  .nozzle-table tr.even td { background: #f8fafc; }
  .buyer-block { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; }
  .buyer-field { font-size: 12px; color: #1e293b; padding: 3px 0; }
  .buyer-label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; }
  .footer { margin-top: 48px; padding-top: 12px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }
  @media print {
    body { padding: 24px 32px; }
    @page { margin: 0.75in; size: letter portrait; }
  }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">Vessel<span>RFQ</span></div>
      <div class="logo-sub">ASME Pressure Vessel Marketplace</div>
    </div>
    <div class="rfq-meta">
      <div class="rfq-num">${rfq.id}</div>
      <div class="rfq-type">${rfq.vesselType}</div>
      <div class="rfq-type" style="margin-top:4px">Received ${rfq.dateReceived}</div>
    </div>
  </div>

  <div class="rfq-title">${rfq.id} — ${rfq.vesselType}</div>

  <h2>Buyer</h2>
  <div class="buyer-block">
    <div>
      <div class="buyer-label">Name / Email</div>
      <div class="buyer-field">${rfq.buyer.name}</div>
    </div>
    <div>
      <div class="buyer-label">Company</div>
      <div class="buyer-field">${rfq.buyer.company || '—'}</div>
    </div>
  </div>

  <h2>Vessel Geometry</h2>
  <table class="spec-table">
    ${specRow('Shell OD', rfq.shellId)}
    ${specRow('T/T Length', rfq.ttLength)}
    ${specRow('Vessel Type', rfq.vesselType)}
    ${specRow('Orientation', rfq.orientation)}
    ${specRow('Head Type', rfq.headType)}
    ${specRow('Support Type', rfq.supportType)}
  </table>

  <h2>Design Conditions</h2>
  <table class="spec-table">
    ${specRow('Design Pressure', rfq.designPressure)}
    ${specRow('Design Temp', rfq.designTemp)}
    ${specRow('Shell Material', rfq.material)}
    ${specRow('Corrosion Allowance', rfq.corrosionAllowance)}
  </table>

  <h2>Nozzle Schedule</h2>
  <table class="nozzle-table">
    <thead><tr><th>Mark</th><th>Size</th><th>Rating</th><th>Qty</th><th>Flange Type</th><th>Facing</th><th>Material</th><th>Location</th><th>Service</th></tr></thead>
    <tbody>${nozzleRows || '<tr><td colspan="9" style="color:#94a3b8;padding:8px 10px">No nozzles specified</td></tr>'}</tbody>
  </table>

  ${(rfq.surfacePrep || rfq.primer || rfq.topcoat || rfq.finishType) ? `
  <h2>Painting &amp; Surface Prep</h2>
  <table class="spec-table">
    ${rfq.surfacePrep  ? specRow('Surface Prep', rfq.surfacePrep)  : ''}
    ${rfq.primer       ? specRow('Primer',        rfq.primer)       : ''}
    ${rfq.topcoat      ? specRow('Topcoat',       rfq.topcoat)      : ''}
    ${rfq.finishType   ? specRow('Finish',         rfq.finishType)   : ''}
  </table>` : ''}

  ${rfq.insulated ? `
  <h2>Insulation</h2>
  <table class="spec-table">
    ${rfq.insulationType      ? specRow('Type',      rfq.insulationType)      : ''}
    ${rfq.insulationThickness ? specRow('Thickness', rfq.insulationThickness) : ''}
    ${rfq.insulationJacket    ? specRow('Jacket',    rfq.insulationJacket)    : ''}
    ${rfq.insulationShell != null ? specRow('Shell', rfq.insulationShell ? 'Yes' : 'No') : ''}
    ${rfq.insulationHeads != null ? specRow('Heads', rfq.insulationHeads ? 'Yes' : 'No') : ''}
  </table>` : ''}

  ${(rfq.internalCoil || rfq.externalCoil) ? `
  <h2>Coils</h2>
  <table class="spec-table">
    ${rfq.internalCoil ? specRow('Internal Coil', 'Yes') : ''}
    ${rfq.internalCoilPipeSize ? specRow('Int. Pipe Size', rfq.internalCoilPipeSize) : ''}
    ${rfq.internalCoilTurns != null ? specRow('Int. Turns', String(rfq.internalCoilTurns)) : ''}
    ${rfq.externalCoil ? specRow('External Coil', 'Yes') : ''}
    ${rfq.externalCoilType ? specRow('Ext. Type', rfq.externalCoilType) : ''}
    ${rfq.externalCoilPipeSize ? specRow('Ext. Pipe Size', rfq.externalCoilPipeSize) : ''}
    ${rfq.externalCoilCoverage ? specRow('Ext. Coverage', rfq.externalCoilCoverage) : ''}
  </table>` : ''}

  <div class="footer">
    <span>VesselRFQ &nbsp;·&nbsp; vesselrfq.com &nbsp;·&nbsp; ASME Pressure Vessel Marketplace</span>
    <span>Generated ${today}</span>
  </div>
</body>
</html>`)
  w.document.close()
  w.focus()
  setTimeout(() => { w.print(); w.close() }, 300)
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel({
  rfq,
  onClose,
  onUpdate,
}: {
  rfq: RfqRecord
  onClose: () => void
  onUpdate: (patch: Partial<Pick<RfqRecord, 'status' | 'quoteAmount'>>) => void
}) {
  const [quoteInput, setQuoteInput] = useState(rfq.quoteAmount)
  const [showBomTip, setShowBomTip] = useState(false)

  const inputBase: React.CSSProperties = {
    background: '#0f172a',
    border: '0.5px solid #334155',
    borderRadius: 6,
    color: '#f1f5f9',
    fontSize: 13,
    padding: '8px 10px',
    fontFamily: 'inherit',
    outline: 'none',
  }

  return (
    <aside style={{
      width: 340,
      flexShrink: 0,
      background: '#1e293b',
      borderLeft: '0.5px solid #334155',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 20px',
        borderBottom: '0.5px solid #334155',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{rfq.id}</div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 1 }}>{rfq.vesselType}</div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close detail panel"
          style={{
            background: 'none',
            border: 'none',
            color: '#475569',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            borderRadius: 4,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Scrollable body */}
      <div style={{ overflowY: 'auto', flex: 1 }}>

        {/* Buyer */}
        <Section label="Buyer">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: '#1d4ed8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 600,
              color: '#ffffff',
              flexShrink: 0,
            }}>
              {rfq.buyer.initials}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#f1f5f9' }}>{rfq.buyer.name}</div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 1 }}>{rfq.buyer.company}</div>
              <div style={{ fontSize: 11, color: '#60a5fa', marginTop: 2 }}>{rfq.buyer.email}</div>
            </div>
          </div>
        </Section>

        {/* Vessel Geometry */}
        <Section label="Vessel Geometry">
          <SpecGrid items={[
            { label: 'Shell OD',     value: rfq.shellId },
            { label: 'T/T Length',   value: rfq.ttLength },
            { label: 'Vessel Type',  value: rfq.vesselType },
            { label: 'Orientation',  value: rfq.orientation },
            { label: 'Head Type',    value: rfq.headType },
            { label: 'Support Type', value: rfq.supportType },
          ]} />
        </Section>

        {/* Design Conditions */}
        <Section label="Design Conditions">
          <SpecGrid items={[
            { label: 'Design Pressure',  value: rfq.designPressure },
            { label: 'Design Temp',      value: rfq.designTemp },
            { label: 'Material',         value: rfq.material },
            { label: 'Corrosion Allow.', value: rfq.corrosionAllowance },
            { label: 'Service',          value: rfq.service, fullWidth: true },
          ]} />
        </Section>

        {/* Nozzle Schedule */}
        <Section label="Nozzle Schedule">
          {rfq.nozzles.length === 0 ? (
            <div style={{ fontSize: 12, color: '#475569' }}>No nozzles specified</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  <NTh>Mark</NTh>
                  <NTh>Size</NTh>
                  <NTh>Rating</NTh>
                  <NTh>Qty</NTh>
                  <NTh>Location</NTh>
                </tr>
              </thead>
              <tbody>
                {rfq.nozzles.map((n, i) => (
                  <>
                    <tr key={`${n.mark}-a`} style={{ background: i % 2 === 0 ? '#0f172a' : '#1e293b' }}>
                      <td style={{ padding: '5px 8px 2px', color: '#60a5fa', fontWeight: 500 }}>{n.mark}</td>
                      <td style={{ padding: '5px 8px 2px', color: '#cbd5e1' }}>{n.size}</td>
                      <td style={{ padding: '5px 8px 2px', color: '#cbd5e1' }}>{n.rating ?? '—'}</td>
                      <td style={{ padding: '5px 8px 2px', color: '#cbd5e1' }}>{n.quantity}</td>
                      <td style={{ padding: '5px 8px 2px', color: '#94a3b8' }}>{n.location?.replace('_', ' ') ?? '—'}</td>
                    </tr>
                    <tr key={`${n.mark}-b`} style={{ background: i % 2 === 0 ? '#0f172a' : '#1e293b' }}>
                      <td colSpan={5} style={{ padding: '0 8px 5px', color: '#475569', fontSize: 10 }}>
                        {[
                          n.flangeType ? `Flange: ${n.flangeType}` : null,
                          n.facing     ? `Facing: ${n.facing}`     : null,
                          n.material   ? `Mtl: ${n.material}`      : null,
                          n.service    ? `Svc: ${n.service}`       : null,
                        ].filter(Boolean).join(' · ') || '—'}
                      </td>
                    </tr>
                  </>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* Painting & Surface Prep */}
        {(rfq.surfacePrep || rfq.primer || rfq.topcoat || rfq.finishType) && (
          <Section label="Painting & Surface Prep">
            <SpecGrid items={[
              ...(rfq.surfacePrep  ? [{ label: 'Surface Prep', value: rfq.surfacePrep }]  : []),
              ...(rfq.primer       ? [{ label: 'Primer',       value: rfq.primer }]       : []),
              ...(rfq.topcoat      ? [{ label: 'Topcoat',      value: rfq.topcoat }]      : []),
              ...(rfq.finishType   ? [{ label: 'Finish',       value: rfq.finishType }]   : []),
            ]} />
          </Section>
        )}

        {/* Insulation */}
        {rfq.insulated && (
          <Section label="Insulation">
            <SpecGrid items={[
              ...(rfq.insulationType      ? [{ label: 'Type',      value: rfq.insulationType }]      : []),
              ...(rfq.insulationThickness ? [{ label: 'Thickness', value: rfq.insulationThickness }] : []),
              ...(rfq.insulationJacket    ? [{ label: 'Jacket',    value: rfq.insulationJacket }]    : []),
              ...(rfq.insulationShell != null ? [{ label: 'Shell', value: rfq.insulationShell ? 'Yes' : 'No' }] : []),
              ...(rfq.insulationHeads != null ? [{ label: 'Heads', value: rfq.insulationHeads ? 'Yes' : 'No' }] : []),
            ]} />
          </Section>
        )}

        {/* Coils */}
        {(rfq.internalCoil || rfq.externalCoil) && (
          <Section label="Coils">
            <SpecGrid items={[
              ...(rfq.internalCoil ? [{ label: 'Internal Coil', value: 'Yes' }] : []),
              ...(rfq.internalCoilPipeSize ? [{ label: 'Int. Pipe Size', value: rfq.internalCoilPipeSize }] : []),
              ...(rfq.internalCoilTurns != null ? [{ label: 'Int. Turns', value: String(rfq.internalCoilTurns) }] : []),
              ...(rfq.externalCoil ? [{ label: 'External Coil', value: 'Yes' }] : []),
              ...(rfq.externalCoilType ? [{ label: 'Ext. Type', value: rfq.externalCoilType }] : []),
              ...(rfq.externalCoilPipeSize ? [{ label: 'Ext. Pipe Size', value: rfq.externalCoilPipeSize }] : []),
              ...(rfq.externalCoilCoverage ? [{ label: 'Ext. Coverage', value: rfq.externalCoilCoverage }] : []),
            ]} />
          </Section>
        )}

        {/* Status & Quote */}
        <Section label="Status & Quote" noDivider>
          <select
            value={rfq.status}
            onChange={e => onUpdate({ status: e.target.value as RfqStatus })}
            style={{
              ...inputBase,
              width: '100%',
              marginBottom: 10,
              cursor: 'pointer',
              appearance: 'none',
              WebkitAppearance: 'none',
            }}
          >
            <option value="received">Received</option>
            <option value="reviewed">Reviewed</option>
            <option value="quoted">Quoted</option>
            <option value="awarded">Awarded</option>
          </select>

          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input
              type="text"
              placeholder="Quote amount ($)"
              value={quoteInput}
              onChange={e => setQuoteInput(e.target.value)}
              style={{ ...inputBase, flex: 1 }}
            />
            <button
              onClick={() => onUpdate({ quoteAmount: quoteInput })}
              style={{
                padding: '8px 14px',
                background: '#16a34a',
                color: '#f0fdf4',
                border: 'none',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
            >
              Save
            </button>
          </div>

          <div style={{ position: 'relative', marginBottom: 8 }}>
            <button
              onMouseEnter={() => setShowBomTip(true)}
              onMouseLeave={() => setShowBomTip(false)}
              style={{
                width: '100%',
                padding: '8px',
                background: 'transparent',
                border: '0.5px solid #334155',
                borderRadius: 6,
                color: '#94a3b8',
                fontSize: 12,
                cursor: 'default',
                fontFamily: 'inherit',
              }}
            >
              Download BOM
            </button>
            {showBomTip && (
              <div style={{
                position: 'absolute',
                bottom: 'calc(100% + 6px)',
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#0f172a',
                border: '0.5px solid #334155',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 11,
                color: '#94a3b8',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                zIndex: 10,
              }}>
                Coming soon
              </div>
            )}
          </div>

          <button
            onClick={() => printRfq(rfq)}
            style={{
              width: '100%',
              padding: '8px',
              background: 'transparent',
              border: '0.5px solid #334155',
              borderRadius: 6,
              color: '#94a3b8',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Download PDF
          </button>
        </Section>

      </div>
    </aside>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FabricatorDashboard() {
  const [rfqs, setRfqs] = useState<RfqRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterState>('all')
  const [searchParams] = useSearchParams()
  const rfqParam = searchParams.get('rfq')

  useEffect(() => {
    api.get<{ rfqs: ApiRfq[] }>('/rfqs/all')
      .then(({ rfqs: rows }) => {
        const mapped = rows.map(mapApiRfq)
        setRfqs(mapped)
        if (rfqParam) {
          const target = mapped.find(r => r.id === `RFQ-${rfqParam}`)
          if (target) setSelectedId(target.id)
        }
      })
      .catch(() => setFetchError('Failed to load RFQs'))
      .finally(() => setLoading(false))
  // rfqParam intentionally omitted — only run on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = filter === 'all' ? rfqs : rfqs.filter(r => r.status === filter)
  const selected = rfqs.find(r => r.id === selectedId) ?? null

  function updateRfq(id: string, patch: Partial<Pick<RfqRecord, 'status' | 'quoteAmount'>>) {
    setRfqs(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  const counts = {
    total:    rfqs.length,
    received: rfqs.filter(r => r.status === 'received').length,
    quoted:   rfqs.filter(r => r.status === 'quoted').length,
    awarded:  rfqs.filter(r => r.status === 'awarded').length,
  }

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      background: '#0f172a',
      color: '#f1f5f9',
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontSize: 14,
    }}>

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside style={{
        width: 220,
        flexShrink: 0,
        background: '#0f172a',
        borderRight: '0.5px solid #1e293b',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 20,
      }}>
        <div style={{ padding: '0 20px 24px' }}>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.3px' }}>
            <span style={{ color: '#f8fafc' }}>Vessel</span>
            <span style={{ color: '#60a5fa' }}>RFQ</span>
          </div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>Smith Fabrication, Inc.</div>
        </div>

        <nav>
          {/* Active */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 20px',
            background: '#1e293b',
            borderRight: '2px solid #60a5fa',
            color: '#f1f5f9',
            cursor: 'pointer',
            fontSize: 13,
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
              <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
            </svg>
            RFQ Inbox
          </div>

          {/* Configurator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 20px', color: '#475569', cursor: 'pointer', fontSize: 13 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
            </svg>
            Configurator
          </div>

          {/* Settings */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 20px', color: '#475569', cursor: 'pointer', fontSize: 13 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
            Settings
          </div>
        </nav>
      </aside>

      {/* ── RFQ List ─────────────────────────────────────────────────────── */}
      <main style={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        borderRight: selected ? '0.5px solid #1e293b' : 'none',
        minWidth: 0,
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h1 style={{ fontSize: 18, fontWeight: 600, color: '#f1f5f9', margin: 0 }}>RFQ Inbox</h1>
            <span style={{ fontSize: 12, color: '#475569' }}>Last updated 2 min ago</span>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
            <StatCard label="Total RFQs" value={counts.total}    color="#f1f5f9" />
            <StatCard label="New"         value={counts.received} color="#60a5fa" />
            <StatCard label="Quoted"      value={counts.quoted}   color="#f59e0b" />
            <StatCard label="Awarded"     value={counts.awarded}  color="#4ade80" />
          </div>

          {/* Filter pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingBottom: 12, borderBottom: '0.5px solid #1e293b' }}>
            {FILTER_OPTIONS.map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 500,
                  border: filter === f.value ? '1px solid #60a5fa' : '1px solid #334155',
                  background: filter === f.value ? '#1e3a5f' : 'transparent',
                  color: filter === f.value ? '#60a5fa' : '#475569',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: '#475569', fontSize: 13 }}>
              Loading RFQs…
            </div>
          )}
          {fetchError && (
            <div style={{ padding: '20px 24px', color: '#f87171', fontSize: 13 }}>
              {fetchError}
            </div>
          )}
          {!loading && !fetchError && rfqs.length === 0 && (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: '#475569', fontSize: 13 }}>
              No RFQs submitted yet.
            </div>
          )}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <Th>RFQ #</Th>
                <Th>Vessel</Th>
                <Th>Status</Th>
                <Th>Date Received</Th>
                <Th align="right">Quote</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(rfq => {
                const isSelected = selectedId === rfq.id
                return (
                  <tr
                    key={rfq.id}
                    onClick={() => setSelectedId(isSelected ? null : rfq.id)}
                    style={{
                      borderBottom: '0.5px solid #1e293b',
                      background: isSelected ? '#1e293b' : 'transparent',
                      borderLeft: isSelected ? '2px solid #60a5fa' : '2px solid transparent',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#0f1f3d' }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={{ padding: '10px 16px', color: '#60a5fa', fontWeight: 500 }}>{rfq.id}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ color: '#f1f5f9', fontWeight: 500 }}>{rfq.vesselType}</div>
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 1 }}>{rfq.shellId} ID · {rfq.designPressure}</div>
                    </td>
                    <td style={{ padding: '10px 16px' }}><StatusBadge status={rfq.status} /></td>
                    <td style={{ padding: '10px 16px', color: '#64748b' }}>{rfq.dateReceived}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: rfq.quoteAmount ? '#f1f5f9' : '#334155' }}>
                      {rfq.quoteAmount ? fmtCurrency(rfq.quoteAmount) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </main>

      {/* ── Detail Panel ─────────────────────────────────────────────────── */}
      {selected && (
        <DetailPanel
          key={selected.id}
          rfq={selected}
          onClose={() => setSelectedId(null)}
          onUpdate={patch => updateRfq(selected.id, patch)}
        />
      )}

    </div>
  )
}
