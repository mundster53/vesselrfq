import { useState, useRef, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import VesselViewer from '../components/VesselViewer'
import { api, ApiError } from '../lib/api'
import type {
  VesselDesignState,
  NozzleRow,
  HeadType,
  ShellMaterial,
  SupportType,
  NozzleRating,
  FlangeType,
  FlangeFacing,
  NozzleLocation,
  Orientation,
} from '../types/vessel'

// ─── Constants ────────────────────────────────────────────────────────────────

const SHELL_MATERIALS: ShellMaterial[] = [
  'SA-516-70',
  'SA-516-60',
  'SA-240-304',
  'SA-240-316',
  'SA-240-316L',
  'SA-285-C',
]

const CUSTOM_MATERIAL_SENTINEL = '__custom__'

const HEAD_TYPES: HeadType[] = [
  '2:1 Elliptical',
  'Hemispherical',
  'ASME F&D',
  'Torispherical',
  'Flat',
]

const HORIZONTAL_SUPPORTS: { value: SupportType; label: string }[] = [
  { value: 'saddles', label: 'Saddles' },
]

const VERTICAL_SUPPORTS: { value: SupportType; label: string }[] = [
  { value: 'skirt', label: 'Skirt' },
  { value: 'legs', label: 'Legs' },
  { value: 'lugs', label: 'Lugs' },
]

const NPS_SIZES = ['1/2', '3/4', '1', '1-1/2', '2', '3', '4', '6', '8', '10', '12', '14', '16', '18', '20', '24']

const RATINGS: NozzleRating[] = ['150', '300', '600', '900', '1500', '2500']

const FLANGE_TYPES: FlangeType[] = ['WN', 'SO', 'SW', 'BL', 'LJ', 'THD']

const FACINGS: FlangeFacing[] = ['RF', 'FF', 'RTJ']

const NOZZLE_MATERIALS = [
  'SA-106-B',
  'SA-105',
  'SA-312-TP304',
  'SA-312-TP316',
  'SA-182-F304',
  'SA-182-F316',
]

function getLocations(orientation: Orientation): { value: NozzleLocation; label: string }[] {
  return [
    { value: 'shell', label: 'Shell' },
    { value: 'left_head', label: orientation === 'vertical' ? 'Bottom Head' : 'Left Head' },
    { value: 'right_head', label: orientation === 'vertical' ? 'Top Head' : 'Right Head' },
  ]
}

// ─── Initial state ────────────────────────────────────────────────────────────

const initialState: VesselDesignState = {
  orientation: 'horizontal',
  title: '',
  shellOd: '',
  shellLength: '',
  shellMaterial: '',
  headType: '',
  mawp: '',
  designTemp: '',
  corrosionAllowance: '',
  supportType: 'saddles',
  saddleHeight: '',
  saddleWidth: '',
  nozzles: [],
  notes: '',
}

function emptyNozzle(mark: string): NozzleRow {
  return {
    mark,
    size: '4',
    rating: '150',
    flangeType: 'WN',
    facing: 'RF',
    material: 'SA-105',
    service: '',
    quantity: 1,
    location: 'shell',
    shellAngle: null,   // null = auto-distribute
    headPos: 'center',
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: string }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">
      {children}
    </h2>
  )
}

function FieldLabel({ children, unit }: { children: string; unit?: string }) {
  return (
    <label className="block text-sm font-medium text-slate-700 mb-1">
      {children}
      {unit && <span className="font-normal text-slate-400 ml-1">({unit})</span>}
    </label>
  )
}

const inputCls =
  'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white'

const selectCls = inputCls

// ─── Main page ────────────────────────────────────────────────────────────────

