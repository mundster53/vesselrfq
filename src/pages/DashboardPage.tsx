import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { api, ApiError } from '../lib/api'
import type { RfqSummary } from '../types/vessel'

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  quoted: 'Quoted',
  awarded: 'Awarded',
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  submitted: 'bg-blue-50 text-blue-700',
  quoted: 'bg-amber-50 text-amber-700',
  awarded: 'bg-green-50 text-green-700',
}

const STATUS_COLOR_DARK: Record<string, string> = {
  draft: 'bg-slate-700 text-slate-200',
  submitted: 'bg-blue-900 text-blue-200',
  quoted: 'bg-amber-900 text-amber-200',
  awarded: 'bg-green-900 text-green-200',
}

interface RfqNozzle {
  id: number
  rfqId: number
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

interface RfqFull extends RfqSummary {
  corrosionAllowance: string | null
  orientation: string | null
  supportType: string | null
  saddleHeight: string | null
  saddleWidth: string | null
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
  nozzles: RfqNozzle[]
}

interface MarketplaceQuote {
  quoteId:             number
  fabricatorId:        number
  shopName:            string
  city:                string
  state:               string
  fabricatedPrice:     string
  estimatedFreight:    string
  totalDeliveredPrice: string | null
  leadTimeWeeks:       number
  qualifications:      string | null
  status:              string
  submittedAt:         string
}

interface MarketplaceRfqWithQuotes {
  marketplaceRfqId: number
  rfqId:            number
  rfqTitle:         string
  vesselType:       string | null
  shellOd:          string | null
  installCity:      string
  installState:     string
  deadlineAt:       string | null
  status:           string
  quotes:           MarketplaceQuote[]
}

interface BidTabModalState {
  marketplaceRfqId: number
  rfqTitle:         string
}

interface ReopenModalState {
  marketplaceRfqId: number
  rfqTitle:         string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function fmtPrice(val: string | null): string {
  if (!val) return '—'
  const n = parseFloat(val)
  return isNaN(n) ? '—' : `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function SpecRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-slate-700">
      <span className="text-slate-400 text-sm shrink-0">{label}</span>
      <span className="text-slate-100 text-sm text-right">{value}</span>
    </div>
  )
}

function SectionHead({ label }: { label: string }) {
  return (
    <div className="text-xs font-medium tracking-widest uppercase text-slate-500 pt-4 pb-1 first:pt-0">
      {label}
    </div>
  )
}

function RfqDetailPanel({ rfq, onClose }: { rfq: RfqFull; onClose: () => void }) {
  const isTank = rfq.vesselType !== 'heat_exchanger'
  const typeLabel = rfq.vesselType === 'heat_exchanger' ? 'Heat Exchanger' : 'Pressure Vessel / Tank'
  const hasVerticalAccessories = !isTank ? false : rfq.orientation === 'vertical'
  const hasPainting = !!(rfq.surfacePrep || rfq.primer || rfq.topcoat || rfq.finishType)
  const hasInsulation = !!rfq.insulated
  const hasCoils = !!(rfq.internalCoil || rfq.externalCoil)

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-slate-900 shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-700">
          <div>
            <h2 className="text-base font-semibold text-white leading-tight">{rfq.title}</h2>
            <p className="text-xs text-slate-400 mt-0.5">RFQ #{rfq.id} &nbsp;·&nbsp; {formatDate(rfq.createdAt)}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors ml-3 mt-0.5 shrink-0 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-3 flex items-center gap-2">
            <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR_DARK[rfq.status] ?? 'bg-slate-700 text-slate-200'}`}>
              {STATUS_LABEL[rfq.status] ?? rfq.status}
            </span>
            <span className="text-xs text-slate-400">{typeLabel}</span>
          </div>

