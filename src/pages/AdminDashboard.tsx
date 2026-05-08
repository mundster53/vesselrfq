import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'

type AdminView = 'marketplace' | 'fabricators' | 'users' | 'analytics' | 'notifications'

// ── Types ──────────────────────────────────────────────────────────────────────

interface MarketplaceRfqRow {
  id:           number
  rfqId:        number
  status:       'open' | 'closed' | 'awarded' | 'cancelled'
  installCity:  string
  installState: string
  deadlineAt:   string | null
  createdAt:    string
  rfqTitle:     string
  vesselType:   string | null
  shellOd:      string | null
  buyerEmail:   string
  quoteCount:   number
}


interface FabricatorRow {
  id:                number
  email:             string
  active:            boolean
  shopName:          string
  contactName:       string
  city:              string
  state:             string
  stamps:            string[]
  website:           string | null
  profileComplete:   boolean | null
  acceptingWork:     boolean | null
  equipmentTypes:    string[] | null
  materials:         string[] | null
  shipToStates:      string[] | null
  lastEmbedCheck:    string | null
  lastEmbedVerified: boolean | null
  bidProfileExists:  boolean
  registeredAt:      string
}

interface QuoteRow {
  id:                  number
  shopName:            string
  contactName:         string
  fabricatedPrice:     string
  estimatedFreight:    string
  totalDeliveredPrice: string | null
  leadTimeWeeks:       number
  qualifications:      string | null
  status:              string
  submittedAt:         string
}

interface NozzleRow {
  id:         number
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

interface RfqSpec {
  id:                  number
  title:               string
  vesselType:          string | null
  shellOd:             string | null
  shellLength:         string | null
  shellMaterial:       string | null
  headType:            string | null
  mawp:                string | null
  designTemp:          number | null
  corrosionAllowance:  string | null
  supportType:         string | null
  temaFront:           string | null
  temaShell:           string | null
  temaRear:            string | null
  tubeCount:           number | null
  tubeOd:              string | null
  tubeBwg:             string | null
  tubeLength:          string | null
  shellMawp:           string | null
  shellDesignTemp:     number | null
  tubeMawp:            string | null
  tubeDesignTemp:      number | null
  notes:               string | null
}

interface RfqDetail {
  spec:    RfqSpec | null
  nozzles: NozzleRow[]
  quotes:  QuoteRow[]
}

interface BuyerAdminRow {
  id:          number
  email:       string
  active:      boolean
  createdAt:   string
  firstName:   string | null
  lastName:    string | null
  companyName: string | null
  rfqCount:    number
  lastRfqAt:   string | null
}

interface AnalyticsData {
  platform: {
    totalRfqs:          number
    totalQuotes:        number
    avgQuotesPerRfq:    number
    quoteResponseRate:  number
  }
  fabricators: {
    total:               number
    activeSubscriptions: number
    embedVerified:       number
    marketplaceEligible: number
  }
  buyers: {
    total:            number
    totalRfqs:        number
    avgRfqsPerBuyer:  number
  }
}

interface NotificationRow {
  id:               number
  shopName:         string | null
  fabricatorEmail:  string
  rfqTitle:         string
  marketplaceRfqId: number
  notificationType: string
  sentAt:           string
}

// ── Shared sub-components ──────────────────────────────────────────────────────

function Th({ children, align = 'left' }: { children: ReactNode; align?: 'left' | 'right' }) {
  return (
    <th style={{
      padding:       '8px 16px',
      textAlign:     align,
      fontSize:      10,
      fontWeight:    500,
      color:         '#475569',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      background:    '#0f172a',
      position:      'sticky',
      top:           0,
      zIndex:        1,
      borderBottom:  '0.5px solid #1e293b',
    }}>
      {children}
    </th>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background:   '#1e293b',
      border:       '0.5px solid #334155',
      borderRadius: 8,
      padding:      '10px 14px',
    }}>
      <div style={{ fontSize: 20, fontWeight: 600, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{label}</div>
    </div>
  )
}

function StatCardStr({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background:   '#1e293b',
      border:       '0.5px solid #334155',
      borderRadius: 8,
      padding:      '10px 14px',
    }}>
      <div style={{ fontSize: 20, fontWeight: 600, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{label}</div>
    </div>
  )
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" fill="#16a34a" />
      <polyline points="8 12 11 15 16 9" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" fill="#dc2626" />
      <line x1="9" y1="9" x2="15" y2="15" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <line x1="15" y1="9" x2="9"  y2="15" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function StatusIcon({ value }: { value: boolean | null }) {
  return value === true ? <CheckIcon /> : <XIcon />
}

function EquipmentPills({ types }: { types: string[] | null }) {
  if (!types?.length) return <span style={{ color: '#334155' }}>—</span>
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {types.includes('pressure_vessel') && (
        <span style={{
          background:   '#1e3a5f',
          color:        '#60a5fa',
          border:       '1px solid #2563eb',
          borderRadius: 20,
          padding:      '1px 7px',
          fontSize:     10,
          fontWeight:   500,
        }}>
          Vessels
        </span>
      )}
      {types.includes('heat_exchanger') && (
        <span style={{
          background:   '#1c1917',
          color:        '#a8a29e',
          border:       '1px solid #44403c',
          borderRadius: 20,
          padding:      '1px 7px',
          fontSize:     10,
          fontWeight:   500,
        }}>
          HX
        </span>
      )}
    </div>
  )
}

const STATUS_CFG: Record<MarketplaceRfqRow['status'], { label: string; bg: string; color: string; border: string }> = {
  open:      { label: 'Open',      bg: '#1e3a5f', color: '#60a5fa', border: '#2563eb' },
  awarded:   { label: 'Awarded',   bg: '#052e16', color: '#4ade80', border: '#16a34a' },
  closed:    { label: 'Closed',    bg: '#1e293b', color: '#94a3b8', border: '#334155' },
  cancelled: { label: 'Cancelled', bg: '#3b0f0f', color: '#f87171', border: '#dc2626' },
}

function StatusBadge({ status }: { status: MarketplaceRfqRow['status'] }) {
  const c = STATUS_CFG[status] ?? STATUS_CFG.closed
  return (
    <span style={{
      background:   c.bg,
      color:        c.color,
      border:       `1px solid ${c.border}`,
      borderRadius: 20,
      padding:      '2px 8px',
      fontSize:     10,
      fontWeight:   500,
      whiteSpace:   'nowrap',
    }}>
      {c.label}
    </span>
  )
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ color: '#475569', marginBottom: 2, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
      <div style={{ color: '#cbd5e1', fontSize: 12 }}>{children}</div>
    </div>
  )
}


