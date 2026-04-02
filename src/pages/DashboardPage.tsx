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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
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

function RfqDetailPanel({ rfq, onClose }: { rfq: RfqSummary; onClose: () => void }) {
  const isTank = rfq.vesselType !== 'heat_exchanger'
  const typeLabel = rfq.vesselType === 'heat_exchanger' ? 'Heat Exchanger' : 'Pressure Vessel / Tank'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />
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
          <div className="mb-4 flex items-center gap-2">
            <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR_DARK[rfq.status] ?? 'bg-slate-700 text-slate-200'}`}>
              {STATUS_LABEL[rfq.status] ?? rfq.status}
            </span>
            {typeLabel && (
              <span className="text-xs text-slate-400">{typeLabel}</span>
            )}
          </div>

          <div className="divide-y divide-slate-700">
            {isTank ? (
              <>
                <SpecRow label="Shell OD" value={rfq.shellOd ? `${rfq.shellOd}"` : null} />
                <SpecRow label="T/T Length" value={rfq.shellLength ? `${rfq.shellLength}"` : null} />
                <SpecRow label="Shell Material" value={rfq.shellMaterial} />
                <SpecRow label="Head Type" value={rfq.headType} />
                <SpecRow label="MAWP" value={rfq.mawp ? `${rfq.mawp} psig` : null} />
                <SpecRow label="Design Temp" value={rfq.designTemp != null ? `${rfq.designTemp}°F` : null} />
                <SpecRow label="Nozzles" value={rfq.nozzleCount || null} />
              </>
            ) : (
              <>
                <SpecRow label="Shell OD" value={rfq.shellOd ? `${rfq.shellOd}"` : null} />
                <SpecRow label="Shell Length" value={rfq.shellLength ? `${rfq.shellLength}"` : null} />
                <SpecRow label="Shell Material" value={rfq.shellMaterial} />
                <SpecRow label="Shell MAWP" value={rfq.mawp ? `${rfq.mawp} psig` : null} />
                <SpecRow label="Shell Design Temp" value={rfq.designTemp != null ? `${rfq.designTemp}°F` : null} />
                <SpecRow label="Nozzles" value={rfq.nozzleCount || null} />
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default function DashboardPage() {
  const [rfqs, setRfqs] = useState<RfqSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedRfq, setSelectedRfq] = useState<RfqSummary | null>(null)

  useEffect(() => {
    api
      .get<{ rfqs: RfqSummary[] }>('/rfqs')
      .then(({ rfqs }) => setRfqs(rfqs))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load RFQs'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-slate-900">My RFQs</h1>
          <Link
            to="/designer"
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + New RFQ
          </Link>
        </div>

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
      </main>

      {selectedRfq && (
        <RfqDetailPanel rfq={selectedRfq} onClose={() => setSelectedRfq(null)} />
      )}
    </div>
  )
}
