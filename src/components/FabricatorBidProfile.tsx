import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { api } from '../lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface EligibilityStatus {
  subscriptionActive: boolean
  embedVerified: boolean
  bidProfileComplete: boolean
  lastEmbedCheck: string | null
}

interface BidProfileGetResponse {
  exists: boolean
  equipmentTypes?:    string[]
  materials?:         string[]
  maxDiameterInches?: string | null
  maxLengthInches?:   string | null
  maxWeightLbs?:      string | null
  shipToStates?:      string[]
  acceptingWork?:     boolean
}

interface BidProfileForm {
  equipmentTypes: string[]
  materials: string[]
  maxDiameterInches: string
  maxLengthInches: string
  maxWeightLbs: string
  shipToStates: string
  acceptingWork: boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EQUIPMENT_OPTIONS = [
  { value: 'pressure_vessel', label: 'Pressure Vessels' },
  { value: 'heat_exchanger',  label: 'Heat Exchangers'  },
]

const MATERIAL_OPTIONS = [
  { value: 'carbon_steel',  label: 'Carbon Steel'  },
  { value: 'stainless_304', label: 'Stainless 304' },
  { value: 'stainless_316', label: 'Stainless 316' },
  { value: 'chrome_moly',   label: 'Chrome-Moly'   },
  { value: 'duplex',        label: 'Duplex'        },
  { value: 'hastelloy',     label: 'Hastelloy'     },
  { value: 'inconel',       label: 'Inconel'       },
  { value: 'titanium',      label: 'Titanium'      },
]

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusRow({
  label,
  value,
  loading,
  last = false,
}: {
  label: string
  value: boolean
  loading: boolean
  last?: boolean
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 0',
      borderBottom: last ? 'none' : '0.5px solid #334155',
    }}>
      {loading ? (
        <div style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#334155',
          flexShrink: 0,
        }} />
      ) : value ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10" fill="#16a34a" />
          <polyline
            points="8 12 11 15 16 9"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10" fill="#dc2626" />
          <line x1="9" y1="9" x2="15" y2="15" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          <line x1="15" y1="9" x2="9"  y2="15" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
      <span style={{ fontSize: 13, color: loading ? '#475569' : '#f1f5f9' }}>{label}</span>
      {loading && (
        <span style={{ fontSize: 11, color: '#334155', marginLeft: 'auto' }}>checking…</span>
      )}
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      style={{
        width: 42,
        height: 24,
        borderRadius: 12,
        background: value ? '#1d4ed8' : '#334155',
        cursor: 'pointer',
        position: 'relative',
        flexShrink: 0,
        border: `0.5px solid ${value ? '#2563eb' : '#475569'}`,
        transition: 'background 0.15s',
      }}
    >
      <div style={{
        position: 'absolute',
        top: 3,
        left: value ? 22 : 3,
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: value ? '#60a5fa' : '#64748b',
        transition: 'left 0.15s',
      }} />
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function FabricatorBidProfile() {
  const [eligibilityLoading, setEligibilityLoading] = useState(true)
  const [eligibility, setEligibility] = useState<EligibilityStatus | null>(null)

  const [form, setForm] = useState<BidProfileForm>({
    equipmentTypes:    [],
    materials:         [],
    maxDiameterInches: '',
    maxLengthInches:   '',
    maxWeightLbs:      '',
    shipToStates:      '',
    acceptingWork:     true,
  })
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    api.get<EligibilityStatus>('/fabricator/eligibility')
      .then(data  => setEligibility(data))
      .catch(()   => setEligibility(null))
      .finally(() => setEligibilityLoading(false))
  }, [])

  useEffect(() => {
    api.get<BidProfileGetResponse>('/fabricator/bid-profile')
      .then(data => {
        if (!data.exists) return
        setForm({
          equipmentTypes:    data.equipmentTypes    ?? [],
          materials:         data.materials         ?? [],
          maxDiameterInches: data.maxDiameterInches ?? '',
          maxLengthInches:   data.maxLengthInches   ?? '',
          maxWeightLbs:      data.maxWeightLbs       ?? '',
          shipToStates:      (data.shipToStates      ?? []).join(', '),
          acceptingWork:     data.acceptingWork      ?? true,
        })
      })
      .catch(() => {})
  }, [])

  const allEligible = !!(
    eligibility?.subscriptionActive &&
    eligibility.embedVerified &&
    eligibility.bidProfileComplete
  )

  function toggleArrayValue(arr: string[], val: string): string[] {
    return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]
  }

  function handleSave() {
    setSaving(true)
    setSaveError('')

    const payload = {
      equipmentTypes:    form.equipmentTypes,
      materials:         form.materials,
      maxDiameterInches: form.maxDiameterInches ? parseFloat(form.maxDiameterInches) : null,
      maxLengthInches:   form.maxLengthInches   ? parseFloat(form.maxLengthInches)   : null,
      maxWeightLbs:      form.maxWeightLbs       ? parseFloat(form.maxWeightLbs)       : null,
      shipToStates:      form.shipToStates.split(',').map(s => s.trim().toUpperCase()).filter(Boolean),
      acceptingWork:     form.acceptingWork,
    }

    api.post<BidProfileGetResponse>('/fabricator/bid-profile', payload)
      .then(() => {
        setSaving(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
        // Re-fetch eligibility so "Bid profile complete" updates immediately
        api.get<EligibilityStatus>('/fabricator/eligibility')
          .then(data  => setEligibility(data))
          .catch(()   => {})
      })
      .catch((err: unknown) => {
        setSaving(false)
        const msg = err instanceof Error ? err.message : 'Failed to save'
        setSaveError(msg)
        setTimeout(() => setSaveError(''), 5000)
      })
  }

  // ── Shared styles ──────────────────────────────────────────────────────────

  const inputBase: CSSProperties = {
    background:   '#0f172a',
    border:       '0.5px solid #334155',
    borderRadius: 6,
    color:        '#f1f5f9',
    fontSize:     13,
    padding:      '8px 10px',
    fontFamily:   'inherit',
    outline:      'none',
    width:        '100%',
    boxSizing:    'border-box',
  }

  const fieldLabel: CSSProperties = {
    fontSize:      11,
    fontWeight:    500,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color:         '#475569',
    marginBottom:  8,
    display:       'block',
  }

  const sectionHead: CSSProperties = {
    fontSize:     14,
    fontWeight:   600,
    color:        '#f1f5f9',
    marginBottom: 16,
    marginTop:    0,
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ overflowY: 'auto', flex: 1, background: '#0f172a' }}>

      {/* ── Section 1: Marketplace Eligibility ────────────────────────── */}
      <div style={{ padding: '24px 24px 20px', borderBottom: '0.5px solid #1e293b' }}>
        <h2 style={sectionHead}>Marketplace Eligibility</h2>

        {/* Status rows */}
        <div style={{
          background:   '#1e293b',
          border:       '0.5px solid #334155',
          borderRadius: 8,
          padding:      '0 16px',
          marginBottom: 12,
        }}>
          <StatusRow label="Subscription active" value={eligibility?.subscriptionActive ?? false} loading={eligibilityLoading} />
          <StatusRow label="Embed verified"       value={eligibility?.embedVerified      ?? false} loading={eligibilityLoading} />
          <StatusRow label="Bid profile complete" value={eligibility?.bidProfileComplete  ?? false} loading={eligibilityLoading} last />
        </div>

        {/* Last embed check date */}
        {!eligibilityLoading && eligibility?.lastEmbedCheck && (
          <div style={{ fontSize: 11, color: '#475569', marginBottom: 12 }}>
            Last embed check:{' '}
            {new Date(eligibility.lastEmbedCheck).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </div>
        )}

        {/* Eligibility banner */}
        {!eligibilityLoading && (
          <div style={{
            borderRadius: 6,
            padding:      '10px 14px',
            fontSize:     13,
            fontWeight:   500,
            background:   allEligible ? '#052e16' : '#1c1917',
            border:       `0.5px solid ${allEligible ? '#16a34a' : '#44403c'}`,
            color:        allEligible ? '#86efac' : '#a8a29e',
          }}>
            {allEligible
              ? '✓  You are eligible to bid on marketplace RFQs'
              : 'Complete the items above to access marketplace bidding'}
          </div>
        )}
      </div>

      {/* ── Section 2: Bid Profile Form ───────────────────────────────── */}
      <div style={{ padding: '24px 24px 32px' }}>
        <h2 style={sectionHead}>Bid Profile</h2>

        {/* Equipment Types */}
        <div style={{ marginBottom: 22 }}>
          <span style={fieldLabel}>Equipment Types</span>
          <div style={{ display: 'flex', gap: 24 }}>
            {EQUIPMENT_OPTIONS.map(opt => (
              <label
                key={opt.value}
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#f1f5f9' }}
              >
                <input
                  type="checkbox"
                  checked={form.equipmentTypes.includes(opt.value)}
                  onChange={() => setForm(f => ({ ...f, equipmentTypes: toggleArrayValue(f.equipmentTypes, opt.value) }))}
                  style={{ accentColor: '#60a5fa', width: 15, height: 15, cursor: 'pointer' }}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {/* Materials */}
        <div style={{ marginBottom: 22 }}>
          <span style={fieldLabel}>Materials</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 32px' }}>
            {MATERIAL_OPTIONS.map(opt => (
              <label
                key={opt.value}
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#f1f5f9' }}
              >
                <input
                  type="checkbox"
                  checked={form.materials.includes(opt.value)}
                  onChange={() => setForm(f => ({ ...f, materials: toggleArrayValue(f.materials, opt.value) }))}
                  style={{ accentColor: '#60a5fa', width: 15, height: 15, cursor: 'pointer' }}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {/* Fabrication Capacity */}
        <div style={{ marginBottom: 22 }}>
          <span style={fieldLabel}>
            Fabrication Capacity{' '}
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: '#475569', marginBottom: 5 }}>Max Diameter (in)</div>
              <input
                type="number"
                min={0}
                placeholder="e.g. 144"
                value={form.maxDiameterInches}
                onChange={e => setForm(f => ({ ...f, maxDiameterInches: e.target.value }))}
                style={inputBase}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#475569', marginBottom: 5 }}>Max Length (in)</div>
              <input
                type="number"
                min={0}
                placeholder="e.g. 480"
                value={form.maxLengthInches}
                onChange={e => setForm(f => ({ ...f, maxLengthInches: e.target.value }))}
                style={inputBase}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#475569', marginBottom: 5 }}>Max Weight (lbs)</div>
              <input
                type="number"
                min={0}
                placeholder="e.g. 50000"
                value={form.maxWeightLbs}
                onChange={e => setForm(f => ({ ...f, maxWeightLbs: e.target.value }))}
                style={inputBase}
              />
            </div>
          </div>
        </div>

        {/* Ship-to States */}
        <div style={{ marginBottom: 22 }}>
          <span style={fieldLabel}>Ship-to States</span>
          <input
            type="text"
            placeholder="TX, LA, OK, AR, NM"
            value={form.shipToStates}
            onChange={e => setForm(f => ({ ...f, shipToStates: e.target.value }))}
            style={inputBase}
          />
          <div style={{ fontSize: 11, color: '#475569', marginTop: 5 }}>
            Leave blank to indicate you will ship anywhere in the US
          </div>
        </div>

        {/* Accepting Work toggle */}
        <div style={{ marginBottom: 28 }}>
          <span style={fieldLabel}>Availability</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Toggle
              value={form.acceptingWork}
              onChange={v => setForm(f => ({ ...f, acceptingWork: v }))}
            />
            <span style={{ fontSize: 13, color: form.acceptingWork ? '#f1f5f9' : '#475569' }}>
              {form.acceptingWork ? 'Currently accepting new work' : 'Not accepting new work'}
            </span>
          </div>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding:      '9px 24px',
            background:   saved ? '#052e16' : '#1d4ed8',
            border:       `0.5px solid ${saved ? '#16a34a' : '#2563eb'}`,
            borderRadius: 6,
            color:        saved ? '#86efac' : '#f1f5f9',
            fontSize:     13,
            fontWeight:   500,
            cursor:       saving ? 'default' : 'pointer',
            fontFamily:   'inherit',
            transition:   'background 0.15s, color 0.15s',
          }}
        >
          {saved ? 'Saved' : saving ? 'Saving…' : 'Save Bid Profile'}
        </button>

        {saveError && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#f87171' }}>
            {saveError}
          </div>
        )}
      </div>

    </div>
  )
}