          {/* Vessel Geometry */}
          <SectionHead label="Vessel Geometry" />
          <div className="divide-y divide-slate-700/60 mb-2">
            <SpecRow label="Shell OD" value={rfq.shellOd ? `${rfq.shellOd}"` : null} />
            <SpecRow label={isTank ? 'T/T Length' : 'Shell Length'} value={rfq.shellLength ? `${rfq.shellLength}"` : null} />
            <SpecRow label="Shell Material" value={rfq.shellMaterial} />
            {isTank && <SpecRow label="Head Type" value={rfq.headType} />}
            <SpecRow label="Orientation" value={rfq.orientation} />
            <SpecRow label="Support Type" value={rfq.supportType} />
            {rfq.supportType === 'saddles' && (
              <>
                <SpecRow label="Saddle Height" value={rfq.saddleHeight ? `${rfq.saddleHeight}"` : null} />
                <SpecRow label="Saddle Width" value={rfq.saddleWidth ? `${rfq.saddleWidth}"` : null} />
              </>
            )}
            <SpecRow label="Quantity" value={String(rfq.quantity)} />
          </div>

          {/* Design Conditions */}
          <SectionHead label="Design Conditions" />
          <div className="divide-y divide-slate-700/60 mb-2">
            <SpecRow label={isTank ? 'MAWP' : 'Shell MAWP'} value={rfq.mawp ? `${rfq.mawp} psig` : null} />
            <SpecRow label={isTank ? 'Design Temp' : 'Shell Design Temp'} value={rfq.designTemp != null ? `${rfq.designTemp}°F` : null} />
            <SpecRow label="Corrosion Allow." value={rfq.corrosionAllowance ? `${rfq.corrosionAllowance}"` : null} />
          </div>

