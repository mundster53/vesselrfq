import { useState, useEffect, type ReactNode, type CSSProperties } from 'react'
import { api, ApiError } from '../lib/api'

// ── Types ──────────────────────────────────────────────────────────────────────

interface NozzleItem {
  id:         number
  rfqId:      number
  mark:       string
  size:       string
  rating:     string | null
  flangeType: string | null
  facing:     string | null
  material:   string | null
  service:    string | null
  quantity:   number
  location:   string | null
}

interface MarketplaceRfqItem {
  marketplaceRfqId: number
  rfqId:            number
  status:           string
  installCity:      string
  installState:     string
  deadlineAt:       string | null
  createdAt:        string
  title:            string
  vesselType:       string | null
  shellOd:          string | null
  shellLength:      string | null
  shellMaterial:    string | null
  mawp:             string | null
  designTemp:       number | null
  headType:         string | null
  supportType:      string | null
  corrosionAllowance: string | null
  notes:            string | null
  buyerCompany:     string | null
  alreadyQuoted:    boolean
  quoteId:          number | null
  nozzles:          NozzleItem[]

  // Painting
  surfacePrep:  string | null
  primer:       string | null
  topcoat:      string | null
  finishType:   string | null

  // Insulation
  insulated:           boolean | null
  insulationType:      string | null
  insulationThickness: string | null
  insulationJacket:    string | null
  insulationShell:     boolean | null
  insulationHeads:     boolean | null

  // Coils
  internalCoil:         boolean | null
  internalCoilPipeSize: string | null
  internalCoilTurns:    number | null
  externalCoil:         boolean | null
  externalCoilType:     string | null
  externalCoilPipeSize: string | null
  externalCoilCoverage: string | null

  // HX — TEMA
  temaFront: string | null
  temaShell: string | null
  temaRear:  string | null

  // HX — shell configuration
  orientation:      string | null
  shellsInSeries:   number | null
  shellsInParallel: number | null

  // HX — tube bundle
  tubeCount:    number | null
  tubeOd:       string | null
  tubeBwg:      string | null
  tubeLength:   string | null
  tubeMaterial: string | null
  tubeLayout:   string | null
  tubePitch:    string | null
  tubeJoint:    string | null

  // HX — baffles
  baffleType:       string | null
  baffleCut:        string | null
  baffleSpacing:    string | null
  impingementPlate: string | null

  // HX — shell side
  shellMawp:               string | null
  shellDesignTemp:         number | null
  shellCorrosionAllowance: string | null
  shellFluid:              string | null

  // HX — tube side
  tubeMawp:               string | null
  tubeDesignTemp:         number | null
  tubeCorrosionAllowance: string | null
  tubeFluid:              string | null
}

// ── Shared sub-components ──────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: '#1e293b', border: '0.5px solid #334155', borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ fontSize: 20, fontWeight: 600, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{label}</div>
    </div>
  )
}