// ── ActionBtn ─────────────────────────────────────────────────────────────────

const ACTION_VARIANT: Record<string, { bg: string; hover: string; color: string }> = {
  default: { bg: '#1e293b', hover: '#334155', color: '#94a3b8' },
  danger:  { bg: '#3b0f0f', hover: '#5c1a1a', color: '#f87171' },
  success: { bg: '#052e16', hover: '#064e27', color: '#4ade80' },
}

function ActionBtn({
  onClick, children, variant = 'default', disabled = false,
}: {
  onClick: (e: React.MouseEvent) => void
  children: ReactNode
  variant?: 'default' | 'danger' | 'success'
  disabled?: boolean
}) {
  const cfg = ACTION_VARIANT[variant]
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding:      '3px 8px',
        fontSize:     11,
        borderRadius: 4,
        fontWeight:   500,
        border:       'none',
        cursor:       disabled ? 'default' : 'pointer',
        background:   hovered && !disabled ? cfg.hover : cfg.bg,
        color:        cfg.color,
        opacity:      disabled ? 0.5 : 1,
        fontFamily:   'inherit',
      }}
    >
      {children}
    </button>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({
  title, onClose, children, width = 480,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  width?: number
}) {
  return (
    <div style={{
      position:       'fixed',
      inset:          0,
      background:     'rgba(0,0,0,0.65)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      zIndex:         1000,
    }}>
      <div style={{
        background:   '#1e293b',
        border:       '0.5px solid #334155',
        borderRadius: 10,
        width,
        maxWidth:     'calc(100vw - 32px)',
        maxHeight:    '80vh',
        overflow:     'auto',
      }}>
        <div style={{
          display:        'flex',
          justifyContent: 'space-between',
          alignItems:     'center',
          padding:        '16px 20px',
          borderBottom:   '0.5px solid #334155',
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>{title}</div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border:     'none',
              color:      '#475569',
              fontSize:   18,
              cursor:     'pointer',
              lineHeight: 1,
              padding:    '0 4px',
              fontFamily: 'inherit',
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: '16px 20px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ── EmailModal ────────────────────────────────────────────────────────────────

const INPUT_STYLE: React.CSSProperties = {
  background:   '#0f172a',
  border:       '0.5px solid #334155',
  borderRadius: 6,
  color:        '#f1f5f9',
  fontSize:     13,
  padding:      '8px 10px',
  fontFamily:   'inherit',
  width:        '100%',
  boxSizing:    'border-box',
}

function EmailModal({
  to, onClose, onSend, sending,
}: {
  to:      string
  onClose: () => void
  onSend:  (subject: string, body: string) => void
  sending: boolean
}) {
  const [subject, setSubject] = useState('')
  const [body,    setBody]    = useState('')

  return (
    <Modal title="Compose Email" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>To</div>
          <input
            readOnly
            value={to}
            style={{ ...INPUT_STYLE, color: '#64748b' }}
          />
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>Subject</div>
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            style={INPUT_STYLE}
            placeholder="Subject line"
          />
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>Body</div>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={6}
            style={{ ...INPUT_STYLE, resize: 'vertical' }}
            placeholder="Message…"
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <ActionBtn onClick={e => { e.stopPropagation(); onClose() }}>Cancel</ActionBtn>
          <ActionBtn
            onClick={e => { e.stopPropagation(); onSend(subject, body) }}
            variant="success"
            disabled={sending || !subject.trim() || !body.trim()}
          >
            {sending ? 'Sending…' : 'Send'}
          </ActionBtn>
        </div>
      </div>
    </Modal>
  )
}

// ── MarketplaceView ────────────────────────────────────────────────────────────

function MarketplaceView() {
  const [rows,              setRows]              = useState<MarketplaceRfqRow[]>([])
  const [loading,           setLoading]           = useState(true)
  const [fetchError,        setFetchError]        = useState('')
  const [expandedId,        setExpandedId]        = useState<number | null>(null)
  const [detailCache,       setDetailCache]       = useState<Record<number, RfqDetail>>({})
  const [loadingDetailId,   setLoadingDetailId]   = useState<number | null>(null)
  const [notifyModalRfq,    setNotifyModalRfq]    = useState<MarketplaceRfqRow | null>(null)
  const [allFabricators,    setAllFabricators]    = useState<FabricatorRow[]>([])
  const [fabsLoading,       setFabsLoading]       = useState(false)
  const [selectedFabIds,    setSelectedFabIds]    = useState<Set<number>>(new Set())
  const [notifySending,     setNotifySending]     = useState(false)
  const [notifyResult,      setNotifyResult]      = useState('')

  useEffect(() => {
    api.get<{ rfqs: MarketplaceRfqRow[] }>('/admin/marketplace-rfqs')
      .then(data => setRows(data.rfqs))
      .catch((err: unknown) => setFetchError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const loadDetail = useCallback((id: number) => {
    if (detailCache[id]) return
    setLoadingDetailId(id)
    api.get<RfqDetail>(`/admin/rfq-detail?id=${id}`)
      .then(data => setDetailCache(prev => ({ ...prev, [id]: data })))
      .catch((err: unknown) => console.error('Failed to load detail', err))
      .finally(() => setLoadingDetailId(null))
  }, [detailCache])

  useEffect(() => {
    if (expandedId !== null) {
      loadDetail(expandedId)
    }
  }, [expandedId, loadDetail])

  function openNotifyModal(rfq: MarketplaceRfqRow) {
    setNotifyModalRfq(rfq)
    setNotifyResult('')
    setSelectedFabIds(new Set())
    if (allFabricators.length === 0) {
      setFabsLoading(true)
      api.get<{ fabricators: FabricatorRow[] }>('/admin/fabricators')
        .then(data => setAllFabricators(data.fabricators))
        .catch((err: unknown) => console.error('Failed to load fabricators', err))
        .finally(() => setFabsLoading(false))
    }
  }

  async function sendNotifications() {
    if (!notifyModalRfq) return
    setNotifySending(true)
    try {
      const result = await api.post<{ sent: number; errors: string[] }>('/admin/notify-fabricators', {
        marketplaceRfqId: notifyModalRfq.id,
        fabricatorIds:    Array.from(selectedFabIds),
      })
      setNotifyResult(`Sent ${result.sent} notification${result.sent !== 1 ? 's' : ''}${result.errors.length > 0 ? `. Errors: ${result.errors.join('; ')}` : '.'}`)
    } catch (err) {
      setNotifyResult(`Error: ${err instanceof Error ? err.message : 'Failed to send'}`)
    } finally {
      setNotifySending(false)
    }
  }

  const eligibleFabs = allFabricators.filter(f => f.active && f.profileComplete === true && f.lastEmbedVerified === true)

  const now = Date.now()

  const counts = {
    total:       rows.length,
    open:        rows.filter(r => r.status === 'open').length,
    awarded:     rows.filter(r => r.status === 'awarded').length,
    closed:      rows.filter(r => r.status === 'closed').length,
    cancelled:   rows.filter(r => r.status === 'cancelled').length,
    totalQuotes: rows.reduce((sum, r) => sum + r.quoteCount, 0),
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: '#f1f5f9', margin: '0 0 16px' }}>Marketplace RFQs</h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 14 }}>
          <StatCard label="Total RFQs"   value={counts.total}       color="#f1f5f9" />
          <StatCard label="Open"         value={counts.open}        color="#60a5fa" />
          <StatCard label="Awarded"      value={counts.awarded}     color="#4ade80" />
          <StatCard label="Closed"       value={counts.closed}      color="#94a3b8" />
          <StatCard label="Cancelled"    value={counts.cancelled}   color="#f87171" />
          <StatCard label="Total Quotes" value={counts.totalQuotes} color="#f59e0b" />
        </div>
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {loading && <div style={{ padding: '40px 24px', textAlign: 'center', color: '#475569', fontSize: 13 }}>Loading…</div>}
        {fetchError && <div style={{ padding: '20px 24px', color: '#f87171', fontSize: 13 }}>{fetchError}</div>}
        {!loading && !fetchError && rows.length === 0 && (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: '#475569', fontSize: 13 }}>No marketplace RFQs yet.</div>
        )}
        {!loading && !fetchError && rows.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <Th>RFQ #</Th>
                <Th>Title</Th>
                <Th>Vessel Type</Th>
                <Th>Buyer Email</Th>
                <Th>Install Location</Th>
                <Th>Deadline</Th>
                <Th>Status</Th>
                <Th align="right">Quotes</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const isExpanded  = expandedId === row.id
                const isPastDue   = row.deadlineAt ? new Date(row.deadlineAt).getTime() < now : false
                const vesselLabel = row.vesselType === 'heat_exchanger' ? 'Heat Exchanger' : 'Pressure Vessel'
                const detail      = detailCache[row.id]
                const loadingThis = loadingDetailId === row.id
                return (
                  <>
                    <tr
                      key={row.id}
                      onClick={() => setExpandedId(isExpanded ? null : row.id)}
                      style={{
                        borderBottom: '0.5px solid #1e293b',
                        background:   isExpanded ? '#1e293b' : 'transparent',
                        borderLeft:   isExpanded ? '2px solid #60a5fa' : '2px solid transparent',
                        cursor:       'pointer',
                      }}
                      onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = '#0f1f3d' }}
                      onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent' }}
                    >
                      <td style={{ padding: '10px 16px', color: '#60a5fa', fontWeight: 500 }}>#{row.rfqId}</td>
                      <td style={{ padding: '10px 16px', color: '#f1f5f9', maxWidth: 200 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.rfqTitle}</div>
                      </td>
                      <td style={{ padding: '10px 16px', color: '#94a3b8' }}>{vesselLabel}</td>
                      <td style={{ padding: '10px 16px', color: '#94a3b8', maxWidth: 180 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.buyerEmail}</div>
                      </td>
                      <td style={{ padding: '10px 16px', color: '#cbd5e1' }}>{row.installCity}, {row.installState}</td>
                      <td style={{ padding: '10px 16px', color: isPastDue ? '#f87171' : '#64748b' }}>{fmtDate(row.deadlineAt)}</td>
                      <td style={{ padding: '10px 16px' }}><StatusBadge status={row.status} /></td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: row.quoteCount > 0 ? '#f1f5f9' : '#334155' }}>{row.quoteCount}</td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${row.id}-detail`} style={{ background: '#1e293b', borderLeft: '2px solid #60a5fa' }}>
                        <td colSpan={8} style={{ padding: '14px 16px 16px 32px' }}>
                          {loadingThis ? (
                            <div style={{ color: '#475569', fontSize: 12 }}>Loading detail…</div>
                          ) : detail ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                              <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                                {/* LEFT: Vessel Spec */}
                                <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                                    Vessel Spec
                                  </div>
                                  {detail.spec ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                                      {detail.spec.shellOd            && <DetailField label="Shell OD">{detail.spec.shellOd}"</DetailField>}
                                      {detail.spec.shellLength        && <DetailField label="T/T Length">{detail.spec.shellLength}"</DetailField>}
                                      {detail.spec.shellMaterial      && <DetailField label="Material">{detail.spec.shellMaterial}</DetailField>}
                                      {detail.spec.headType           && <DetailField label="Head Type">{detail.spec.headType}</DetailField>}
                                      {detail.spec.mawp               && <DetailField label="MAWP">{detail.spec.mawp} psig</DetailField>}
                                      {detail.spec.designTemp != null && <DetailField label="Design Temp">{detail.spec.designTemp}°F</DetailField>}
                                      {detail.spec.corrosionAllowance && <DetailField label="Corrosion Allow.">{detail.spec.corrosionAllowance}"</DetailField>}
                                      {detail.spec.supportType        && <DetailField label="Supports">{detail.spec.supportType}</DetailField>}
                                      {detail.spec.notes              && <DetailField label="Notes">{detail.spec.notes}</DetailField>}
                                    </div>
                                  ) : (
                                    <span style={{ color: '#475569', fontSize: 12 }}>No spec found.</span>
                                  )}
                                  {detail.nozzles.length > 0 && (
                                    <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
                                      {detail.nozzles.length} nozzle{detail.nozzles.length !== 1 ? 's' : ''}
                                    </div>
                                  )}
                                </div>

                                {/* RIGHT: Quotes */}
                                <div style={{ flex: '1 1 340px', minWidth: 0 }}>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                                    Quotes
                                  </div>
                                  {detail.quotes.length === 0 ? (
                                    <div style={{ color: '#334155', fontSize: 12 }}>No quotes yet</div>
                                  ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                      <thead>
                                        <tr>
                                          <th style={{ padding: '4px 8px', textAlign: 'left', fontSize: 10, color: '#475569', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Shop</th>
                                          <th style={{ padding: '4px 8px', textAlign: 'right', fontSize: 10, color: '#475569', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fabricated</th>
                                          <th style={{ padding: '4px 8px', textAlign: 'right', fontSize: 10, color: '#475569', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Freight</th>
                                          <th style={{ padding: '4px 8px', textAlign: 'right', fontSize: 10, color: '#475569', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Delivered</th>
                                          <th style={{ padding: '4px 8px', textAlign: 'right', fontSize: 10, color: '#475569', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lead Time (wks)</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {detail.quotes.map(q => (
                                          <tr key={q.id} style={{ borderTop: '0.5px solid #334155' }}>
                                            <td style={{ padding: '5px 8px', color: '#cbd5e1' }}>{q.shopName}</td>
                                            <td style={{ padding: '5px 8px', textAlign: 'right', color: '#f1f5f9' }}>
                                              ${Number(q.fabricatedPrice).toLocaleString('en-US', { minimumFractionDigits: 0 })}
                                            </td>
                                            <td style={{ padding: '5px 8px', textAlign: 'right', color: '#94a3b8' }}>
                                              ${Number(q.estimatedFreight).toLocaleString('en-US', { minimumFractionDigits: 0 })}
                                            </td>
                                            <td style={{ padding: '5px 8px', textAlign: 'right', color: '#4ade80' }}>
                                              {q.totalDeliveredPrice
                                                ? `$${Number(q.totalDeliveredPrice).toLocaleString('en-US', { minimumFractionDigits: 0 })}`
                                                : '—'}
                                            </td>
                                            <td style={{ padding: '5px 8px', textAlign: 'right', color: '#94a3b8' }}>{q.leadTimeWeeks}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              </div>

                              {/* Action buttons */}
                              <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                                <button
                                  onClick={e => { e.stopPropagation(); openNotifyModal(row) }}
                                  style={{
                                    padding:      '5px 12px',
                                    fontSize:     12,
                                    borderRadius: 5,
                                    fontWeight:   600,
                                    border:       '1px solid #2563eb',
                                    cursor:       'pointer',
                                    background:   '#1e3a5f',
                                    color:        '#60a5fa',
                                    fontFamily:   'inherit',
                                  }}
                                >
                                  Notify Fabricators
                                </button>
                                {row.status !== 'open' && (
                                  <ActionBtn
                                    variant="success"
                                    onClick={e => { e.stopPropagation(); alert('Reopen: stub — implement /admin/rfq-action') }}
                                  >
                                    Reopen
                                  </ActionBtn>
                                )}
                                {row.status === 'open' && (
                                  <ActionBtn
                                    variant="danger"
                                    onClick={e => { e.stopPropagation(); alert('Cancel: stub — implement /admin/rfq-action') }}
                                  >
                                    Cancel
                                  </ActionBtn>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div style={{ color: '#475569', fontSize: 12 }}>Failed to load detail.</div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Notify Fabricators Modal */}
      {notifyModalRfq && (
        <Modal title="Notify Fabricators" onClose={() => setNotifyModalRfq(null)} width={560}>
          <div style={{ marginBottom: 12, fontSize: 13, color: '#94a3b8' }}>
            RFQ: <span style={{ color: '#f1f5f9', fontWeight: 500 }}>{notifyModalRfq.rfqTitle}</span>
          </div>
          {fabsLoading && <div style={{ color: '#475569', fontSize: 13 }}>Loading fabricators…</div>}
          {!fabsLoading && eligibleFabs.length === 0 && (
            <div style={{ color: '#475569', fontSize: 13 }}>No marketplace-eligible fabricators found.</div>
          )}
          {!fabsLoading && eligibleFabs.length > 0 && (
            <>
              <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="select-all-fabs"
                  checked={selectedFabIds.size === eligibleFabs.length}
                  onChange={e => {
                    if (e.target.checked) setSelectedFabIds(new Set(eligibleFabs.map(f => f.id)))
                    else setSelectedFabIds(new Set())
                  }}
                />
                <label htmlFor="select-all-fabs" style={{ fontSize: 12, color: '#94a3b8', cursor: 'pointer' }}>
                  Select all ({eligibleFabs.length})
                </label>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 280, overflowY: 'auto', marginBottom: 12 }}>
                {eligibleFabs.map(fab => (
                  <label
                    key={fab.id}
                    style={{
                      display:      'flex',
                      alignItems:   'center',
                      gap:          10,
                      padding:      '6px 8px',
                      borderRadius: 5,
                      cursor:       'pointer',
                      background:   selectedFabIds.has(fab.id) ? '#0f1f3d' : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFabIds.has(fab.id)}
                      onChange={e => {
                        const next = new Set(selectedFabIds)
                        if (e.target.checked) next.add(fab.id)
                        else next.delete(fab.id)
                        setSelectedFabIds(next)
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 500 }}>{fab.shopName}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        {fab.contactName} &nbsp;·&nbsp; {fab.email} &nbsp;·&nbsp; {fab.city}, {fab.state}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}
          {notifyResult && (
            <div style={{ marginBottom: 10, fontSize: 12, color: notifyResult.startsWith('Error') ? '#f87171' : '#4ade80' }}>
              {notifyResult}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <ActionBtn onClick={e => { e.stopPropagation(); setNotifyModalRfq(null) }}>Close</ActionBtn>
            {!notifyResult && (
              <ActionBtn
                variant="success"
                disabled={notifySending || selectedFabIds.size === 0}
                onClick={e => { e.stopPropagation(); void sendNotifications() }}
              >
                {notifySending ? 'Sending…' : `Send to ${selectedFabIds.size} fabricator${selectedFabIds.size !== 1 ? 's' : ''}`}
              </ActionBtn>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── FabricatorsView ────────────────────────────────────────────────────────────

function FabricatorsView() {
  const [rows,           setRows]           = useState<FabricatorRow[]>([])
  const [loading,        setLoading]        = useState(true)
  const [fetchError,     setFetchError]     = useState('')
  const [expandedId,     setExpandedId]     = useState<number | null>(null)
  const [emailModalFab,  setEmailModalFab]  = useState<FabricatorRow | null>(null)
  const [emailSending,   setEmailSending]   = useState(false)
  const [actionMsg,      setActionMsg]      = useState('')

  function loadFabs() {
    setLoading(true)
    api.get<{ fabricators: FabricatorRow[] }>('/admin/fabricators')
      .then(data => setRows(data.fabricators))
      .catch((err: unknown) => setFetchError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadFabs() }, [])

  const counts = {
    total:    rows.length,
    active:   rows.filter(r => r.active).length,
    verified: rows.filter(r => r.lastEmbedVerified === true).length,
    eligible: rows.filter(r => r.active && r.profileComplete === true && r.lastEmbedVerified === true).length,
  }

  const MATERIAL_LABELS: Record<string, string> = {
    carbon_steel:  'Carbon Steel',
    stainless_304: 'Stainless 304',
    stainless_316: 'Stainless 316',
    chrome_moly:   'Chrome-Moly',
    duplex:        'Duplex',
    hastelloy:     'Hastelloy',
    inconel:       'Inconel',
    titanium:      'Titanium',
  }

  async function handleVerifyEmbed(e: React.MouseEvent, userId: number) {
    e.stopPropagation()
    try {
      await api.post('/admin/verify-embed', { userId })
      setActionMsg('Embed verified.')
      loadFabs()
    } catch (err) {
      setActionMsg(`Error: ${err instanceof Error ? err.message : 'Failed'}`)
    }
    setTimeout(() => setActionMsg(''), 3000)
  }

  async function handleToggleActive(e: React.MouseEvent, row: FabricatorRow) {
    e.stopPropagation()
    const newActive = !row.active
    try {
      await api.post('/admin/toggle-user-active', { userId: row.id, active: newActive })
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, active: newActive } : r))
      setActionMsg(newActive ? 'User activated.' : 'User deactivated.')
    } catch (err) {
      setActionMsg(`Error: ${err instanceof Error ? err.message : 'Failed'}`)
    }
    setTimeout(() => setActionMsg(''), 3000)
  }

  async function handleSendEmail(subject: string, body: string) {
    if (!emailModalFab) return
    setEmailSending(true)
    try {
      await api.post('/admin/email-fabricator', { to: emailModalFab.email, subject, body })
      setEmailModalFab(null)
      setActionMsg('Email sent.')
    } catch (err) {
      setActionMsg(`Error: ${err instanceof Error ? err.message : 'Failed to send'}`)
    } finally {
      setEmailSending(false)
    }
    setTimeout(() => setActionMsg(''), 3000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: '#f1f5f9', margin: '0 0 16px' }}>Fabricator Network</h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: actionMsg ? 8 : 14 }}>
          <StatCard label="Total Fabricators"     value={counts.total}    color="#f1f5f9" />
          <StatCard label="Active (Subscription)" value={counts.active}   color="#4ade80" />
          <StatCard label="Embed Verified"         value={counts.verified} color="#60a5fa" />
          <StatCard label="Marketplace Eligible"   value={counts.eligible} color="#f59e0b" />
        </div>
        {actionMsg && (
          <div style={{ marginBottom: 10, fontSize: 12, color: actionMsg.startsWith('Error') ? '#f87171' : '#4ade80' }}>
            {actionMsg}
          </div>
        )}
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {loading && <div style={{ padding: '40px 24px', textAlign: 'center', color: '#475569', fontSize: 13 }}>Loading…</div>}
        {fetchError && <div style={{ padding: '20px 24px', color: '#f87171', fontSize: 13 }}>{fetchError}</div>}
        {!loading && !fetchError && rows.length === 0 && (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: '#475569', fontSize: 13 }}>No fabricators yet.</div>
        )}
        {!loading && !fetchError && rows.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <Th>Shop Name</Th>
                <Th>Contact</Th>
                <Th>Email</Th>
                <Th>Location</Th>
                <Th>Eligibility</Th>
                <Th>Equipment Types</Th>
                <Th>Registered</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const isExpanded = expandedId === row.id
                return (
                  <>
                    <tr
                      key={row.id}
                      onClick={() => setExpandedId(isExpanded ? null : row.id)}
                      style={{
                        borderBottom: '0.5px solid #1e293b',
                        background:   isExpanded ? '#1e293b' : 'transparent',
                        borderLeft:   isExpanded ? '2px solid #60a5fa' : '2px solid transparent',
                        cursor:       'pointer',
                      }}
                      onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = '#0f1f3d' }}
                      onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent' }}
                    >
                      <td style={{ padding: '10px 16px', color: '#f1f5f9', fontWeight: 500 }}>{row.shopName}</td>
                      <td style={{ padding: '10px 16px', color: '#94a3b8' }}>{row.contactName || '—'}</td>
                      <td style={{ padding: '10px 16px', color: '#64748b', maxWidth: 180 }}>
                        <span title={row.email}>
                          {row.email.length > 28 ? row.email.slice(0, 28) + '…' : row.email}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', color: '#94a3b8' }}>{row.city}, {row.state}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                          <StatusIcon value={row.active} />
                          <StatusIcon value={row.lastEmbedVerified} />
                          <StatusIcon value={row.profileComplete} />
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px' }}><EquipmentPills types={row.equipmentTypes} /></td>
                      <td style={{ padding: '10px 16px', color: '#64748b' }}>{fmtDate(row.registeredAt)}</td>
                      <td style={{ padding: '10px 16px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <ActionBtn onClick={e => { e.stopPropagation(); setEmailModalFab(row) }}>
                            Email
                          </ActionBtn>
                          <ActionBtn onClick={e => { void handleVerifyEmbed(e, row.id) }}>
                            Verify Embed
                          </ActionBtn>
                          {row.active
                            ? <ActionBtn variant="danger"  onClick={e => { void handleToggleActive(e, row) }}>Deactivate</ActionBtn>
                            : <ActionBtn variant="success" onClick={e => { void handleToggleActive(e, row) }}>Activate</ActionBtn>
                          }
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${row.id}-detail`} style={{ background: '#1e293b', borderLeft: '2px solid #60a5fa' }}>
                        <td colSpan={8} style={{ padding: '12px 16px 14px 32px' }}>
                          <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
                            <DetailField label="Email">{row.email}</DetailField>
                            <DetailField label="Website">
                              {row.website
                                ? <a href={row.website} target="_blank" rel="noreferrer" style={{ color: '#60a5fa', textDecoration: 'none' }}>{row.website}</a>
                                : <span style={{ color: '#475569' }}>—</span>
                              }
                            </DetailField>
                            <DetailField label="Stamps">
                              {row.stamps?.length ? row.stamps.join(' · ') : <span style={{ color: '#475569' }}>—</span>}
                            </DetailField>
                            <DetailField label="Ship-to States">
                              {row.shipToStates?.length
                                ? row.shipToStates.join(', ')
                                : <span style={{ color: '#475569' }}>Ships anywhere</span>
                              }
                            </DetailField>
                            <DetailField label="Materials">
                              {row.materials?.length
                                ? row.materials.map(m => MATERIAL_LABELS[m] ?? m).join(', ')
                                : <span style={{ color: '#475569' }}>—</span>
                              }
                            </DetailField>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {emailModalFab && (
        <EmailModal
          to={emailModalFab.email}
          onClose={() => setEmailModalFab(null)}
          onSend={(subject, body) => { void handleSendEmail(subject, body) }}
          sending={emailSending}
        />
      )}
    </div>
  )
}