export default function VesselDesignerPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState<VesselDesignState>(initialState)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [useCustomMaterial, setUseCustomMaterial] = useState(false)
  const customMaterialRef = useRef<HTMLInputElement>(null)

  function setField<K extends keyof VesselDesignState>(key: K, value: VesselDesignState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleOrientationChange(o: Orientation) {
    setForm((prev) => ({
      ...prev,
      orientation: o,
      supportType: o === 'horizontal' ? 'saddles' : 'skirt',
      saddleHeight: o === 'horizontal' ? prev.saddleHeight : '',
      saddleWidth: o === 'horizontal' ? prev.saddleWidth : '',
    }))
  }

  function fieldInput(key: keyof VesselDesignState) {
    return (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setField(key, e.target.value as VesselDesignState[typeof key])
  }

  // ─── Nozzle handlers ───────────────────────────────────────────────────────

  function addNozzle() {
    const mark = `N${form.nozzles.length + 1}`
    setField('nozzles', [...form.nozzles, emptyNozzle(mark)])
  }

  function removeNozzle(i: number) {
    setField(
      'nozzles',
      form.nozzles.filter((_, idx) => idx !== i),
    )
  }

  function updateNozzle<K extends keyof NozzleRow>(i: number, key: K, value: NozzleRow[K]) {
    setField(
      'nozzles',
      form.nozzles.map((n, idx) => (idx === i ? { ...n, [key]: value } : n)),
    )
  }

  // ─── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setError('')
    if (!form.title.trim()) return setError('RFQ title is required')

    setSubmitting(true)
    try {
      await api.post('/rfqs', {
        title: form.title.trim(),
        shellOd: form.shellOd || undefined,
        shellLength: form.shellLength || undefined,
        shellMaterial: form.shellMaterial || undefined,
        headType: form.headType || undefined,
        mawp: form.mawp || undefined,
        designTemp: form.designTemp || undefined,
        corrosionAllowance: form.corrosionAllowance || undefined,
        supportType: form.supportType || undefined,
        saddleHeight: form.saddleHeight || undefined,
        saddleWidth: form.saddleWidth || undefined,
        notes: form.notes || undefined,
        nozzles: form.nozzles,
      })
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Navbar />

      {/* Two-panel layout */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">

        {/* ── 3D Viewer (right on desktop, top on mobile) ─────────────────── */}
        <div className="relative h-56 sm:h-72 lg:h-auto lg:flex-1 bg-slate-950 order-first lg:order-last">
          <VesselViewer form={form} />
          {/* Hint label */}
          <div className="absolute bottom-3 right-3 text-slate-600 text-xs select-none pointer-events-none">
            Drag to orbit · Scroll to zoom
          </div>
        </div>

        {/* ── Configuration form (left, scrollable) ───────────────────────── */}
        <div className="lg:w-[44%] xl:w-[42%] overflow-y-auto bg-slate-50 flex flex-col order-last lg:order-first">
          <div className="px-5 sm:px-6 py-5 space-y-5 flex-1">

            {/* RFQ title + submit */}
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={form.title}
                  onChange={fieldInput('title')}
                  placeholder="RFQ Title (e.g. 60-inch OD Separator — Project 1241)"
                  className="w-full text-base font-semibold border-0 border-b-2 border-slate-200 focus:border-blue-500 focus:outline-none bg-transparent pb-1 placeholder:text-slate-300 placeholder:font-normal"
                />
                <p className="text-xs text-slate-400 mt-1">Give this RFQ a descriptive title</p>
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="shrink-0 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium text-sm px-4 py-2 rounded-lg transition-colors"
              >
                {submitting ? 'Submitting…' : 'Submit RFQ'}
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            {/* ── Shell Configuration ─────────────────────────────────────── */}
            <section className="bg-white border border-slate-200 rounded-xl p-5">
              <SectionHeader>Shell Configuration</SectionHeader>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <FieldLabel unit="in OD">Shell Diameter</FieldLabel>
                  <input
                    type="number"
                    min="0"
                    step="0.125"
                    value={form.shellOd}
                    onChange={fieldInput('shellOd')}
                    className={inputCls}
                    placeholder="60"
                  />
                </div>
                <div>
                  <FieldLabel unit="in T/T">Shell Length</FieldLabel>
                  <input
                    type="number"
                    min="0"
                    step="0.125"
                    value={form.shellLength}
                    onChange={fieldInput('shellLength')}
                    className={inputCls}
                    placeholder="120"
                  />
                </div>
                <div>
                  <FieldLabel>Shell Material</FieldLabel>
                  <select
                    value={useCustomMaterial ? CUSTOM_MATERIAL_SENTINEL : form.shellMaterial}
                    onChange={(e) => {
                      if (e.target.value === CUSTOM_MATERIAL_SENTINEL) {
                        setUseCustomMaterial(true)
                        setField('shellMaterial', '')
                        setTimeout(() => customMaterialRef.current?.focus(), 50)
                      } else {
                        setUseCustomMaterial(false)
                        setField('shellMaterial', e.target.value)
                      }
                    }}
                    className={selectCls}
                  >
                    <option value="">— Select —</option>
                    {SHELL_MATERIALS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                    <option value={CUSTOM_MATERIAL_SENTINEL}>Other (specify)</option>
                  </select>
                  {useCustomMaterial && (
                    <input
                      ref={customMaterialRef}
                      type="text"
                      value={form.shellMaterial}
                      onChange={fieldInput('shellMaterial')}
                      placeholder="e.g. Inconel 625, Hastelloy C-276, Duplex 2205…"
                      className={inputCls + ' mt-2'}
                    />
                  )}
                </div>
              </div>
            </section>

            {/* ── Orientation ──────────────────────────────────────────────── */}
            <section className="bg-white border border-slate-200 rounded-xl p-5">
              <SectionHeader>Orientation</SectionHeader>
              <div className="flex gap-6">
                {(['horizontal', 'vertical'] as Orientation[]).map((o) => (
                  <label key={o} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="orientation"
                      value={o}
                      checked={form.orientation === o}
                      onChange={() => handleOrientationChange(o)}
                      className="accent-blue-600"
                    />
                    <span className="text-sm text-slate-700 capitalize">{o}</span>
                  </label>
                ))}
              </div>
            </section>

            {/* ── Head Configuration ──────────────────────────────────────── */}
            <section className="bg-white border border-slate-200 rounded-xl p-5">
              <SectionHeader>Head Configuration</SectionHeader>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Head Type</FieldLabel>
                  <select value={form.headType} onChange={fieldInput('headType')} className={selectCls}>
                    <option value="">— Select —</option>
                    {HEAD_TYPES.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400 mt-1">Applies to both heads</p>
                </div>
              </div>
            </section>

            {/* ── Design Conditions ───────────────────────────────────────── */}
            <section className="bg-white border border-slate-200 rounded-xl p-5">
              <SectionHeader>Design Conditions</SectionHeader>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <FieldLabel unit="psi">MAWP</FieldLabel>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.mawp}
                    onChange={fieldInput('mawp')}
                    className={inputCls}
                    placeholder="150"
                  />
                </div>
                <div>
                  <FieldLabel unit="°F">Design Temperature</FieldLabel>
                  <input
                    type="number"
                    step="1"
                    value={form.designTemp}
                    onChange={fieldInput('designTemp')}
                    className={inputCls}
                    placeholder="300"
                  />
                </div>
                <div>
                  <FieldLabel unit="in">Corrosion Allowance</FieldLabel>
                  <input
                    type="number"
                    min="0"
                    step="0.0625"
                    value={form.corrosionAllowance}
                    onChange={fieldInput('corrosionAllowance')}
                    className={inputCls}
                    placeholder="0.125"
                  />
                </div>
              </div>
            </section>

            {/* ── Nozzle Schedule ─────────────────────────────────────────── */}
            <section className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <SectionHeader>Nozzle Schedule</SectionHeader>
                <button
                  type="button"
                  onClick={addNozzle}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  + Add Nozzle
                </button>
              </div>

              {form.nozzles.length === 0 ? (
                <p className="text-slate-400 text-sm">No nozzles added yet.</p>
              ) : (
                <div className="overflow-x-auto -mx-5 px-5">
                  <table className="w-full text-sm min-w-[960px]">
                    <thead>
                      <tr className="border-b border-slate-200">
                        {['Mark', 'Service', 'Size (NPS)', 'Rating', 'Flange Type', 'Facing', 'Material', 'Qty', 'Location', 'Position', ''].map(
                          (h) => (
                            <th
                              key={h}
                              className="text-left pb-2 pr-2 text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap"
                            >
                              {h}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {form.nozzles.map((nozzle, i) => (
                        <tr key={i} className="border-b border-slate-100 last:border-0">
                          <td className="py-2 pr-2">
                            <input
                              type="text"
                              value={nozzle.mark}
                              onChange={(e) => updateNozzle(i, 'mark', e.target.value)}
                              className="w-14 border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              type="text"
                              value={nozzle.service}
                              onChange={(e) => updateNozzle(i, 'service', e.target.value)}
                              placeholder="Inlet, Vent…"
                              className="w-28 border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <select
                              value={nozzle.size}
                              onChange={(e) => updateNozzle(i, 'size', e.target.value)}
                              className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                            >
                              {NPS_SIZES.map((s) => (
                                <option key={s} value={s}>
                                  {s}&quot;
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 pr-2">
                            <select
                              value={nozzle.rating}
                              onChange={(e) => updateNozzle(i, 'rating', e.target.value as NozzleRating)}
                              className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                            >
                              {RATINGS.map((r) => (
                                <option key={r} value={r}>{r}#</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 pr-2">
                            <select
                              value={nozzle.flangeType}
                              onChange={(e) => updateNozzle(i, 'flangeType', e.target.value as FlangeType)}
                              className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                            >
                              {FLANGE_TYPES.map((f) => (
                                <option key={f} value={f}>{f}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 pr-2">
                            <select
                              value={nozzle.facing}
                              onChange={(e) => updateNozzle(i, 'facing', e.target.value as FlangeFacing)}
                              className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                            >
                              {FACINGS.map((f) => (
                                <option key={f} value={f}>{f}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 pr-2">
                            <select
                              value={nozzle.material}
                              onChange={(e) => updateNozzle(i, 'material', e.target.value)}
                              className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                            >
                              {NOZZLE_MATERIALS.map((m) => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              type="number"
                              min="1"
                              value={nozzle.quantity}
                              onChange={(e) => updateNozzle(i, 'quantity', parseInt(e.target.value) || 1)}
                              className="w-12 border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <select
                              value={nozzle.location}
                              onChange={(e) => updateNozzle(i, 'location', e.target.value as NozzleLocation)}
                              className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                            >
                              {getLocations(form.orientation).map((l) => (
                                <option key={l.value} value={l.value}>{l.label}</option>
                              ))}
                            </select>
                          </td>
                          {/* Position: angle for shell, center/offset for heads */}
                          <td className="py-2 pr-2">
                            {nozzle.location === 'shell' ? (
                              <div className="flex items-center gap-0.5">
                                <input
                                  type="number"
                                  min="0"
                                  max="359"
                                  step="15"
                                  value={nozzle.shellAngle ?? ''}
                                  onChange={(e) =>
                                    updateNozzle(
                                      i,
                                      'shellAngle',
                                      e.target.value === '' ? null : parseInt(e.target.value) % 360,
                                    )
                                  }
                                  placeholder="auto"
                                  className="w-14 border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                                />
                                <span className="text-xs text-slate-400">°</span>
                              </div>
                            ) : (
                              <select
                                value={nozzle.headPos}
                                onChange={(e) =>
                                  updateNozzle(i, 'headPos', e.target.value as 'center' | 'offset')
                                }
                                className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                              >
                                <option value="center">Center</option>
                                <option value="offset">Offset</option>
                              </select>
                            )}
                          </td>
                          <td className="py-2">
                            <button
                              type="button"
                              onClick={() => removeNozzle(i)}
                              className="text-slate-400 hover:text-red-500 transition-colors text-base leading-none"
                              aria-label="Remove nozzle"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ── Supports ────────────────────────────────────────────────── */}
            <section className="bg-white border border-slate-200 rounded-xl p-5">
              <SectionHeader>Supports</SectionHeader>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Support Type</FieldLabel>
                  <div className="flex flex-wrap gap-3">
                    {(form.orientation === 'horizontal' ? HORIZONTAL_SUPPORTS : VERTICAL_SUPPORTS).map(({ value, label }) => (
                      <label key={value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="supportType"
                          value={value}
                          checked={form.supportType === value}
                          onChange={() => {
                            setField('supportType', value as SupportType)
                            if (value !== 'saddles') {
                              setField('saddleHeight', '')
                              setField('saddleWidth', '')
                            }
                          }}
                          className="accent-blue-600"
                        />
                        <span className="text-sm text-slate-700">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {form.supportType === 'saddles' && (
                  <div className="sm:col-span-2 grid grid-cols-2 gap-4 max-w-sm">
                    <div>
                      <FieldLabel unit="in">Saddle Height</FieldLabel>
                      <input
                        type="number"
                        min="0"
                        step="0.125"
                        value={form.saddleHeight}
                        onChange={fieldInput('saddleHeight')}
                        className={inputCls}
                        placeholder="18"
                      />
                    </div>
                    <div>
                      <FieldLabel unit="in">Saddle Width</FieldLabel>
                      <input
                        type="number"
                        min="0"
                        step="0.125"
                        value={form.saddleWidth}
                        onChange={fieldInput('saddleWidth')}
                        className={inputCls}
                        placeholder="12"
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ── Notes ───────────────────────────────────────────────────── */}
            <section className="bg-white border border-slate-200 rounded-xl p-5">
              <SectionHeader>Remarks / Special Requirements</SectionHeader>
              <textarea
                value={form.notes}
                onChange={fieldInput('notes')}
                rows={3}
                placeholder="PWHT required, special NDE, paint spec, insulation clips, nameplate requirements, etc."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
              />
            </section>

            {/* ── Bottom actions ───────────────────────────────────────────── */}
            <div className="flex items-center justify-between pb-6">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="text-slate-500 hover:text-slate-700 text-sm transition-colors"
              >
                ← Back to dashboard
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium text-sm px-5 py-2.5 rounded-lg transition-colors"
              >
                {submitting ? 'Submitting…' : 'Submit RFQ'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