function Section({ label, children, noDivider }: { label: string; children: ReactNode; noDivider?: boolean }) {
  return (
    <div style={{ marginBottom: noDivider ? 0 : 24 }}>
      <div style={{
        fontSize: 10, fontWeight: 500, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: '#475569', marginBottom: 10,
        paddingBottom: 6, borderBottom: '0.5px solid #1e293b',
      }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function SpecGrid({ items }: { items: { label: string; value: string; fullWidth?: boolean }[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
      {items.map(item => (
        <div
          key={item.label}
          style={{
            gridColumn: item.fullWidth ? '1 / -1' : undefined,
            background: '#1e293b', border: '0.5px solid #334155',
            borderRadius: 6, padding: '7px 10px',
          }}
        >
          <div style={{ fontSize: 10, color: '#475569', marginBottom: 3 }}>{item.label}</div>
          <div style={{ fontSize: 12, color: '#f1f5f9', fontWeight: 500 }}>{item.value}</div>
        </div>
      ))}
    </div>
  )
}

function NTh({ children }: { children: ReactNode }) {
  return (
    <th style={{
      padding: '5px 10px', textAlign: 'left', fontSize: 10, fontWeight: 500,
      color: '#475569', letterSpacing: '0.06em', textTransform: 'uppercase',
      borderBottom: '0.5px solid #334155', whiteSpace: 'nowrap',
    }}>
      {children}
    </th>
  )
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Detail modal ───────────────────────────────────────────────────────────────

function DetailModal({ rfq, onClose, onQuoteSubmitted }: {
  rfq:              MarketplaceRfqItem
  onClose:          () => void
  onQuoteSubmitted: (marketplaceRfqId: number, quoteId: number) => void
}) {
  const [fabricatedPrice,  setFabricatedPrice]  = useState('')
  const [estimatedFreight, setEstimatedFreight] = useState('')
  const [leadTimeWeeks,    setLeadTimeWeeks]    = useState('')
  const [qualifications,   setQualifications]   = useState('')
  const [submitting,       setSubmitting]       = useState(false)
  const [submitError,      setSubmitError]      = useState('')
  const [submitted,        setSubmitted]        = useState(rfq.alreadyQuoted)

  const fabricatedNum  = parseFloat(fabricatedPrice)  || 0
  const freightNum     = parseFloat(estimatedFreight) || 0
  const totalDelivered = fabricatedNum + freightNum

  const inputBase: CSSProperties = {
    background: '#0f172a', border: '0.5px solid #334155', borderRadius: 6,
    color: '#f1f5f9', fontSize: 13, padding: '8px 10px', fontFamily: 'inherit',
    outline: 'none', width: '100%', boxSizing: 'border-box',
  }

  const isHx        = rfq.vesselType === 'heat_exchanger'
  const vesselLabel = isHx ? 'Heat Exchanger' : 'Pressure Vessel'
  const isPastDue   = rfq.deadlineAt ? new Date(rfq.deadlineAt).getTime() < Date.now() : false
  const temaDesig   = [rfq.temaFront, rfq.temaShell, rfq.temaRear].filter(Boolean).join('-')

  async function handleSubmitQuote() {
    if (!fabricatedPrice || !estimatedFreight || !leadTimeWeeks) {
      setSubmitError('Fabricated price, freight, and lead time are required.')
      return
    }
    setSubmitting(true)
    setSubmitError('')
    const payload = {
      marketplaceRfqId: rfq.marketplaceRfqId,
      fabricatedPrice:  parseFloat(fabricatedPrice),
      estimatedFreight: parseFloat(estimatedFreight),
      leadTimeWeeks:    parseInt(leadTimeWeeks),
      qualifications:   qualifications || null,
    }
    try {
      const { quoteId } = await api.post<{ quoteId: number }>('/fabricator/marketplace-quote', payload)
      setSubmitted(true)
      onQuoteSubmitted(rfq.marketplaceRfqId, quoteId)
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── HX geometry items ────────────────────────────────────────────────────────
  const hxGeomItems = [
    temaDesig                     ? { label: 'TEMA Type',         value: temaDesig }                    : null,
    rfq.orientation               ? { label: 'Orientation',       value: rfq.orientation }              : null,
    rfq.shellsInSeries  != null   ? { label: 'Shells in Series',  value: String(rfq.shellsInSeries) }   : null,
    rfq.shellsInParallel != null  ? { label: 'Shells Parallel',   value: String(rfq.shellsInParallel) } : null,
    rfq.shellOd                   ? { label: 'Shell OD',          value: `${rfq.shellOd}"` }            : null,
    rfq.shellLength               ? { label: 'T/T Length',        value: `${rfq.shellLength}"` }        : null,
    rfq.shellMaterial             ? { label: 'Shell Material',    value: rfq.shellMaterial }            : null,
    rfq.headType                  ? { label: 'Channel/Head Type', value: rfq.headType }                 : null,
    rfq.tubeCount       != null   ? { label: 'Tube Count',        value: String(rfq.tubeCount) }        : null,
    rfq.tubeOd                    ? { label: 'Tube OD',           value: rfq.tubeOd }                   : null,
    rfq.tubeBwg                   ? { label: 'Tube BWG',          value: rfq.tubeBwg }                  : null,
    rfq.tubeLength                ? { label: 'Tube Length',       value: rfq.tubeLength }               : null,
    rfq.tubeMaterial              ? { label: 'Tube Material',     value: rfq.tubeMaterial }             : null,
    rfq.tubeLayout                ? { label: 'Tube Layout',       value: rfq.tubeLayout }               : null,
    rfq.tubePitch                 ? { label: 'Tube Pitch',        value: rfq.tubePitch }                : null,
    rfq.tubeJoint                 ? { label: 'Tube Joint',        value: rfq.tubeJoint }                : null,
    rfq.baffleType                ? { label: 'Baffle Type',       value: rfq.baffleType }               : null,
    rfq.baffleCut                 ? { label: 'Baffle Cut',        value: `${rfq.baffleCut}%` }          : null,
    rfq.baffleSpacing             ? { label: 'Baffle Spacing',    value: `${rfq.baffleSpacing}"` }      : null,
    rfq.impingementPlate          ? { label: 'Impingement Plate', value: rfq.impingementPlate }         : null,
  ].filter(Boolean) as { label: string; value: string }[]

  const hxCondItems = [
    rfq.shellMawp                ? { label: 'Shell MAWP',  value: `${rfq.shellMawp} psig` }           : null,
    rfq.shellDesignTemp != null  ? { label: 'Shell Temp',  value: `${rfq.shellDesignTemp}°F` }         : null,
    rfq.shellCorrosionAllowance  ? { label: 'Shell CA',    value: `${rfq.shellCorrosionAllowance}"` }  : null,
    rfq.shellFluid               ? { label: 'Shell Fluid', value: rfq.shellFluid }                     : null,
    rfq.tubeMawp                 ? { label: 'Tube MAWP',   value: `${rfq.tubeMawp} psig` }             : null,
    rfq.tubeDesignTemp != null   ? { label: 'Tube Temp',   value: `${rfq.tubeDesignTemp}°F` }          : null,
    rfq.tubeCorrosionAllowance   ? { label: 'Tube CA',     value: `${rfq.tubeCorrosionAllowance}"` }   : null,
    rfq.tubeFluid                ? { label: 'Tube Fluid',  value: rfq.tubeFluid }                      : null,
  ].filter(Boolean) as { label: string; value: string }[]

  // ── PV geometry / design items ───────────────────────────────────────────────
  const pvGeomItems = [
    rfq.shellOd            ? { label: 'Shell OD',         value: `${rfq.shellOd}"` }           : null,
    rfq.shellLength        ? { label: 'T/T Length',       value: `${rfq.shellLength}"` }        : null,
    rfq.shellMaterial      ? { label: 'Material',         value: rfq.shellMaterial }            : null,
    rfq.headType           ? { label: 'Head Type',        value: rfq.headType }                 : null,
    rfq.orientation        ? { label: 'Orientation',      value: rfq.orientation }              : null,
    rfq.supportType        ? { label: 'Support Type',     value: rfq.supportType }              : null,
    rfq.corrosionAllowance ? { label: 'Corrosion Allow.', value: `${rfq.corrosionAllowance}"` } : null,
  ].filter(Boolean) as { label: string; value: string }[]

  const pvDesignItems = [
    rfq.mawp               ? { label: 'MAWP',        value: `${rfq.mawp} psig` }   : null,
    rfq.designTemp != null ? { label: 'Design Temp', value: `${rfq.designTemp}°F` } : null,
  ].filter(Boolean) as { label: string; value: string }[]

  // ── Quick reference items for right column ───────────────────────────────────
  const quickRefItems = [
    rfq.shellOd                       ? { label: 'Shell OD',  value: `${rfq.shellOd}"` }      : null,
    isHx && temaDesig                 ? { label: 'TEMA Type', value: temaDesig }               : null,
    !isHx && rfq.mawp                 ? { label: 'MAWP',      value: `${rfq.mawp} psig` }     : null,
    { label: 'Install', value: `${rfq.installCity}, ${rfq.installState}` },
    { label: 'Deadline', value: fmtDate(rfq.deadlineAt) },
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(2, 6, 23, 0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          maxWidth: 1100, width: 'calc(100vw - 48px)', maxHeight: 'calc(100vh - 48px)',
          background: '#0f172a', border: '0.5px solid #334155', borderRadius: 12,
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >

        {/* Header */}
        <div style={{
          height: 48, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 24px', borderBottom: '0.5px solid #1e293b',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>{rfq.title}</span>
            <span style={{ fontSize: 12, color: '#475569' }}>RFQ #{rfq.rfqId} · {vesselLabel}</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none', border: 'none', color: '#475569',
              cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', borderRadius: 4,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* ── Left column: spec sheet ──────────────────────────────────────── */}
          <div style={{
            flex: '0 0 60%', overflowY: 'auto', padding: 24,
            borderRight: '0.5px solid #1e293b',
          }}>

            {/* HX geometry */}
            {isHx && hxGeomItems.length > 0 && (
              <Section label="Heat Exchanger Geometry">
                <SpecGrid items={hxGeomItems} />
              </Section>
            )}

            {/* HX shell & tube side */}
            {isHx && hxCondItems.length > 0 && (
              <Section label="Shell & Tube Side Conditions">
                <SpecGrid items={hxCondItems} />
              </Section>
            )}

            {/* PV geometry */}
            {!isHx && pvGeomItems.length > 0 && (
              <Section label="Vessel Geometry">
                <SpecGrid items={pvGeomItems} />
              </Section>
            )}

            {/* PV design conditions */}
            {!isHx && pvDesignItems.length > 0 && (
              <Section label="Design Conditions">
                <SpecGrid items={pvDesignItems} />
              </Section>
            )}

            {/* Nozzle schedule */}
            <Section label="Nozzle Schedule">
              {rfq.nozzles.length === 0 ? (
                <div style={{ fontSize: 12, color: '#475569' }}>No nozzles specified</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr>
                        <NTh>Mark</NTh>
                        <NTh>Size</NTh>
                        <NTh>Rating</NTh>
                        <NTh>Flange Type</NTh>
                        <NTh>Facing</NTh>
                        <NTh>Material</NTh>
                        <NTh>Service</NTh>
                        <NTh>Qty</NTh>
                        <NTh>Location</NTh>
                      </tr>
                    </thead>
                    <tbody>
                      {rfq.nozzles.map((n, i) => (
                        <tr key={n.id} style={{ background: i % 2 === 0 ? '#0a1628' : '#0f172a' }}>
                          <td style={{ padding: '6px 10px', color: '#60a5fa', fontWeight: 500 }}>{n.mark}</td>
                          <td style={{ padding: '6px 10px', color: '#cbd5e1' }}>{n.size}</td>
                          <td style={{ padding: '6px 10px', color: '#cbd5e1' }}>{n.rating ?? '—'}</td>
                          <td style={{ padding: '6px 10px', color: '#cbd5e1' }}>{n.flangeType ?? '—'}</td>
                          <td style={{ padding: '6px 10px', color: '#cbd5e1' }}>{n.facing ?? '—'}</td>
                          <td style={{ padding: '6px 10px', color: '#cbd5e1' }}>{n.material ?? '—'}</td>
                          <td style={{ padding: '6px 10px', color: '#94a3b8' }}>{n.service ?? '—'}</td>
                          <td style={{ padding: '6px 10px', color: '#cbd5e1', textAlign: 'center' }}>{n.quantity}</td>
                          <td style={{ padding: '6px 10px', color: '#94a3b8' }}>{n.location?.replace('_', ' ') ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            {/* Painting & surface prep */}
            {(rfq.surfacePrep || rfq.primer || rfq.topcoat || rfq.finishType) && (
              <Section label="Painting & Surface Prep">
                <SpecGrid items={[
                  ...(rfq.surfacePrep ? [{ label: 'Surface Prep', value: rfq.surfacePrep }] : []),
                  ...(rfq.primer      ? [{ label: 'Primer',       value: rfq.primer }]      : []),
                  ...(rfq.topcoat     ? [{ label: 'Topcoat',      value: rfq.topcoat }]     : []),
                  ...(rfq.finishType  ? [{ label: 'Finish',       value: rfq.finishType }]  : []),
                ]} />
              </Section>
            )}

            {/* Insulation */}
            {rfq.insulated && (
              <Section label="Insulation">
                <SpecGrid items={[
                  ...(rfq.insulationType          ? [{ label: 'Type',      value: rfq.insulationType }]                 : []),
                  ...(rfq.insulationThickness      ? [{ label: 'Thickness', value: rfq.insulationThickness }]            : []),
                  ...(rfq.insulationJacket         ? [{ label: 'Jacket',    value: rfq.insulationJacket }]               : []),
                  ...(rfq.insulationShell != null  ? [{ label: 'Shell',     value: rfq.insulationShell ? 'Yes' : 'No' }] : []),
                  ...(rfq.insulationHeads != null  ? [{ label: 'Heads',     value: rfq.insulationHeads ? 'Yes' : 'No' }] : []),
                ]} />
              </Section>
            )}

            {/* Coils */}
            {(rfq.internalCoil || rfq.externalCoil) && (
              <Section label="Coils">
                <SpecGrid items={[
                  ...(rfq.internalCoil              ? [{ label: 'Internal Coil',  value: 'Yes' }]                          : []),
                  ...(rfq.internalCoilPipeSize       ? [{ label: 'Int. Pipe Size', value: rfq.internalCoilPipeSize }]        : []),
                  ...(rfq.internalCoilTurns != null  ? [{ label: 'Int. Turns',     value: String(rfq.internalCoilTurns) }]  : []),
                  ...(rfq.externalCoil              ? [{ label: 'External Coil',  value: 'Yes' }]                          : []),
                  ...(rfq.externalCoilType           ? [{ label: 'Ext. Type',      value: rfq.externalCoilType }]           : []),
                  ...(rfq.externalCoilPipeSize       ? [{ label: 'Ext. Pipe Size', value: rfq.externalCoilPipeSize }]       : []),
                  ...(rfq.externalCoilCoverage       ? [{ label: 'Ext. Coverage',  value: rfq.externalCoilCoverage }]       : []),
                ]} />
              </Section>
            )}

            {/* Remarks */}
            {rfq.notes && (
              <Section label="Remarks">
                <div style={{
                  fontSize: 12, color: '#cbd5e1', lineHeight: 1.6,
                  background: '#1e293b', border: '0.5px solid #334155',
                  borderRadius: 6, padding: '8px 10px',
                }}>
                  {rfq.notes}
                </div>
              </Section>
            )}

            {/* Install info */}
            <Section label="Install Info" noDivider>
              <SpecGrid items={[
                { label: 'Install Location', value: `${rfq.installCity}, ${rfq.installState}` },
                { label: 'Bid Deadline',     value: fmtDate(rfq.deadlineAt) },
                ...(rfq.buyerCompany ? [{ label: 'Buyer', value: rfq.buyerCompany, fullWidth: true }] : []),
              ]} />
              {isPastDue && (
                <div style={{ marginTop: 8, fontSize: 11, color: '#f87171' }}>
                  This RFQ is past its bid deadline.
                </div>
              )}
            </Section>

          </div>

          {/* ── Right column: quote panel ────────────────────────────────────── */}
          <div style={{
            flex: '0 0 40%', overflowY: 'auto', padding: 24,
            background: '#0a1628', display: 'flex', flexDirection: 'column', gap: 20,
          }}>

            {/* Quick reference card */}
            <div style={{
              background: '#0f172a', border: '0.5px solid #334155',
              borderRadius: 8, padding: '14px 16px',
            }}>
              <div style={{
                fontSize: 10, fontWeight: 500, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: '#475569', marginBottom: 10,
              }}>
                Quick Reference
              </div>
              <SpecGrid items={quickRefItems} />
            </div>

            {/* Quote form or submitted state */}
            {submitted ? (
              <div style={{
                borderRadius: 8, padding: '14px 16px',
                background: '#052e16', border: '0.5px solid #16a34a',
                color: '#86efac', fontSize: 13, fontWeight: 500,
              }}>
                ✓ Quote submitted
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{
                  fontSize: 10, fontWeight: 500, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: '#475569',
                  paddingBottom: 6, borderBottom: '0.5px solid #1e293b',
                }}>
                  Submit Quote
                </div>

                <div>
                  <div style={{ fontSize: 11, color: '#475569', marginBottom: 5 }}>Fabricated Price ($)</div>
                  <input
                    type="number" min={0} placeholder="e.g. 48500"
                    value={fabricatedPrice}
                    onChange={e => setFabricatedPrice(e.target.value)}
                    style={inputBase}
                  />
                </div>

                <div>
                  <div style={{ fontSize: 11, color: '#475569', marginBottom: 5 }}>Estimated Freight ($)</div>
                  <input
                    type="number" min={0} placeholder="e.g. 2200"
                    value={estimatedFreight}
                    onChange={e => setEstimatedFreight(e.target.value)}
                    style={inputBase}
                  />
                </div>

                <div>
                  <div style={{ fontSize: 11, color: '#475569', marginBottom: 5 }}>Total Delivered</div>
                  <div style={{
                    background: '#0f172a', border: '0.5px solid #334155', borderRadius: 6,
                    padding: '8px 10px', fontSize: 13, fontWeight: 500,
                    color: totalDelivered > 0 ? '#f1f5f9' : '#334155',
                  }}>
                    {totalDelivered > 0
                      ? `$${totalDelivered.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '—'
                    }
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: '#475569', marginBottom: 5 }}>Lead Time (weeks)</div>
                  <input
                    type="number" min={1} placeholder="e.g. 14"
                    value={leadTimeWeeks}
                    onChange={e => setLeadTimeWeeks(e.target.value)}
                    style={inputBase}
                  />
                </div>

                <div>
                  <div style={{ fontSize: 11, color: '#475569', marginBottom: 5 }}>
                    Qualifications / Notes{' '}
                    <span style={{ fontWeight: 400 }}>(optional)</span>
                  </div>
                  <textarea
                    rows={4}
                    placeholder="Any relevant qualifications, exceptions, or notes…"
                    value={qualifications}
                    onChange={e => setQualifications(e.target.value)}
                    style={{ ...inputBase, resize: 'vertical', lineHeight: 1.5 } as CSSProperties}
                  />
                </div>

                {submitError && (
                  <div style={{ fontSize: 12, color: '#f87171' }}>{submitError}</div>
                )}

                <button
                  onClick={handleSubmitQuote}
                  disabled={submitting}
                  style={{
                    padding: '10px 0',
                    background:   submitting ? '#0f172a' : '#1d4ed8',
                    border:       `0.5px solid ${submitting ? '#1e293b' : '#2563eb'}`,
                    borderRadius: 6,
                    color:        submitting ? '#334155' : '#f1f5f9',
                    fontSize:     13,
                    fontWeight:   600,
                    cursor:       submitting ? 'default' : 'pointer',
                    fontFamily:   'inherit',
                    transition:   'background 0.15s',
                    width:        '100%',
                  }}
                >
                  {submitting ? 'Submitting…' : 'Submit Quote'}
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function FabricatorMarketplaceView() {
  const [rfqs, setRfqs]             = useState<MarketplaceRfqItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [ineligible, setIneligible] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  useEffect(() => {
    api.get<{ rfqs: MarketplaceRfqItem[] }>('/fabricator/marketplace-rfqs')
      .then(data => setRfqs(data.rfqs))
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 403) {
          setIneligible(true)
        } else {
          setFetchError(err instanceof Error ? err.message : 'Failed to load')
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const selected = rfqs.find(r => r.marketplaceRfqId === selectedId) ?? null
  const now      = Date.now()

  const counts = {
    available: rfqs.filter(r => !r.alreadyQuoted).length,
    quoted:    rfqs.filter(r =>  r.alreadyQuoted).length,
  }

  function handleQuoteSubmitted(marketplaceRfqId: number, _quoteId: number) {
    setRfqs(prev => prev.map(r =>
      r.marketplaceRfqId === marketplaceRfqId ? { ...r, alreadyQuoted: true } : r
    ))
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ overflowY: 'auto', flex: 1, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#475569', fontSize: 13 }}>Loading marketplace RFQs…</span>
      </div>
    )
  }

  // ── Ineligible ───────────────────────────────────────────────────────────────
  if (ineligible) {
    return (
      <div style={{ overflowY: 'auto', flex: 1, background: '#0f172a', padding: '24px 24px 32px' }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', margin: '0 0 16px' }}>Marketplace RFQs</h2>
        <div style={{
          borderRadius: 6, padding: '12px 16px',
          background: '#1c1917', border: '0.5px solid #44403c',
          color: '#a8a29e', fontSize: 13, lineHeight: 1.6,
        }}>
          You are not yet eligible to view marketplace RFQs. To gain access, ensure your
          subscription is active and your bid profile is complete.
          <div style={{ marginTop: 10 }}>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('fabricator-nav', { detail: 'settings' }))}
              style={{
                background: 'none', border: '0.5px solid #44403c', borderRadius: 5,
                color: '#a8a29e', fontSize: 12, cursor: 'pointer',
                padding: '5px 12px', fontFamily: 'inherit',
              }}
            >
              Go to Settings →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (fetchError) {
    return (
      <div style={{ overflowY: 'auto', flex: 1, background: '#0f172a', padding: '24px' }}>
        <div style={{ color: '#f87171', fontSize: 13 }}>{fetchError}</div>
      </div>
    )
  }

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (rfqs.length === 0) {
    return (
      <div style={{ overflowY: 'auto', flex: 1, background: '#0f172a', padding: '24px 24px 32px' }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', margin: '0 0 16px' }}>Marketplace RFQs</h2>
        <div style={{ padding: '40px 0', textAlign: 'center', color: '#475569', fontSize: 13 }}>
          No marketplace RFQs match your bid profile right now. Check back soon.
        </div>
      </div>
    )
  }

  // ── Main view ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minWidth: 0 }}>

      {/* Table area — full width */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minWidth: 0 }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: '#f1f5f9', margin: '0 0 2px' }}>
            Marketplace RFQs
          </h1>
          <div style={{ fontSize: 12, color: '#475569', marginBottom: 16 }}>
            RFQs matching your bid profile
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 14 }}>
            <StatCard label="Available to Bid" value={counts.available} color="#60a5fa" />
            <StatCard label="Already Quoted"   value={counts.quoted}   color="#4ade80" />
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {(['RFQ #', 'Title', 'Type', 'Install Location', 'Deadline', 'Status'] as const).map(h => (
                  <th key={h} style={{
                    padding: '8px 16px', textAlign: 'left', fontSize: 10, fontWeight: 500,
                    color: '#475569', letterSpacing: '0.06em', textTransform: 'uppercase',
                    background: '#0f172a', position: 'sticky', top: 0, zIndex: 1,
                    borderBottom: '0.5px solid #1e293b',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rfqs.map(row => {
                const isSelected  = selectedId === row.marketplaceRfqId
                const isPastDue   = row.deadlineAt ? new Date(row.deadlineAt).getTime() < now : false
                const vesselLabel = row.vesselType === 'heat_exchanger' ? 'Heat Exchanger' : 'Pressure Vessel'
                return (
                  <tr
                    key={row.marketplaceRfqId}
                    onClick={() => setSelectedId(row.marketplaceRfqId)}
                    style={{
                      borderBottom: '0.5px solid #1e293b',
                      background:   isSelected ? '#1e293b' : 'transparent',
                      borderLeft:   isSelected ? '2px solid #60a5fa' : '2px solid transparent',
                      cursor:       'pointer',
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#0f1f3d' }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={{ padding: '10px 16px', color: '#60a5fa', fontWeight: 500 }}>#{row.rfqId}</td>
                    <td style={{ padding: '10px 16px', color: '#f1f5f9', maxWidth: 260 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.title}</div>
                    </td>
                    <td style={{ padding: '10px 16px', color: '#94a3b8' }}>{vesselLabel}</td>
                    <td style={{ padding: '10px 16px', color: '#cbd5e1' }}>{row.installCity}, {row.installState}</td>
                    <td style={{ padding: '10px 16px', color: isPastDue ? '#f87171' : '#64748b' }}>{fmtDate(row.deadlineAt)}</td>
                    <td style={{ padding: '10px 16px' }}>
                      {row.alreadyQuoted ? (
                        <span style={{ background: '#052e16', color: '#4ade80', border: '1px solid #16a34a', borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 500 }}>
                          Quote Submitted
                        </span>
                      ) : (
                        <span style={{ background: '#1e3a5f', color: '#60a5fa', border: '1px solid #2563eb', borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 500 }}>
                          Bid Available
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal overlay */}
      {selected && (
        <DetailModal
          key={selected.marketplaceRfqId}
          rfq={selected}
          onClose={() => setSelectedId(null)}
          onQuoteSubmitted={handleQuoteSubmitted}
        />
      )}

    </div>
  )
}
