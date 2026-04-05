import { useState } from 'react'
import type { CSSProperties } from 'react'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
]

interface Props {
  isOpen: boolean
  onClose: () => void
  onSubmitMarketplace: (installCity: string, installState: string, deadlineDays: number) => void
  onSubmitDirect: () => void
  submitting: boolean
}

export default function MarketplaceSubmitModal({
  isOpen,
  onClose,
  onSubmitMarketplace,
  onSubmitDirect: _onSubmitDirect,
  submitting,
}: Props) {
  const [selected, setSelected] = useState<'marketplace'>('marketplace')
  const [installCity,  setInstallCity]  = useState('')
  const [installState, setInstallState] = useState('')
  const [deadlineDays, setDeadlineDays] = useState(14)

  if (!isOpen) return null

  const canSubmit = installCity.trim().length > 0 && installState.length > 0

  function handleSubmit() {
    if (!canSubmit || submitting) return
    onSubmitMarketplace(installCity.trim(), installState, deadlineDays)
  }

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
    marginBottom:  6,
    display:       'block',
  }

  return (
    <div style={{
      position:       'fixed',
      inset:          0,
      zIndex:         200,
      background:     'rgba(2, 6, 23, 0.82)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        16,
    }}>
      <div style={{
        background:  '#1e293b',
        border:      '0.5px solid #334155',
        borderRadius: 12,
        width:        '100%',
        maxWidth:     480,
        maxHeight:    'calc(100vh - 32px)',
        overflowY:    'auto',
        padding:      '28px 28px 24px',
      }}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <h2 style={{
          margin:     '0 0 6px',
          fontSize:   17,
          fontWeight: 600,
          color:      '#f1f5f9',
          lineHeight: 1.3,
        }}>
          How would you like to submit this RFQ?
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
          Choose how your RFQ will be routed to fabricators.
        </p>

        {/* ── Option cards ────────────────────────────────────────────── */}
        <div style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap:                 12,
          marginBottom:        20,
        }}>

          {/* Card 1 — Open Marketplace */}
          <button
            type="button"
            onClick={() => setSelected('marketplace')}
            style={{
              background:    '#0f172a',
              border:        `1.5px solid ${selected === 'marketplace' ? '#60a5fa' : '#334155'}`,
              borderRadius:  10,
              padding:       '16px 14px',
              cursor:        'pointer',
              textAlign:     'left',
              display:       'flex',
              flexDirection: 'column',
              gap:           10,
              outline:       'none',
              transition:    'border-color 0.15s',
            }}
          >
            {/* Broadcast / signal icon */}
            <svg width="28" height="24" viewBox="0 0 28 24" fill="none"
              style={{ color: selected === 'marketplace' ? '#60a5fa' : '#475569', flexShrink: 0 }}>
              <path d="M3 12C3 6.477 7.925 2 14 2C20.075 2 25 6.477 25 12"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M7 12C7 8.686 10.134 6 14 6C17.866 6 21 8.686 21 12"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M11 12C11 10.343 12.343 9 14 9C15.657 9 17 10.343 17 12"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="14" cy="15" r="2" fill="currentColor"/>
            </svg>
            <div>
              <div style={{
                fontSize:     13,
                fontWeight:   600,
                color:        selected === 'marketplace' ? '#f1f5f9' : '#94a3b8',
                marginBottom: 6,
              }}>
                Open Marketplace
              </div>
              <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.55 }}>
                All qualified fabricators in the VesselRFQ network will be notified and can submit competitive bids.
              </div>
            </div>
          </button>

          {/* Card 2 — Select Fabricators (coming soon) */}
          <div style={{
            background:     '#0f172a',
            border:         '1.5px solid #1e293b',
            borderRadius:   10,
            padding:        '16px 14px',
            cursor:         'not-allowed',
            textAlign:      'left',
            display:        'flex',
            flexDirection:  'column',
            gap:            10,
            opacity:        0.5,
            position:       'relative',
          }}>
            {/* Coming soon badge */}
            <div style={{
              position:      'absolute',
              top:           10,
              right:         10,
              background:    '#451a03',
              border:        '0.5px solid #92400e',
              borderRadius:  4,
              padding:       '2px 7px',
              fontSize:      9,
              fontWeight:    700,
              color:         '#fbbf24',
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
            }}>
              Coming soon
            </div>
            {/* Checklist icon */}
            <svg width="28" height="24" viewBox="0 0 28 24" fill="none"
              style={{ color: '#334155', flexShrink: 0 }}>
              <rect x="3" y="4"  width="4" height="4" rx="1" fill="currentColor"/>
              <rect x="3" y="10" width="4" height="4" rx="1" fill="currentColor"/>
              <rect x="3" y="16" width="4" height="4" rx="1" fill="currentColor"/>
              <line x1="10" y1="6"  x2="25" y2="6"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="10" y1="12" x2="25" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="10" y1="18" x2="25" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                Select Fabricators
              </div>
              <div style={{ fontSize: 11, color: '#334155', lineHeight: 1.55 }}>
                Choose specific fabricators from the network to send this RFQ to.
              </div>
            </div>
          </div>

        </div>

        {/* ── Marketplace fields ───────────────────────────────────────── */}
        <div style={{
          background:   '#0f172a',
          border:       '0.5px solid #334155',
          borderRadius: 8,
          padding:      '16px',
          marginBottom: 20,
        }}>
          <p style={{ margin: '0 0 14px', fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
            Installation location helps route your RFQ to fabricators who ship to your region.
          </p>

          {/* City + State row */}
          <div style={{
            display:             'grid',
            gridTemplateColumns: '1fr 90px',
            gap:                 10,
            marginBottom:        12,
          }}>
            <div>
              <span style={fieldLabel}>Installation City</span>
              <input
                type="text"
                placeholder="e.g. Houston"
                value={installCity}
                onChange={e => setInstallCity(e.target.value)}
                style={inputBase}
              />
            </div>
            <div>
              <span style={fieldLabel}>State</span>
              <select
                value={installState}
                onChange={e => setInstallState(e.target.value)}
                style={inputBase}
              >
                <option value="">—</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Deadline */}
          <div>
            <span style={fieldLabel}>Bid Deadline</span>
            <select
              value={deadlineDays}
              onChange={e => setDeadlineDays(parseInt(e.target.value))}
              style={inputBase}
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={21}>21 days</option>
              <option value={30}>30 days</option>
            </select>
          </div>
        </div>

        {/* ── Submit button ────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          style={{
            width:        '100%',
            padding:      '10px 0',
            background:   canSubmit && !submitting ? '#1d4ed8' : '#0f172a',
            border:       `0.5px solid ${canSubmit && !submitting ? '#2563eb' : '#1e293b'}`,
            borderRadius: 7,
            color:        canSubmit && !submitting ? '#f1f5f9' : '#334155',
            fontSize:     14,
            fontWeight:   500,
            cursor:       canSubmit && !submitting ? 'pointer' : 'not-allowed',
            fontFamily:   'inherit',
            marginBottom: 12,
            transition:   'background 0.15s, color 0.15s',
          }}
        >
          {submitting ? 'Submitting…' : 'Submit to Marketplace'}
        </button>

        {/* ── Cancel ──────────────────────────────────────────────────── */}
        <div style={{ textAlign: 'center' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              background: 'none',
              border:     'none',
              color:      '#475569',
              fontSize:   13,
              cursor:     submitting ? 'default' : 'pointer',
              fontFamily: 'inherit',
              padding:    0,
            }}
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  )
}
