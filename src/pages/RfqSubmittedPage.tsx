import { useEffect } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import Navbar from '../components/Navbar'

interface SubmittedState {
  rfqId: number
  title: string
  vesselType: 'tank' | 'heat_exchanger'
  shellOd?: string
  shellLength?: string
  headType?: string
  mawp?: string
  temaCode?: string
  nozzleCount: number
}

export default function RfqSubmittedPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as SubmittedState | null

  useEffect(() => {
    if (!state) navigate('/dashboard', { replace: true })
  }, [state, navigate])

  if (!state) return null

  const isTank = state.vesselType === 'tank'

  const specs: { label: string; value: string | number | undefined }[] = isTank
    ? [
        { label: 'Shell OD',     value: state.shellOd     ? `${state.shellOd}"` : undefined },
        { label: 'Shell Length', value: state.shellLength  ? `${state.shellLength}"` : undefined },
        { label: 'Head Type',    value: state.headType    ?? undefined },
        { label: 'MAWP',         value: state.mawp        ? `${state.mawp} psig` : undefined },
        { label: 'Nozzles',      value: state.nozzleCount || undefined },
      ]
    : [
        { label: 'TEMA',         value: state.temaCode    ?? undefined },
        { label: 'Shell OD',     value: state.shellOd     ? `${state.shellOd}"` : undefined },
        { label: 'Shell Length', value: state.shellLength  ? `${state.shellLength}"` : undefined },
        { label: 'MAWP',         value: state.mawp        ? `${state.mawp} psig` : undefined },
        { label: 'Nozzles',      value: state.nozzleCount || undefined },
      ]

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 py-16">

        {/* Checkmark */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        {/* Heading */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Your RFQ has been submitted</h1>
          <p className="mt-1 text-slate-500 text-sm">RFQ #{state.rfqId}</p>
        </div>

        {/* Specs card */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-5">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
            <p className="font-semibold text-slate-800 text-sm truncate">{state.title}</p>
            <p className="text-xs text-slate-500">{isTank ? 'Pressure Vessel' : 'Heat Exchanger'}</p>
          </div>
          <dl className="divide-y divide-slate-100">
            {specs.filter(s => s.value !== undefined && s.value !== '').map(s => (
              <div key={s.label} className="flex px-5 py-2.5">
                <dt className="w-36 shrink-0 text-sm text-slate-500">{s.label}</dt>
                <dd className="text-sm font-medium text-slate-800">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Info box */}
        <div className="rounded-xl bg-blue-50 border border-blue-200 px-5 py-4 mb-8">
          <p className="text-sm text-blue-800 leading-relaxed">
            <span className="font-semibold">What happens next?</span> Your RFQ will be routed
            to a maximum of 3 qualified ASME fabricators in your region with protected
            territories. Expect quotes within <span className="font-semibold">5–7 business days</span>.
            A confirmation has been sent to your email.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            to="/dashboard"
            className="flex-1 text-center px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 transition-colors"
          >
            Back to Dashboard
          </Link>
          <Link
            to="/designer"
            className="flex-1 text-center px-5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            Submit Another RFQ
          </Link>
        </div>

      </div>
    </div>
  )
}