// ── UsersView ─────────────────────────────────────────────────────────────────

function UsersView() {
  const [activeTab,      setActiveTab]      = useState<'buyers' | 'fabricators'>('buyers')
  const [buyers,         setBuyers]         = useState<BuyerAdminRow[]>([])
  const [buyersLoading,  setBuyersLoading]  = useState(true)
  const [buyersError,    setBuyersError]    = useState('')
  const [fabricators,    setFabricators]    = useState<FabricatorRow[]>([])
  const [fabsLoading,    setFabsLoading]    = useState(true)
  const [fabsError,      setFabsError]      = useState('')
  const [expandedBuyerId, setExpandedBuyerId] = useState<number | null>(null)
  const [expandedFabId,   setExpandedFabId]   = useState<number | null>(null)
  const [emailModalUser,  setEmailModalUser]  = useState<{ email: string; role: string } | null>(null)
  const [emailSending,    setEmailSending]    = useState(false)
  const [actionMsg,       setActionMsg]       = useState('')

  useEffect(() => {
    api.get<{ buyers: BuyerAdminRow[] }>('/admin/buyers')
      .then(data => setBuyers(data.buyers))
      .catch((err: unknown) => setBuyersError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setBuyersLoading(false))
  }, [])

  useEffect(() => {
    api.get<{ fabricators: FabricatorRow[] }>('/admin/fabricators')
      .then(data => setFabricators(data.fabricators))
      .catch((err: unknown) => setFabsError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setFabsLoading(false))
  }, [])

  async function handleToggleBuyerActive(e: React.MouseEvent, row: BuyerAdminRow) {
    e.stopPropagation()
    const newActive = !row.active
    try {
      await api.post('/admin/toggle-user-active', { userId: row.id, active: newActive })
      setBuyers(prev => prev.map(b => b.id === row.id ? { ...b, active: newActive } : b))
      setActionMsg(newActive ? 'User activated.' : 'User deactivated.')
    } catch (err) {
      setActionMsg(`Error: ${err instanceof Error ? err.message : 'Failed'}`)
    }
    setTimeout(() => setActionMsg(''), 3000)
  }

  async function handleSendEmail(subject: string, body: string) {
    if (!emailModalUser) return
    setEmailSending(true)
    const endpoint = emailModalUser.role === 'buyer' ? '/admin/email-buyer' : '/admin/email-fabricator'
    try {
      await api.post(endpoint, { to: emailModalUser.email, subject, body })
      setEmailModalUser(null)
      setActionMsg('Email sent.')
    } catch (err) {
      setActionMsg(`Error: ${err instanceof Error ? err.message : 'Failed to send'}`)
    } finally {
      setEmailSending(false)
    }
    setTimeout(() => setActionMsg(''), 3000)
  }

  const MATERIAL_LABELS: Record<string, string> = {
    carbon_steel:  'Carbon Steel',
    stainless_304: 'Stainless 304',
    stainless_316: 'Stainless 316',
    chrome_moly:   'Chrome-Moly',
    duplex:        'Duplex',
    hastelloy:     'Hastelloy',
    inconel:       'Inconel',
    titanium:      'Titanium',
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding:         '7px 16px',
    fontSize:        13,
    fontWeight:      active ? 600 : 400,
    color:           active ? '#f1f5f9' : '#475569',
    background:      active ? '#1e293b' : 'transparent',
    borderBottom:    active ? '2px solid #60a5fa' : '2px solid transparent',
    border:          'none',
    cursor:          'pointer',
    fontFamily:      'inherit',
    borderRadius:    '4px 4px 0 0',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: '#f1f5f9', margin: '0 0 12px' }}>All Users</h1>
        {actionMsg && (
          <div style={{ marginBottom: 8, fontSize: 12, color: actionMsg.startsWith('Error') ? '#f87171' : '#4ade80' }}>
            {actionMsg}
          </div>
        )}
        <div style={{ display: 'flex', gap: 0, borderBottom: '0.5px solid #1e293b', marginBottom: 0 }}>
          <button style={tabStyle(activeTab === 'buyers')}     onClick={() => setActiveTab('buyers')}>
            Buyers ({buyers.length})
          </button>
          <button style={tabStyle(activeTab === 'fabricators')} onClick={() => setActiveTab('fabricators')}>
            Fabricators ({fabricators.length})
          </button>
        </div>
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>

        {/* BUYERS TAB */}
        {activeTab === 'buyers' && (
          <>
            {buyersLoading && <div style={{ padding: '40px 24px', textAlign: 'center', color: '#475569', fontSize: 13 }}>Loading…</div>}
            {buyersError && <div style={{ padding: '20px 24px', color: '#f87171', fontSize: 13 }}>{buyersError}</div>}
            {!buyersLoading && !buyersError && buyers.length === 0 && (
              <div style={{ padding: '40px 24px', textAlign: 'center', color: '#475569', fontSize: 13 }}>No buyers yet.</div>
            )}
            {!buyersLoading && !buyersError && buyers.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Email</Th>
                    <Th>Company</Th>
                    <Th>Registered</Th>
                    <Th align="right">RFQs</Th>
                    <Th>Last RFQ</Th>
                    <Th>Status</Th>
                    <Th>Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {buyers.map(row => {
                    const isExpanded = expandedBuyerId === row.id
                    const name = (row.firstName || row.lastName)
                      ? `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim()
                      : '—'
                    return (
                      <>
                        <tr
                          key={row.id}
                          onClick={() => setExpandedBuyerId(isExpanded ? null : row.id)}
                          style={{
                            borderBottom: '0.5px solid #1e293b',
                            background:   isExpanded ? '#1e293b' : 'transparent',
                            borderLeft:   isExpanded ? '2px solid #60a5fa' : '2px solid transparent',
                            cursor:       'pointer',
                          }}
                          onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = '#0f1f3d' }}
                          onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent' }}
                        >
                          <td style={{ padding: '10px 16px', color: '#f1f5f9' }}>{name}</td>
                          <td style={{ padding: '10px 16px', color: '#94a3b8' }}>{row.email}</td>
                          <td style={{ padding: '10px 16px', color: '#64748b' }}>{row.companyName || '—'}</td>
                          <td style={{ padding: '10px 16px', color: '#64748b' }}>{fmtDate(row.createdAt)}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', color: row.rfqCount > 0 ? '#f1f5f9' : '#334155' }}>{row.rfqCount}</td>
                          <td style={{ padding: '10px 16px', color: '#64748b' }}>{fmtDate(row.lastRfqAt)}</td>
                          <td style={{ padding: '10px 16px' }}>
                            {row.active
                              ? <span style={{ color: '#4ade80', fontSize: 12, fontWeight: 500 }}>Active</span>
                              : <span style={{ color: '#f87171', fontSize: 12, fontWeight: 500 }}>Inactive</span>
                            }
                          </td>
                          <td style={{ padding: '10px 16px' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <ActionBtn onClick={e => { e.stopPropagation(); setEmailModalUser({ email: row.email, role: 'buyer' }) }}>
                                Email
                              </ActionBtn>
                              {row.active
                                ? <ActionBtn variant="danger"  onClick={e => { void handleToggleBuyerActive(e, row) }}>Deactivate</ActionBtn>
                                : <ActionBtn variant="success" onClick={e => { void handleToggleBuyerActive(e, row) }}>Activate</ActionBtn>
                              }
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`buyer-${row.id}-detail`} style={{ background: '#1e293b', borderLeft: '2px solid #60a5fa' }}>
                            <td colSpan={8} style={{ padding: '10px 16px 12px 32px' }}>
                              <div style={{ fontSize: 12, color: '#64748b' }}>
                                View full RFQ history in Marketplace RFQs
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            )}
          </>
        )}

        {/* FABRICATORS TAB */}
        {activeTab === 'fabricators' && (
          <>
            {fabsLoading && <div style={{ padding: '40px 24px', textAlign: 'center', color: '#475569', fontSize: 13 }}>Loading…</div>}
            {fabsError && <div style={{ padding: '20px 24px', color: '#f87171', fontSize: 13 }}>{fabsError}</div>}
            {!fabsLoading && !fabsError && fabricators.length === 0 && (
              <div style={{ padding: '40px 24px', textAlign: 'center', color: '#475569', fontSize: 13 }}>No fabricators yet.</div>
            )}
            {!fabsLoading && !fabsError && fabricators.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    <Th>Shop Name</Th>
                    <Th>Contact</Th>
                    <Th>Email</Th>
                    <Th>Location</Th>
                    <Th>Eligibility</Th>
                    <Th>Registered</Th>
                  </tr>
                </thead>
                <tbody>
                  {fabricators.map(row => {
                    const isExpanded = expandedFabId === row.id
                    return (
                      <>
                        <tr
                          key={row.id}
                          onClick={() => setExpandedFabId(isExpanded ? null : row.id)}
                          style={{
                            borderBottom: '0.5px solid #1e293b',
                            background:   isExpanded ? '#1e293b' : 'transparent',
                            borderLeft:   isExpanded ? '2px solid #60a5fa' : '2px solid transparent',
                            cursor:       'pointer',
                          }}
                          onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = '#0f1f3d' }}
                          onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent' }}
                        >
                          <td style={{ padding: '10px 16px', color: '#f1f5f9', fontWeight: 500 }}>{row.shopName}</td>
                          <td style={{ padding: '10px 16px', color: '#94a3b8' }}>{row.contactName || '—'}</td>
                          <td style={{ padding: '10px 16px', color: '#64748b', maxWidth: 180 }}>
                            <span title={row.email}>
                              {row.email.length > 28 ? row.email.slice(0, 28) + '…' : row.email}
                            </span>
                          </td>
                          <td style={{ padding: '10px 16px', color: '#94a3b8' }}>{row.city}, {row.state}</td>
                          <td style={{ padding: '10px 16px' }}>
                            <div style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                              <StatusIcon value={row.active} />
                              <StatusIcon value={row.lastEmbedVerified} />
                              <StatusIcon value={row.profileComplete} />
                            </div>
                          </td>
                          <td style={{ padding: '10px 16px', color: '#64748b' }}>{fmtDate(row.registeredAt)}</td>
                        </tr>
                        {isExpanded && (
                          <tr key={`fab-${row.id}-detail`} style={{ background: '#1e293b', borderLeft: '2px solid #60a5fa' }}>
                            <td colSpan={6} style={{ padding: '12px 16px 14px 32px' }}>
                              <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
                                <DetailField label="Email">{row.email}</DetailField>
                                <DetailField label="Website">
                                  {row.website
                                    ? <a href={row.website} target="_blank" rel="noreferrer" style={{ color: '#60a5fa', textDecoration: 'none' }}>{row.website}</a>
                                    : <span style={{ color: '#475569' }}>—</span>
                                  }
                                </DetailField>
                                <DetailField label="Stamps">
                                  {row.stamps?.length ? row.stamps.join(' · ') : <span style={{ color: '#475569' }}>—</span>}
                                </DetailField>
                                <DetailField label="Materials">
                                  {row.materials?.length
                                    ? row.materials.map(m => MATERIAL_LABELS[m] ?? m).join(', ')
                                    : <span style={{ color: '#475569' }}>—</span>
                                  }
                                </DetailField>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      {emailModalUser && (
        <EmailModal
          to={emailModalUser.email}
          onClose={() => setEmailModalUser(null)}
          onSend={(subject, body) => { void handleSendEmail(subject, body) }}
          sending={emailSending}
        />
      )}
    </div>
  )
}

// ── AnalyticsView ─────────────────────────────────────────────────────────────

function AnalyticsView() {
  const [data,    setData]    = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    api.get<AnalyticsData>('/admin/analytics')
      .then(d => setData(d))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const sectionHeader: React.CSSProperties = {
    fontSize:      12,
    fontWeight:    600,
    color:         '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    marginBottom:  10,
    marginTop:     24,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: '#f1f5f9', margin: '0 0 8px' }}>Analytics</h1>
      </div>
      <div style={{ overflowY: 'auto', flex: 1, padding: '0 24px 24px' }}>
        {loading && <div style={{ paddingTop: 40, textAlign: 'center', color: '#475569', fontSize: 13 }}>Loading…</div>}
        {error   && <div style={{ paddingTop: 20, color: '#f87171', fontSize: 13 }}>{error}</div>}
        {data && (
          <>
            <div style={sectionHeader}>Platform</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              <StatCard    label="Total RFQs"         value={data.platform.totalRfqs}    color="#f1f5f9" />
              <StatCard    label="Total Quotes"        value={data.platform.totalQuotes}  color="#f59e0b" />
              <StatCardStr label="Avg Quotes / RFQ"    value={(data.platform.avgQuotesPerRfq ?? 0).toFixed(1)}   color="#60a5fa" />
              <StatCardStr label="Quote Response Rate" value={`${((data.platform.quoteResponseRate ?? 0) * 100).toFixed(0)}%`} color="#4ade80" />
            </div>

            <div style={sectionHeader}>Fabricators</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              <StatCard label="Registered"           value={data.fabricators.total}               color="#f1f5f9" />
              <StatCard label="Active Subscriptions" value={data.fabricators.activeSubscriptions}  color="#4ade80" />
              <StatCard label="Embed Verified"        value={data.fabricators.embedVerified}        color="#60a5fa" />
              <StatCard label="Marketplace Eligible"  value={data.fabricators.marketplaceEligible}  color="#f59e0b" />
            </div>

            <div style={sectionHeader}>Buyers</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <StatCard    label="Registered"          value={data.buyers.total}       color="#f1f5f9" />
              <StatCard    label="Total RFQs Submitted" value={data.buyers.totalRfqs}   color="#60a5fa" />
              <StatCardStr label="Avg RFQs / Buyer"     value={(data.buyers.avgRfqsPerBuyer ?? 0).toFixed(1)} color="#94a3b8" />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── NotificationLogView ────────────────────────────────────────────────────────

function titleCase(str: string): string {
  return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function NotificationLogView() {
  const [rows,    setRows]    = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [filter,  setFilter]  = useState('')

  useEffect(() => {
    api.get<{ notifications: NotificationRow[] }>('/admin/notification-log')
      .then(data => setRows(data.notifications))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter.trim()
    ? rows.filter(r => {
        const q = filter.toLowerCase()
        return (r.shopName?.toLowerCase().includes(q) ?? false) || r.rfqTitle.toLowerCase().includes(q)
      })
    : rows

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: '#f1f5f9', margin: '0 0 14px' }}>Notification Log</h1>
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter by shop name or RFQ title…"
          style={{
            width:        '100%',
            background:   '#1e293b',
            border:       '0.5px solid #334155',
            borderRadius: 6,
            color:        '#f1f5f9',
            fontSize:     13,
            padding:      '8px 12px',
            fontFamily:   'inherit',
            boxSizing:    'border-box',
            marginBottom: 14,
          }}
        />
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {loading && <div style={{ padding: '40px 24px', textAlign: 'center', color: '#475569', fontSize: 13 }}>Loading…</div>}
        {error   && <div style={{ padding: '20px 24px', color: '#f87171', fontSize: 13 }}>{error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: '#475569', fontSize: 13 }}>No notifications found.</div>
        )}
        {!loading && !error && filtered.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Shop</Th>
                <Th>Email</Th>
                <Th>RFQ Title</Th>
                <Th>Type</Th>
                <Th>Sent At</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => (
                <tr
                  key={row.id}
                  style={{ borderBottom: '0.5px solid #1e293b' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#0f1f3d' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <td style={{ padding: '10px 16px', color: '#60a5fa', fontWeight: 500 }}>#{row.marketplaceRfqId}</td>
                  <td style={{ padding: '10px 16px', color: '#f1f5f9' }}>{row.shopName ?? '—'}</td>
                  <td style={{ padding: '10px 16px', color: '#64748b' }}>{row.fabricatorEmail}</td>
                  <td style={{ padding: '10px 16px', color: '#94a3b8', maxWidth: 240 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.rfqTitle}</div>
                  </td>
                  <td style={{ padding: '10px 16px', color: '#cbd5e1' }}>{titleCase(row.notificationType)}</td>
                  <td style={{ padding: '10px 16px', color: '#64748b' }}>{fmtDate(row.sentAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [view, setView] = useState<AdminView>('marketplace')
  const { logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const navItems: { id: AdminView; label: string; icon: ReactNode }[] = [
    {
      id: 'marketplace',
      label: 'Marketplace RFQs',
      icon: (
        <svg width="15" height="15" viewBox="0 0 28 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M3 12C3 6.477 7.925 2 14 2C20.075 2 25 6.477 25 12" />
          <path d="M7 12C7 8.686 10.134 6 14 6C17.866 6 21 8.686 21 12" />
          <path d="M11 12C11 10.343 12.343 9 14 9C15.657 9 17 10.343 17 12" />
          <circle cx="14" cy="15" r="2" fill="currentColor" stroke="none" />
        </svg>
      ),
    },
    {
      id: 'fabricators',
      label: 'Fabricator Network',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="1" />
          <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
          <line x1="12" y1="12" x2="12" y2="16" />
          <line x1="10" y1="14" x2="14" y2="14" />
        </svg>
      ),
    },
    {
      id: 'users',
      label: 'All Users',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87" />
          <path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
      ),
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6"  y1="20" x2="6"  y2="14" />
          <line x1="2"  y1="20" x2="22" y2="20" />
        </svg>
      ),
    },
    {
      id: 'notifications',
      label: 'Notification Log',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
      ),
    },
  ]

  return (
    <div style={{
      display:    'flex',
      height:     '100vh',
      overflow:   'hidden',
      background: '#0f172a',
      color:      '#f1f5f9',
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontSize:   14,
    }}>

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside style={{
        width:         220,
        flexShrink:    0,
        background:    '#0f172a',
        borderRight:   '0.5px solid #1e293b',
        display:       'flex',
        flexDirection: 'column',
        paddingTop:    20,
      }}>
        <div style={{ padding: '0 20px 24px' }}>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.3px' }}>
            <span style={{ color: '#f8fafc' }}>Vessel</span>
            <span style={{ color: '#60a5fa' }}>RFQ</span>
          </div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>Admin</div>
        </div>

        <nav style={{ flex: 1 }}>
          {navItems.map(item => (
            <div
              key={item.id}
              onClick={() => setView(item.id)}
              style={{
                display:     'flex',
                alignItems:  'center',
                gap:         10,
                padding:     '9px 20px',
                background:  view === item.id ? '#1e293b' : 'transparent',
                borderRight: view === item.id ? '2px solid #60a5fa' : '2px solid transparent',
                color:       view === item.id ? '#f1f5f9' : '#475569',
                cursor:      'pointer',
                fontSize:    13,
              }}
            >
              {item.icon}
              {item.label}
            </div>
          ))}
        </nav>

        <div style={{ padding: '16px 20px', borderTop: '0.5px solid #1e293b' }}>
          <button
            onClick={handleLogout}
            style={{
              background: 'none',
              border:     'none',
              color:      '#475569',
              fontSize:   13,
              cursor:     'pointer',
              fontFamily: 'inherit',
              padding:    0,
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#0f172a' }}>
        {view === 'marketplace'   && <MarketplaceView />}
        {view === 'fabricators'   && <FabricatorsView />}
        {view === 'users'         && <UsersView />}
        {view === 'analytics'     && <AnalyticsView />}
        {view === 'notifications' && <NotificationLogView />}
      </main>

    </div>
  )
}
