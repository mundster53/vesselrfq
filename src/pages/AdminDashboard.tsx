import { useState, useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'

type AdminView = 'marketplace' | 'fabricators' | 'users'

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

interface UserRow {
  id:               number
  email:            string
  role:             'buyer' | 'fabricator' | 'admin'
  active:           boolean
  createdAt:        string
  stripeCustomerId: string | null
}

interface FabricatorRow {
  id:                number
  email:             string
  active:            boolean
  shopName:          string
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

// ── Detail field helper ────────────────────────────────────────────────────────

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

// ── Marketplace view ───────────────────────────────────────────────────────────

function MarketplaceView() {
  const [rows, setRows]             = useState<MarketplaceRfqRow[]>([])
  const [loading, setLoading]       = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  useEffect(() => {
    api.get<{ rfqs: MarketplaceRfqRow[] }>('/admin/marketplace-rfqs')
      .then(data => setRows(data.rfqs))
      .catch((err: unknown) => setFetchError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const now = Date.now()

  const counts = {
    total:       rows.length,
    open:        rows.filter(r => r.status === 'open').length,
    awarded:     rows.filter(r => r.status === 'awarded').length,
    totalQuotes: rows.reduce((sum, r) => sum + r.quoteCount, 0),
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: '#f1f5f9', margin: '0 0 16px' }}>Marketplace RFQs</h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
          <StatCard label="Total RFQs"   value={counts.total}       color="#f1f5f9" />
          <StatCard label="Open"         value={counts.open}        color="#60a5fa" />
          <StatCard label="Awarded"      value={counts.awarded}     color="#4ade80" />
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
                <Th>Type</Th>
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
                      <td style={{ padding: '10px 16px', color: '#cbd5e1' }}>{row.installCity}, {row.installState}</td>
                      <td style={{ padding: '10px 16px', color: isPastDue ? '#f87171' : '#64748b' }}>{fmtDate(row.deadlineAt)}</td>
                      <td style={{ padding: '10px 16px' }}><StatusBadge status={row.status} /></td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: row.quoteCount > 0 ? '#f1f5f9' : '#334155' }}>{row.quoteCount}</td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${row.id}-detail`} style={{ background: '#1e293b', borderLeft: '2px solid #60a5fa' }}>
                        <td colSpan={7} style={{ padding: '12px 16px 14px 32px' }}>
                          <div style={{ display: 'flex', gap: 40 }}>
                            <DetailField label="Buyer">{row.buyerEmail}</DetailField>
                            <DetailField label="Submitted">{fmtDate(row.createdAt)}</DetailField>
                            <DetailField label="Install Location">{row.installCity}, {row.installState}</DetailField>
                            {row.shellOd && <DetailField label="Shell OD">{row.shellOd}"</DetailField>}
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
    </div>
  )
}

// ── Fabricators view ───────────────────────────────────────────────────────────

function FabricatorsView() {
  const [rows, setRows]             = useState<FabricatorRow[]>([])
  const [loading, setLoading]       = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  useEffect(() => {
    api.get<{ fabricators: FabricatorRow[] }>('/admin/fabricators')
      .then(data => setRows(data.fabricators))
      .catch((err: unknown) => setFetchError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: '#f1f5f9', margin: '0 0 16px' }}>Fabricator Network</h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
          <StatCard label="Total Fabricators"    value={counts.total}    color="#f1f5f9" />
          <StatCard label="Active (Subscription)" value={counts.active}   color="#4ade80" />
          <StatCard label="Embed Verified"        value={counts.verified} color="#4ade80" />
          <StatCard label="Marketplace Eligible"  value={counts.eligible} color="#4ade80" />
        </div>
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
                <Th>Location</Th>
                <Th>Subscription</Th>
                <Th>Embed</Th>
                <Th>Profile</Th>
                <Th>Equipment Types</Th>
                <Th>Last Check</Th>
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
                      <td style={{ padding: '10px 16px', color: '#94a3b8' }}>{row.city}, {row.state}</td>
                      <td style={{ padding: '10px 16px' }}><StatusIcon value={row.active} /></td>
                      <td style={{ padding: '10px 16px' }}><StatusIcon value={row.lastEmbedVerified} /></td>
                      <td style={{ padding: '10px 16px' }}><StatusIcon value={row.profileComplete} /></td>
                      <td style={{ padding: '10px 16px' }}><EquipmentPills types={row.equipmentTypes} /></td>
                      <td style={{ padding: '10px 16px', color: row.lastEmbedCheck ? '#64748b' : '#334155' }}>
                        {row.lastEmbedCheck ? fmtDate(row.lastEmbedCheck) : 'Never'}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${row.id}-detail`} style={{ background: '#1e293b', borderLeft: '2px solid #60a5fa' }}>
                        <td colSpan={7} style={{ padding: '12px 16px 14px 32px' }}>
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
    </div>
  )
}

