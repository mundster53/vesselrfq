import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api, ApiError } from '../lib/api'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
]

const STAMP_OPTIONS = [
  { code: 'U',   label: 'U — Pressure Vessels (Div. 1)' },
  { code: 'U2',  label: 'U2 — Pressure Vessels (Div. 2)' },
  { code: 'U3',  label: 'U3 — Cryogenic Vessels' },
  { code: 'S',   label: 'S — Power Boilers' },
  { code: 'R',   label: 'R — Repair and Alteration' },
  { code: 'PP',  label: 'PP — Pressure Piping' },
  { code: 'H',   label: 'H — Heating Boilers' },
  { code: 'HLW', label: 'HLW — Lined Potable Water Heaters' },
  { code: 'UM',  label: 'UM — Miniature Vessels' },
  { code: 'NB',  label: 'NB — National Board' },
]

interface ProfileData {
  shopName: string
  city: string
  state: string
  stamps: string[]
  contactName: string
  phone: string
  website: string
  rfqEmail: string | null
}

export default function FabricatorOnboardingPage() {
  const { user, refresh } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [checkLoading, setCheckLoading] = useState(true)
  const [error, setError] = useState('')

  const [shopName, setShopName] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [stamps, setStamps] = useState<string[]>([])
  const [contactName, setContactName] = useState('')
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [rfqEmail, setRfqEmail] = useState(user?.email ?? '')

  // If profile already exists, skip onboarding
  useEffect(() => {
    api.get<{ exists: boolean; profile?: ProfileData }>('/fabricator/profile')
      .then(({ exists, profile }) => {
        if (exists && profile) {
          navigate('/fabricator-dashboard', { replace: true })
        }
      })
      .catch(() => {}) // ignore — just show the form
      .finally(() => setCheckLoading(false))
  }, [navigate])

  function toggleStamp(code: string) {
    setStamps(prev =>
      prev.includes(code) ? prev.filter(s => s !== code) : [...prev, code]
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (step < 3) {
      setStep(s => s + 1)
      return
    }
    setError('')
    setLoading(true)
    try {
      await api.post('/fabricator/profile', {
        shopName, city, state, stamps, contactName, phone,
        website: website.trim() || null,
        rfqEmail: rfqEmail.trim(),
      })
      await refresh()
      navigate('/fabricator-dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save profile. Please try again.')
      setLoading(false)
    }
  }

  if (checkLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading…</div>
      </div>
    )
  }

  const stepValid = (() => {
    if (step === 1) return shopName.trim() !== '' && city.trim() !== '' && state !== ''
    if (step === 2) return stamps.length > 0
    if (step === 3) return contactName.trim() !== '' && phone.trim() !== '' && rfqEmail.trim() !== ''
    return false
  })()

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900">VesselRFQ</h1>
          <p className="text-slate-500 text-sm mt-1">Set up your shop profile</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3].map(n => (
            <div key={n} className="flex-1 flex items-center gap-2">
              <div className={`flex-1 h-1.5 rounded-full transition-colors ${
                n <= step ? 'bg-blue-600' : 'bg-slate-200'
              }`} />
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}

          {/* Step 1 — Shop Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Shop information</h2>
                <p className="text-sm text-slate-500 mt-0.5">This appears on your configurator and RFQ notifications.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Shop name</label>
                <input
                  type="text"
                  required
                  value={shopName}
                  onChange={e => setShopName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Acme Pressure Vessel, Inc."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Houston"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                  <select
                    required
                    value={state}
                    onChange={e => setState(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="">—</option>
                    {US_STATES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2 — ASME Stamps */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">ASME stamps held</h2>
                <p className="text-sm text-slate-500 mt-0.5">Select all that apply. This determines which RFQs you receive.</p>
              </div>

              <div className="space-y-2.5">
                {STAMP_OPTIONS.map(({ code, label }) => (
                  <label key={code} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={stamps.includes(code)}
                      onChange={() => toggleStamp(code)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
                    />
                    <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">{label}</span>
                  </label>
                ))}
              </div>

              {stamps.length === 0 && (
                <p className="text-xs text-amber-600">Select at least one stamp to continue.</p>
              )}
            </div>
          )}

          {/* Step 3 — Contact */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Contact information</h2>
                <p className="text-sm text-slate-500 mt-0.5">Who buyers should contact when they receive a quote.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contact name</label>
                <input
                  type="text"
                  required
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="John Smith"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="(713) 555-0100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">RFQ notification email</label>
                <input
                  type="email"
                  required
                  value={rfqEmail}
                  onChange={e => setRfqEmail(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-400 mt-1">Where should we send new RFQ alerts?</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Website <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="url"
                  value={website}
                  onChange={e => setWebsite(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://yourshop.com"
                />
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(s => s - 1)}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                ← Back
              </button>
            ) : (
              <div />
            )}

            <button
              type="submit"
              disabled={!stepValid || loading}
              className="bg-slate-900 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-sm rounded-lg px-5 py-2.5 transition-colors"
            >
              {step < 3
                ? 'Continue →'
                : loading
                  ? 'Saving…'
                  : 'Go to dashboard →'}
            </button>
          </div>
        </form>

        <p className="text-center text-xs text-slate-400 mt-4">
          Step {step} of 3
        </p>
      </div>
    </div>
  )
}