          {/* Nozzle Schedule */}
          <SectionHead label="Nozzle Schedule" />
          {rfq.nozzles.length === 0 ? (
            <div className="text-slate-500 text-sm mb-2">No nozzles specified</div>
          ) : (
            <div className="mb-2 rounded overflow-hidden border border-slate-700">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-800">
                    <th className="text-left px-2 py-1.5 font-medium text-slate-400 uppercase tracking-wider text-[10px]">Mark</th>
                    <th className="text-left px-2 py-1.5 font-medium text-slate-400 uppercase tracking-wider text-[10px]">Size</th>
                    <th className="text-left px-2 py-1.5 font-medium text-slate-400 uppercase tracking-wider text-[10px]">Rating</th>
                    <th className="text-left px-2 py-1.5 font-medium text-slate-400 uppercase tracking-wider text-[10px]">Qty</th>
                    <th className="text-left px-2 py-1.5 font-medium text-slate-400 uppercase tracking-wider text-[10px]">Loc</th>
                  </tr>
                </thead>
                <tbody>
                  {rfq.nozzles.map((n, i) => (
                    <>
                      <tr key={`${n.id}-a`} className={i % 2 === 0 ? 'bg-slate-900' : 'bg-slate-800/50'}>
                        <td className="px-2 pt-1.5 pb-0.5 text-blue-400 font-medium">{n.mark}</td>
                        <td className="px-2 pt-1.5 pb-0.5 text-slate-200">{n.size}</td>
                        <td className="px-2 pt-1.5 pb-0.5 text-slate-200">{n.rating ?? '—'}</td>
                        <td className="px-2 pt-1.5 pb-0.5 text-slate-200">{n.quantity}</td>
                        <td className="px-2 pt-1.5 pb-0.5 text-slate-300">{n.location?.replace('_', ' ') ?? '—'}</td>
                      </tr>
                      <tr key={`${n.id}-b`} className={i % 2 === 0 ? 'bg-slate-900' : 'bg-slate-800/50'}>
                        <td colSpan={5} className="px-2 pb-1.5 pt-0 text-[10px] text-slate-500">
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
            </div>
          )}

          {/* Vertical Vessel Accessories */}
          {hasVerticalAccessories && (
            <>
              <SectionHead label="Vertical Vessel Accessories" />
              <div className="divide-y divide-slate-700/60 mb-2">
                <SpecRow label="Orientation" value="Vertical" />
              </div>
            </>
          )}

          {/* Coils */}
          {hasCoils && (
            <>
              <SectionHead label="Coils" />
              <div className="divide-y divide-slate-700/60 mb-2">
                {rfq.internalCoil && <SpecRow label="Internal Coil" value="Yes" />}
                <SpecRow label="Int. Pipe Size" value={rfq.internalCoilPipeSize} />
                <SpecRow label="Int. Turns" value={rfq.internalCoilTurns} />
                {rfq.externalCoil && <SpecRow label="External Coil" value="Yes" />}
                <SpecRow label="Ext. Type" value={rfq.externalCoilType} />
                <SpecRow label="Ext. Pipe Size" value={rfq.externalCoilPipeSize} />
                <SpecRow label="Ext. Coverage" value={rfq.externalCoilCoverage} />
              </div>
            </>
          )}

          {/* Insulation */}
          {hasInsulation && (
            <>
              <SectionHead label="Insulation" />
              <div className="divide-y divide-slate-700/60 mb-2">
                <SpecRow label="Type" value={rfq.insulationType} />
                <SpecRow label="Thickness" value={rfq.insulationThickness} />
                <SpecRow label="Jacket" value={rfq.insulationJacket} />
                {rfq.insulationShell != null && <SpecRow label="Shell" value={rfq.insulationShell ? 'Yes' : 'No'} />}
                {rfq.insulationHeads != null && <SpecRow label="Heads" value={rfq.insulationHeads ? 'Yes' : 'No'} />}
              </div>
            </>
          )}

          {/* Painting & Surface Prep */}
          {hasPainting && (
            <>
              <SectionHead label="Painting & Surface Prep" />
              <div className="divide-y divide-slate-700/60 mb-2">
                <SpecRow label="Surface Prep" value={rfq.surfacePrep} />
                <SpecRow label="Primer" value={rfq.primer} />
                <SpecRow label="Topcoat" value={rfq.topcoat} />
                <SpecRow label="Finish" value={rfq.finishType} />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

function MarketplaceQuotesView({ rfqs, loading, error, onAward, onReopen }: {
  rfqs:     MarketplaceRfqWithQuotes[]
  loading:  boolean
  error:    string
  onAward:  (marketplaceRfqId: number, winningQuoteId: number) => void
  onReopen: (marketplaceRfqId: number, newDeadline: string) => void
}) {
  const [bidTabModal,    setBidTabModal]    = useState<BidTabModalState | null>(null)
  const [recipientName,  setRecipientName]  = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [sendingBidTab,  setSendingBidTab]  = useState(false)
  const [bidTabSent,     setBidTabSent]     = useState(false)
  const [bidTabError,    setBidTabError]    = useState('')
  const [awarding,       setAwarding]       = useState<number | null>(null)
  const [awardError,     setAwardError]     = useState('')
  const [reopenModal,    setReopenModal]    = useState<ReopenModalState | null>(null)
  const [reopenDays,     setReopenDays]     = useState(14)
  const [reopening,      setReopening]      = useState(false)
  const [reopenError,    setReopenError]    = useState('')

  function closeModal() {
    setBidTabModal(null)
    setRecipientName('')
    setRecipientEmail('')
    setSendingBidTab(false)
    setBidTabSent(false)
    setBidTabError('')
  }

  function closeReopenModal() {
    setReopenModal(null)
    setReopenDays(14)
    setReopening(false)
    setReopenError('')
  }

  async function handleReopen() {
    if (!reopenModal) return
    setReopening(true)
    setReopenError('')
    try {
      const { newDeadline } = await api.post<{ reopened: boolean; newDeadline: string; notified: number }>(
        '/buyer/reopen-rfq',
        { marketplaceRfqId: reopenModal.marketplaceRfqId, deadlineDays: reopenDays }
      )
      onReopen(reopenModal.marketplaceRfqId, newDeadline)
      closeReopenModal()
    } catch (err) {
      setReopenError(err instanceof ApiError ? err.message : 'Failed to reopen RFQ')
    } finally {
      setReopening(false)
    }
  }

  async function handleAward(marketplaceRfqId: number, quoteId: number) {
    if (!window.confirm('Award this quote? This will notify all fabricators and cannot be undone.')) return
    setAwarding(quoteId)
    setAwardError('')
    try {
      await api.post('/buyer/award-quote', { marketplaceRfqId, quoteId })
      onAward(marketplaceRfqId, quoteId)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to award quote'
      setAwardError(msg)
      setTimeout(() => setAwardError(''), 5000)
    } finally {
      setAwarding(null)
    }
  }

  async function handleSendBidTab() {
    if (!bidTabModal) return
    setSendingBidTab(true)
    setBidTabError('')
    try {
      await api.post('/buyer/send-bid-tab', {
        marketplaceRfqId: bidTabModal.marketplaceRfqId,
        recipientName,
        recipientEmail,
      })
      setBidTabSent(true)
      setTimeout(() => closeModal(), 3000)
    } catch (err) {
      setBidTabError(err instanceof ApiError ? err.message : 'Failed to send bid tab')
    } finally {
      setSendingBidTab(false)
    }
  }

  if (loading) {
    return <div className="text-slate-500 text-sm">Loading…</div>
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
        {error}
      </div>
    )
  }

  if (rfqs.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
        <p className="text-slate-500 text-sm mb-4">
          You haven&apos;t submitted any marketplace RFQs yet.
        </p>
        <Link
          to="/designer"
          className="inline-block bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
        >
          Start by creating a New RFQ
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {rfqs.map(mrfq => {
        const vesselLabel = mrfq.vesselType === 'heat_exchanger' ? 'Heat Exchanger' : 'Pressure Vessel'
        const statusStyle =
          mrfq.status === 'open'    ? 'bg-blue-50 text-blue-700'   :
          mrfq.status === 'awarded' ? 'bg-green-50 text-green-700' :
          'bg-slate-100 text-slate-600'
        const statusLabel = mrfq.status.charAt(0).toUpperCase() + mrfq.status.slice(1)

        return (
          <div key={mrfq.marketplaceRfqId} className="bg-white border border-slate-200 rounded-xl overflow-hidden">

            {/* Card header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="font-semibold text-slate-900 text-sm">{mrfq.rfqTitle}</h2>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                    {vesselLabel}
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusStyle}`}>
                    {statusLabel}
                  </span>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                  <span>{mrfq.installCity}, {mrfq.installState}</span>
                  <span>·</span>
                  <span>Deadline: {mrfq.deadlineAt ? formatDate(mrfq.deadlineAt) : '—'}</span>
                  <span>·</span>
                  <span>{mrfq.quotes.length} {mrfq.quotes.length === 1 ? 'quote' : 'quotes'} received</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {mrfq.status === 'closed' && (
                  <button
                    onClick={() => setReopenModal({ marketplaceRfqId: mrfq.marketplaceRfqId, rfqTitle: mrfq.rfqTitle })}
                    className="border border-slate-200 text-slate-600 text-sm rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors"
                  >
                    Reopen
                  </button>
                )}
                {mrfq.quotes.length > 0 && (
                  <button
                    onClick={() => setBidTabModal({ marketplaceRfqId: mrfq.marketplaceRfqId, rfqTitle: mrfq.rfqTitle })}
                    className="border border-slate-200 text-slate-600 text-sm rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors"
                  >
                    Send Bid Tab
                  </button>
                )}
              </div>
            </div>

            {/* Quotes */}
            {mrfq.quotes.length === 0 ? (
              <div className="px-5 py-4 text-sm text-slate-400">
                No quotes received yet. Check back before your deadline.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wide">Rank</th>
                      <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wide">Fabricator</th>
                      <th className="text-right px-4 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wide">Fab Price</th>
                      <th className="text-right px-4 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wide">Est. Freight</th>
                      <th className="text-right px-4 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wide">Total Delivered</th>
                      <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wide">Lead Time</th>
                      <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wide">Notes</th>
                      {(mrfq.status === 'open' || mrfq.status === 'closed') && (
                        <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wide">Action</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {mrfq.quotes.map((q, i) => (
                      <tr
                        key={q.quoteId}
                        className={`border-b border-slate-100 last:border-0 ${i === 0 ? 'border-l-2 border-l-green-400' : 'border-l-2 border-l-transparent'}`}
                      >
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold ${i === 0 ? 'text-green-600' : 'text-slate-400'}`}>
                            #{i + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{q.shopName}</div>
                          <div className="text-xs text-slate-400">{q.city}, {q.state}</div>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">{fmtPrice(q.fabricatedPrice)}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{fmtPrice(q.estimatedFreight)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">{fmtPrice(q.totalDeliveredPrice)}</td>
                        <td className="px-4 py-3 text-slate-600">{q.leadTimeWeeks} wks</td>
                        <td className="px-4 py-3 text-slate-400 text-xs max-w-[200px]">
                          {q.qualifications
                            ? q.qualifications.slice(0, 60) + (q.qualifications.length > 60 ? '…' : '')
                            : '—'
                          }
                        </td>
                        {(mrfq.status === 'open' || mrfq.status === 'closed') && (
                          <td className="px-4 py-3">
                            {q.status === 'awarded'
                              ? <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded">Awarded ✓</span>
                              : q.status === 'not_awarded'
                              ? <span className="text-xs text-slate-400">Not awarded</span>
                              : <button
                                  onClick={() => handleAward(mrfq.marketplaceRfqId, q.quoteId)}
                                  disabled={awarding === q.quoteId}
                                  className="border border-blue-200 text-blue-700 text-xs rounded px-2 py-1 hover:bg-blue-50 disabled:opacity-50 transition-colors"
                                >
                                  {awarding === q.quoteId ? 'Awarding…' : 'Award'}
                                </button>
                            }
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {awardError && (
                  <div className="px-5 py-2 text-xs text-red-600 bg-red-50 border-t border-red-100">
                    {awardError}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Bid tab modal */}
      {bidTabModal && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-slate-900 mb-1">Send Bid Tabulation</h2>
            <p className="text-sm text-slate-500 mb-5">{bidTabModal.rfqTitle}</p>

            {bidTabSent ? (
              <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
                ✓ Bid tab sent to {recipientEmail}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Recipient Name</label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={e => setRecipientName(e.target.value)}
                    placeholder="e.g. John Smith"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Recipient Email</label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={e => setRecipientEmail(e.target.value)}
                    placeholder="e.g. jsmith@company.com"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {bidTabError && (
                  <div className="text-red-600 text-sm">{bidTabError}</div>
                )}

                <button
                  onClick={handleSendBidTab}
                  disabled={sendingBidTab}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium text-sm rounded-lg px-4 py-2.5 transition-colors"
                >
                  {sendingBidTab ? 'Sending…' : 'Send Bid Tab'}
                </button>

                <button
                  onClick={closeModal}
                  className="text-center text-sm text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Reopen modal */}
      {reopenModal && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
          onClick={closeReopenModal}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-slate-900 mb-1">Reopen RFQ</h2>
            <p className="text-sm text-slate-500 mb-5">{reopenModal.rfqTitle}</p>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New bid deadline</label>
                <select
                  value={reopenDays}
                  onChange={e => setReopenDays(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={21}>21 days</option>
                  <option value={30}>30 days</option>
                </select>
              </div>

              <p className="text-xs text-slate-400">
                This RFQ can only be reopened within 30 days of closing. Eligible fabricators will be notified of the new deadline.
              </p>

              {reopenError && (
                <div className="text-red-600 text-sm">{reopenError}</div>
              )}

              <button
                onClick={handleReopen}
                disabled={reopening}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium text-sm rounded-lg px-4 py-2.5 transition-colors"
              >
                {reopening ? 'Reopening…' : 'Reopen RFQ'}
              </button>

              <button
                onClick={closeReopenModal}
                className="text-center text-sm text-slate-400 hover:text-slate-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const [rfqs, setRfqs]         = useState<RfqFull[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [selectedRfq, setSelectedRfq] = useState<RfqFull | null>(null)

  const [activeTab,  setActiveTab]  = useState<'rfqs' | 'marketplace'>('rfqs')
  const [mktRfqs,    setMktRfqs]    = useState<MarketplaceRfqWithQuotes[]>([])
  const [mktLoading, setMktLoading] = useState(true)
  const [mktError,   setMktError]   = useState('')

  useEffect(() => {
    api
      .get<{ rfqs: RfqFull[] }>('/rfqs')
      .then(({ rfqs }) => setRfqs(rfqs))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load RFQs'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    api
      .get<{ rfqs: MarketplaceRfqWithQuotes[] }>('/buyer/marketplace-quotes')
      .then(({ rfqs }) => setMktRfqs(rfqs))
      .catch((err) => setMktError(err instanceof ApiError ? err.message : 'Failed to load marketplace quotes'))
      .finally(() => setMktLoading(false))
  }, [])

  const totalQuoteCount = mktRfqs.reduce((sum, r) => sum + r.quotes.length, 0)

  function handleReopenLocal(marketplaceRfqId: number, newDeadline: string) {
    setMktRfqs(prev => prev.map(r =>
      r.marketplaceRfqId !== marketplaceRfqId ? r : { ...r, status: 'open', deadlineAt: newDeadline }
    ))
  }

  function handleAwardLocal(marketplaceRfqId: number, winningQuoteId: number) {
    setMktRfqs(prev => prev.map(r => {
      if (r.marketplaceRfqId !== marketplaceRfqId) return r
      return {
        ...r,
        status: 'awarded',
        quotes: r.quotes.map(q => ({
          ...q,
          status: q.quoteId === winningQuoteId ? 'awarded' : 'not_awarded',
        })),
      }
    }))
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('rfqs')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'rfqs'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                My RFQs
              </button>
              <button
                onClick={() => setActiveTab('marketplace')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'marketplace'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Marketplace Quotes
                {totalQuoteCount > 0 && (
                  <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                    {totalQuoteCount}
                  </span>
                )}
              </button>
            </div>
          </div>
          <Link
            to="/designer"
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + New RFQ
          </Link>
        </div>

        {activeTab === 'rfqs' ? (
          <>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
                {error}
              </div>
            )}

            {loading ? (
              <div className="text-slate-500 text-sm">Loading…</div>
            ) : rfqs.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
                <p className="text-slate-500 text-sm mb-4">No RFQs yet.</p>
                <Link
                  to="/designer"
                  className="inline-block bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
                >
                  Design your first vessel
                </Link>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Title</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Shell OD</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">MAWP</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Nozzles</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rfqs.map((rfq, i) => (
                      <tr
                        key={rfq.id}
                        onClick={() => setSelectedRfq(rfq)}
                        className={`cursor-pointer hover:bg-slate-50 transition-colors ${i < rfqs.length - 1 ? 'border-b border-slate-100' : ''}`}
                      >
                        <td className="px-4 py-3 font-medium text-slate-900">{rfq.title}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {rfq.shellOd ? `${rfq.shellOd}"` : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {rfq.mawp ? `${rfq.mawp} psi` : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{rfq.nozzleCount}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[rfq.status] ?? 'bg-slate-100 text-slate-600'}`}
                          >
                            {STATUS_LABEL[rfq.status] ?? rfq.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{formatDate(rfq.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </>
        ) : (
          <MarketplaceQuotesView rfqs={mktRfqs} loading={mktLoading} error={mktError} onAward={handleAwardLocal} onReopen={handleReopenLocal} />
        )}
      </main>

      {selectedRfq && (
        <RfqDetailPanel rfq={selectedRfq} onClose={() => setSelectedRfq(null)} />
      )}
    </div>
  )
}