// ── Users view ────────────────────────────────────────────────────────────────

const ROLE_CFG: Record<UserRow['role'], { label: string; bg: string; color: string; border: string }> = {
  buyer:       { label: 'Buyer',       bg: '#1e293b', color: '#94a3b8', border: '#334155' },
  fabricator:  { label: 'Fabricator',  bg: '#1e3a5f', color: '#60a5fa', border: '#2563eb' },
  admin:       { label: 'Admin',       bg: '#2e1065', color: '#c4b5fd', border: '#7c3aed' },
}

function RoleBadge({ role }: { role: UserRow['role'] }) {
  const c = ROLE_CFG[role] ?? ROLE_CFG.buyer
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

function UsersView() {
  const [rows, setRows]             = useState<UserRow[]>([])
  const [loading, setLoading]       = useState(true)
  const [fetchError, setFetchError] = useState('')

  useEffect(() => {
    api.get<{ users: UserRow[] }>('/admin/users')
      .then(data => setRows(data.users))
      .catch((err: unknown) => setFetchError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const counts = {
    total:       rows.length,
    buyers:      rows.filter(r => r.role === 'buyer').length,
    fabricators: rows.filter(r => r.role === 'fabricator').length,
    admins:      rows.filter(r => r.role === 'admin').length,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: '#f1f5f9', margin: '0 0 16px' }}>All Users</h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
          <StatCard label="Total Users"  value={counts.total}       color="#f1f5f9" />
          <StatCard label="Buyers"       value={counts.buyers}      color="#94a3b8" />
          <StatCard label="Fabricators"  value={counts.fabricators} color="#60a5fa" />
          <StatCard label="Admins"       value={counts.admins}      color="#c4b5fd" />
        </div>
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {loading && <div style={{ padding: '40px 24px', textAlign: 'center', color: '#475569', fontSize: 13 }}>Loading…</div>}
        {fetchError && <div style={{ padding: '20px 24px', color: '#f87171', fontSize: 13 }}>{fetchError}</div>}
        {!loading && !fetchError && rows.length === 0 && (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: '#475569', fontSize: 13 }}>No users found.</div>
        )}
        {!loading && !fetchError && rows.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <Th>ID</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Joined</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr
                  key={row.id}
                  style={{ borderBottom: '0.5px solid #1e293b', cursor: 'default' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#0f1f3d' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <td style={{ padding: '10px 16px', color: '#475569', fontFamily: 'monospace', fontSize: 12 }}>{row.id}</td>
                  <td style={{ padding: '10px 16px', color: '#f1f5f9' }}>{row.email}</td>
                  <td style={{ padding: '10px 16px' }}><RoleBadge role={row.role} /></td>
                  <td style={{ padding: '10px 16px' }}>
                    {row.active
                      ? <span style={{ color: '#4ade80', fontSize: 12, fontWeight: 500 }}>Active</span>
                      : <span style={{ color: '#f87171', fontSize: 12, fontWeight: 500 }}>Inactive</span>
                    }
                  </td>
                  <td style={{ padding: '10px 16px', color: '#64748b' }}>{fmtDate(row.createdAt)}</td>
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
        {view === 'marketplace' && <MarketplaceView />}
        {view === 'fabricators' && <FabricatorsView />}
        {view === 'users'       && <UsersView />}
      </main>

    </div>
  )
}
