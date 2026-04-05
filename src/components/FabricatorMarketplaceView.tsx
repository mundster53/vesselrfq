import { useState, useEffect, type ReactNode, type CSSProperties } from 'react'
import { api, ApiError } from '../lib/api'

// ── Types ──────────────────────────────────────────────────────────────────────

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
  nozzleCount:      number
  buyerCompany:     string | null
  alreadyQuoted:    boolean
  quoteId:          number | null
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
    <div style={{ padding: '16px 20px', borderBottom: noDivider ? 'none' : '0.5px solid #334155' }}>
      <div style={{
        fontSize: 10, fontWeight: 500, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: '#475569', marginBottom: 12,
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
            background: '#0f172a', border: '0.5px solid #334155',
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

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Detail panel ───────────────────────────────────────────────────────────────

function DetailPanel({ rfq, onClose, onQuoteSubmitted }: {
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

  const vesselLabel = rfq.vesselType === 'heat_exchanger' ? 'Heat Exchanger' : 'Pressure Vessel'
  const isPastDue   = rfq.deadlineAt ? new Date(rfq.deadlineAt).getTime() < Date.now() : false

  const specItems = [
    rfq.shellOd            ? { label: 'Shell OD',     value: `${rfq.shellOd}"` }         : null,
    rfq.shellLength        ? { label: 'T/T Length',   value: `${rfq.shellLength}"` }      : null,
    rfq.shellMaterial      ? { label: 'Material',     value: rfq.shellMaterial }          : null,
    rfq.mawp               ? { label: 'MAWP',         value: `${rfq.mawp} psig` }        : null,
    rfq.designTemp != null ? { label: 'Design Temp',  value: `${rfq.designTemp}°F` }     : null,
    rfq.headType           ? { label: 'Head Type',    value: rfq.headType }               : null,
    rfq.supportType        ? { label: 'Support Type', value: rfq.supportType }            : null,
    rfq.nozzleCount        ? { label: 'Nozzles',      value: String(rfq.nozzleCount) }   : null,
  ].filter(Boolean) as { label: string; value: string }[]

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

  return (
    <aside style={{
      width: 340, flexShrink: 0, background: '#1e293b',
      borderLeft: '0.5px solid #334155', display: 'flex',
      flexDirection: 'column', overflow: 'hidden',
    }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', borderBottom: '0.5px solid #334155', flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{rfq.title}</div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 1 }}>RFQ #{rfq.rfqId} · {vesselLabel}</div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', borderRadius: 4 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div style={{ overflowY: 'auto', flex: 1 }}>

        <Section label="Buyer">
          <div style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 500 }}>
            {rfq.buyerCompany ?? 'Unknown Company'}
          </div>
        </Section>

        <Section label="Install Location & Deadline">
          <SpecGrid items={[
            { label: 'Install Location', value: `${rfq.installCity}, ${rfq.installState}` },
            { label: 'Bid Deadline',     value: fmtDate(rfq.deadlineAt) },
          ]} />
          {isPastDue && (
            <div style={{ marginTop: 8, fontSize: 11, color: '#f87171' }}>
              This RFQ is past its bid deadline.
            </div>
          )}
        </Section>

        <Section label="Vessel Specifications">
          {specItems.length > 0
            ? <SpecGrid items={specItems} />
            : <div style={{ fontSize: 12, color: '#475569' }}>No specifications available.</div>
          }
        </Section>

        {submitted ? (
          <Section label="Quote" noDivider>
            <div style={{
              borderRadius: 6, padding: '10px 14px',
              background: '#052e16', border: '0.5px solid #16a34a',
              color: '#86efac', fontSize: 13, fontWeight: 500,
            }}>
              ✓ Quote submitted
            </div>
          </Section>
        ) : (
          <Section label="Submit Quote" noDivider>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                <div style={{ fontSize: 11, color: '#475569', marginBottom: 5 }}>
                  Lead Time (weeks)
                </div>
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
                  rows={3}
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
                  padding: '9px 0',
                  background:   submitting ? '#0f172a' : '#1d4ed8',
                  border:       `0.5px solid ${submitting ? '#1e293b' : '#2563eb'}`,
                  borderRadius: 6,
                  color:        submitting ? '#334155' : '#f1f5f9',
                  fontSize:     13,
                  fontWeight:   500,
                  cursor:       submitting ? 'default' : 'pointer',
                  fontFamily:   'inherit',
                  transition:   'background 0.15s',
                }}
              >
                {submitting ? 'Submitting…' : 'Submit Quote'}
              </button>
            </div>
          </Section>
        )}

      </div>
    </aside>
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

      {/* Table area */}
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
                    onClick={() => setSelectedId(isSelected ? null : row.marketplaceRfqId)}
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
                    <td style={{ padding: '10px 16px', color: '#f1f5f9', maxWidth: 180 }}>
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

      {/* Detail panel */}
      {selected && (
        <DetailPanel
          key={selected.marketplaceRfqId}
          rfq={selected}
          onClose={() => setSelectedId(null)}
          onQuoteSubmitted={handleQuoteSubmitted}
        />
      )}

    </div>
  )
}
