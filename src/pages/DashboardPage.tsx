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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function DashboardPage() {
  const [rfqs, setRfqs] = useState<RfqSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
                    className={i < rfqs.length - 1 ? 'border-b border-slate-100' : ''}
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
        )}
      </main>
    </div>
  )
}
