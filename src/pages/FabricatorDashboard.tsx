import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { api } from '../lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

type RfqStatus = 'received' | 'reviewed' | 'quoted' | 'awarded'
type FilterState = RfqStatus | 'all'

interface NozzleItem {
  mark: string
  size: string
  rating: string
  service: string
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
      mark:    n.mark,
      size:    n.size,
      rating:  n.rating,
      service: n.service ?? '',
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
            { label: 'Shell ID',     value: rfq.shellId },
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
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <NTh>Mark</NTh>
                <NTh>Size</NTh>
                <NTh>Rating</NTh>
                <NTh>Service</NTh>
              </tr>
            </thead>
            <tbody>
              {rfq.nozzles.map((n, i) => (
                <tr key={n.mark} style={{ background: i % 2 === 0 ? '#0f172a' : '#1e293b' }}>
                  <td style={{ padding: '5px 8px', color: '#60a5fa', fontWeight: 500 }}>{n.mark}</td>
                  <td style={{ padding: '5px 8px', color: '#cbd5e1' }}>{n.size}</td>
                  <td style={{ padding: '5px 8px', color: '#cbd5e1' }}>{n.rating}</td>
                  <td style={{ padding: '5px 8px', color: '#64748b' }}>{n.service}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

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

          <div style={{ position: 'relative' }}>
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

  useEffect(() => {
    api.get<{ rfqs: ApiRfq[] }>('/rfqs/all')
      .then(({ rfqs: rows }) => setRfqs(rows.map(mapApiRfq)))
      .catch(() => setFetchError('Failed to load RFQs'))
      .finally(() => setLoading(false))
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
