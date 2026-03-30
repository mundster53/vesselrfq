import { useState, useRef, type ChangeEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import VesselViewer from '../components/VesselViewer'
import HeatExchangerViewer from '../components/HeatExchangerViewer'
import { api, ApiError } from '../lib/api'
import type {
  VesselDesignState,
  HxDesignState,
  NozzleRow,
  HeadType,
  ShellMaterial,
  SupportType,
  NozzleRating,
  FlangeType,
  NozzleLocation,
  Orientation,
  VesselType,
  TemaFrontHead,
  TemaShell,
  TemaRearHead,
  TubeOd,
  TubeBwg,
  TubeLength,
  TubeLayout,
  TubeJoint,
  BaffleType,
} from '../types/vessel'

// ─── Shared constants ─────────────────────────────────────────────────────────

const SHELL_MATERIALS: ShellMaterial[] = [
  'SA-516-70', 'SA-516-60', 'SA-240-304', 'SA-240-316', 'SA-240-316L', 'SA-285-C',
]
const CUSTOM_MATERIAL_SENTINEL = '__custom__'

const HEAD_TYPES: HeadType[] = ['2:1 Elliptical', 'Hemispherical', 'ASME F&D', 'Torispherical', 'Flat']

const HORIZONTAL_SUPPORTS: { value: SupportType; label: string }[] = [
  { value: 'saddles', label: 'Saddles' },
]
const VERTICAL_SUPPORTS: { value: SupportType; label: string }[] = [
  { value: 'skirt', label: 'Skirt' },
  { value: 'legs',  label: 'Legs' },
  { value: 'lugs',  label: 'Lugs' },
]

const NPS_SIZES = ['1/2','3/4','1','1-1/2','2','3','4','6','8','10','12','14','16','18','20','24']
const RATINGS: NozzleRating[] = ['150','300','600','900','1500','2500']
const FLANGE_TYPES: { value: FlangeType; label: string }[] = [
  { value: 'RFWN',  label: 'RFWN — Raised Face Weld Neck' },
  { value: 'RFSO',  label: 'RFSO — Raised Face Slip On' },
  { value: 'RFSW',  label: 'RFSW — Raised Face Socket Weld' },
  { value: 'RFTH',  label: 'RFTH — Raised Face Threaded' },
  { value: 'FFWN',  label: 'FFWN — Flat Face Weld Neck' },
  { value: 'FFSO',  label: 'FFSO — Flat Face Slip On' },
  { value: 'RJWN',  label: 'RJWN — Ring Joint Weld Neck' },
  { value: 'LJWN',  label: 'LJWN — Lap Joint Weld Neck with Stub End' },
  { value: 'LJFSE', label: 'LJFSE — Lap Joint Flange with Stub End' },
  { value: 'BFSO',  label: 'BFSO — Blind Flange (Slip On neck)' },
  { value: 'BF',    label: 'BF — Blind Flange' },
]

const NOZZLE_MATERIAL_SENTINEL = '__nozzle_custom__'
const NOZZLE_MATERIALS: { value: string; label: string }[] = [
  { value: 'SA-105',       label: 'SA-105 (Carbon Steel flanges)' },
  { value: 'SA-106-B',     label: 'SA-106-B (Carbon Steel pipe)' },
  { value: 'SA-182-F304',  label: 'SA-182-F304 (304 SS flanges)' },
  { value: 'SA-182-F316',  label: 'SA-182-F316 (316 SS flanges)' },
  { value: 'SA-312-TP304', label: 'SA-312-TP304 (304 SS pipe)' },
  { value: 'SA-312-TP316', label: 'SA-312-TP316 (316 SS pipe)' },
  { value: 'SA-182-F11',   label: 'SA-182-F11 (1-1/4 Cr-1/2 Mo flanges)' },
  { value: 'SA-335-P11',   label: 'SA-335-P11 (1-1/4 Cr-1/2 Mo pipe)' },
]

function getLocations(orientation: Orientation): { value: NozzleLocation; label: string }[] {
  return [
    { value: 'shell',      label: 'Shell' },
    { value: 'left_head',  label: orientation === 'vertical' ? 'Bottom Head' : 'Left Head' },
    { value: 'right_head', label: orientation === 'vertical' ? 'Top Head'    : 'Right Head' },
  ]
}

// ─── HX constants ─────────────────────────────────────────────────────────────

const TEMA_FRONT: { value: TemaFrontHead; label: string; desc: string }[] = [
  { value: 'A', label: 'A — Channel & removable cover',           desc: 'Most common type. Allows tube side cleaning without disturbing piping.' },
  { value: 'B', label: 'B — Bonnet (integral cover)',             desc: 'Lower cost than A type. Tube side cleaning requires removing the entire bonnet.' },
  { value: 'C', label: 'C — Channel integral with tubesheet',     desc: 'Removable cover. Used when tube side fluid must be kept away from shell side.' },
  { value: 'N', label: 'N — Fixed tubesheet integral channel',    desc: 'Channel is welded to tubesheet. Used for high pressure tube side service.' },
  { value: 'D', label: 'D — Special high pressure closure',       desc: 'For very high pressure tube side (typically above 1500 psi). Proprietary designs.' },
]

const TEMA_SHELL: { value: TemaShell; label: string; desc: string }[] = [
  { value: 'E', label: 'E — Single pass',            desc: 'Most common. Fluid makes one pass through the shell from inlet to outlet.' },
  { value: 'F', label: 'F — Two pass (long baffle)',  desc: 'Fluid makes two passes. Increases temperature driving force. Baffle may cause bypassing.' },
  { value: 'G', label: 'G — Split flow',              desc: 'Shell inlet is in center; fluid splits to both ends. Used for horizontal thermosiphon reboilers.' },
  { value: 'H', label: 'H — Double split flow',       desc: 'Two inlets and two outlets. Lower shell side pressure drop than E type.' },
  { value: 'J', label: 'J — Divided flow',            desc: 'Fluid enters center and exits at both ends (or reverse). Very low shell side pressure drop.' },
  { value: 'K', label: 'K — Kettle reboiler',         desc: 'Enlarged shell with weir to maintain liquid level. Bundle fully submerged. Distillation service.' },
  { value: 'X', label: 'X — Crossflow',               desc: 'Fluid flows perpendicular to tubes across the full bundle. Extremely low pressure drop. Condensers.' },
]

const TEMA_REAR: { value: TemaRearHead; label: string; desc: string }[] = [
  { value: 'L', label: 'L — Fixed tubesheet (like A front)',    desc: 'Welded to shell. No differential thermal expansion provision. Lowest cost. May need expansion joint.' },
  { value: 'M', label: 'M — Fixed tubesheet (like B front)',    desc: 'Bonnet-style welded construction on rear. Same limitations as L type.' },
  { value: 'N', label: 'N — Fixed tubesheet (like N front)',    desc: 'Integral channel welded to tubesheet on rear end.' },
  { value: 'P', label: 'P — Outside packed floating head',      desc: 'Floating tubesheet slides inside packing gland. Not for toxic or high pressure service.' },
  { value: 'S', label: 'S — Floating head with backing device', desc: 'Most common floating head type. Split backing ring. Bundle cannot be pulled without removing shell cover.' },
  { value: 'T', label: 'T — Pull-through floating bundle',      desc: 'Bundle can be removed without removing shell cover. Largest bundle-to-shell clearance.' },
  { value: 'U', label: 'U — U-tube bundle',                    desc: 'Tubes bent into U shape. Single tubesheet. Cannot be mechanically cleaned tube side. Best for high pressure.' },
  { value: 'W', label: 'W — Packed floating with lantern ring', desc: 'Older design. Both shell and tube side fluids can leak to atmosphere. Not for hazardous service.' },
]

const TUBE_ODS: { value: TubeOd; label: string }[] = [
  { value: '3/4',   label: '3/4"' },
  { value: '1',     label: '1"' },
  { value: '1-1/4', label: '1-1/4"' },
  { value: '1-1/2', label: '1-1/2"' },
  { value: '2',     label: '2"' },
]

const TUBE_BWGS: { value: TubeBwg; wall: string }[] = [
  { value: '10', wall: '0.134"' },
  { value: '11', wall: '0.120"' },
  { value: '12', wall: '0.109"' },
  { value: '13', wall: '0.095"' },
  { value: '14', wall: '0.083"' },
  { value: '15', wall: '0.072"' },
  { value: '16', wall: '0.065"' },
  { value: '17', wall: '0.058"' },
  { value: '18', wall: '0.049"' },
]

const TUBE_LENGTHS: TubeLength[] = ['6','8','10','12','16','20']

const TUBE_LAYOUTS: { value: TubeLayout; label: string; desc: string }[] = [
  { value: '30', label: 'Triangular 30°',         desc: 'Most common. Maximum number of tubes per shell diameter. Shell side cannot be mechanically cleaned.' },
  { value: '60', label: 'Rotated Triangular 60°', desc: 'Higher turbulence than square layouts.' },
  { value: '90', label: 'Square 90°',             desc: 'Allows mechanical cleaning on shell side. Fewer tubes than triangular for same shell diameter.' },
  { value: '45', label: 'Rotated Square 45°',     desc: 'Better heat transfer than square 90° while still allowing cleaning lanes.' },
]

const TUBE_JOINTS: { value: TubeJoint; label: string; desc: string }[] = [
  { value: 'expanded',        label: 'Expanded',        desc: 'Tube mechanically rolled into tubesheet hole. Standard joint. Not above ~600°F.' },
  { value: 'seal_welded',     label: 'Seal Welded',     desc: 'Expanded plus a seal weld. Prevents shell-to-tube leakage. Not a structural weld.' },
  { value: 'strength_welded', label: 'Strength Welded', desc: 'Full structural weld. High temperature, high pressure, or lethal service. Most expensive.' },
]

const BAFFLE_TYPES: { value: BaffleType; label: string; desc: string }[] = [
  { value: 'single_segmental', label: 'Single Segmental',          desc: 'Standard baffle. Cut is a segment of a circle. Creates crossflow across tubes. Most common type.' },
  { value: 'double_segmental', label: 'Double Segmental',          desc: 'Two baffles per baffle space. Reduces shell side pressure drop ~75% vs single segmental.' },
  { value: 'triple_segmental', label: 'Triple Segmental',          desc: 'Three baffles per baffle space. Further reduces pressure drop. Used for low pressure gas service.' },
  { value: 'disc_donut',       label: 'Disc & Donut',              desc: 'Alternating disc and donut shaped baffles. Good for fouling services. Low pressure drop.' },
  { value: 'rod',              label: 'Rod Baffles',               desc: 'Tubes supported by rods. Eliminates flow-induced vibration. Very low pressure drop. Gas-gas exchangers.' },
  { value: 'ntiw',             label: 'No Tubes in Window (NTIW)', desc: 'Segmental baffles with no tubes in baffle window zone. Eliminates vibration risk for long spans.' },
]

const HX_NOZZLE_SERVICES = [
  'Shell Inlet', 'Shell Outlet',
  'Tube Inlet (Channel)', 'Tube Outlet (Channel)',
  'Shell Vent', 'Shell Drain',
  'Tube Vent', 'Tube Drain',
  'Safety Relief (Shell)', 'Safety Relief (Tube)',
  'Instrument',
]

function getHxLocations(): { value: NozzleLocation; label: string }[] {
  return [
    { value: 'shell',      label: 'Shell' },
    { value: 'right_head', label: 'Front Channel' },
    { value: 'left_head',  label: 'Rear Head' },
  ]
}

// ─── HX Wizard constants ──────────────────────────────────────────────────────

const HX_DUTIES: { value: string; label: string }[] = [
  { value: 'process_to_process', label: 'Process-to-process' },
  { value: 'condenser',          label: 'Condenser' },
  { value: 'reboiler',           label: 'Reboiler / vaporizer' },
  { value: 'gas_cooler',         label: 'Gas cooler / heater' },
  { value: 'steam_heater',       label: 'Steam heater' },
  { value: 'other',              label: 'Other' },
]

const ARRANGEMENT_INFO: Record<string, { name: string; why: string }> = {
  AES: {
    name: 'Channel / Single pass shell / Floating head with backing device',
    why: 'Most common configuration for general refinery and petrochemical service. The floating head accommodates thermal expansion and the removable channel cover allows tube side cleaning without disturbing piping.',
  },
  AET: {
    name: 'Channel / Single pass shell / Pull-through floating bundle',
    why: 'Bundle can be removed without opening the shell cover, giving full access to both tube and shell sides. Preferred when fouling is severe enough to require frequent bundle extraction.',
  },
  AEN: {
    name: 'Channel / Single pass shell / Fixed tubesheet (like N front)',
    why: 'Both tubesheets are welded to the shell with no floating head. Suitable when the temperature difference between shell and tube side is small enough to keep differential thermal stresses within acceptable limits.',
  },
  AEM: {
    name: 'Channel / Single pass shell / Fixed tubesheet (like B front)',
    why: 'Fixed tubesheet with a bonnet-style rear closure. Lower cost than floating head designs; an expansion joint can be added to the shell if thermal expansion must be accommodated.',
  },
  AEL: {
    name: 'Channel / Single pass shell / Fixed tubesheet (like A front)',
    why: 'Removable cover on both front and rear ends provides easy access to both tubesheets. Fixed construction — verify that differential thermal stresses are acceptable for your operating conditions.',
  },
  AEU: {
    name: 'Channel / Single pass shell / U-tube bundle',
    why: 'U-bent tubes expand freely within the shell using only a single tubesheet, eliminating differential thermal stress entirely. The tube inside surfaces cannot be mechanically cleaned, so the tube side fluid should be clean or chemically treatable.',
  },
  BEU: {
    name: 'Bonnet / Single pass shell / U-tube bundle',
    why: 'Same thermal flexibility as the AEU with a lower-cost integral bonnet front head. Tube side access requires removing the bonnet; well-suited when tube side cleaning is not required.',
  },
  BEM: {
    name: 'Bonnet / Single pass shell / Fixed tubesheet (like B front)',
    why: 'Most economical fixed-tubesheet design. Lowest cost option when thermal expansion is not a concern; use square pitch to retain shell side mechanical cleaning lanes.',
  },
  AKT: {
    name: 'Channel / Kettle reboiler shell / Pull-through floating bundle',
    why: 'The enlarged kettle shell maintains a pool of boiling liquid above the bundle via an internal weir. This is the standard TEMA arrangement for distillation column reboiler service where liquid level control is required.',
  },
  AXS: {
    name: 'Channel / Crossflow shell / Floating head with backing device',
    why: 'The crossflow shell eliminates segmental baffles, resulting in extremely low shell side pressure drop. Ideal for total condensers and other vapor-side applications where minimizing pressure drop is critical.',
  },
}

function getHxArrangements(duty: string, hazardous: string, shellCleaning: string, highDeltaT: string, tubePasses = '1'): string[] {
  if (!duty || !hazardous || !shellCleaning || !highDeltaT) return []

  let codes: string[]

  if (duty === 'condenser' && highDeltaT === 'no') {
    codes = ['AXS', 'AES']
  } else if (hazardous === 'yes' && highDeltaT === 'yes') {
    codes = ['AES', 'AET']
  } else if (hazardous === 'yes' && highDeltaT === 'no') {
    codes = ['AES', 'AEN', 'AEM']
  } else if (hazardous === 'no' && highDeltaT === 'yes' && shellCleaning === 'no') {
    codes = ['AES', 'AEU', 'BEU']
  } else if (hazardous === 'no' && highDeltaT === 'yes' && shellCleaning === 'yes') {
    codes = ['AES', 'AET']
  } else if (hazardous === 'no' && highDeltaT === 'no' && shellCleaning === 'no') {
    codes = ['BEM', 'AEM', 'AEU']
  } else {
    codes = ['BEM', 'AEL']
  }

  if (duty === 'reboiler' && !codes.includes('AKT')) {
    codes = [...codes, 'AKT']
  }

  // U-tube bundles cannot support multiple tube passes
  if (tubePasses !== '1') {
    codes = codes.filter(c => !c.endsWith('U'))
  }

  return codes
}

// ─── Initial states ───────────────────────────────────────────────────────────

const initialTankState: VesselDesignState = {
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

const initialHxState: HxDesignState = {
  title: '',
  orientation: 'horizontal',
  temaFront: 'A',
  temaShell: 'E',
  temaRear: 'S',
  shellOd: '',
  shellLength: '',
  shellMaterial: '',
  shellsInSeries: '1',
  shellsInParallel: '1',
  tubeCount: '',
  tubeOd: '3/4',
  tubeBwg: '14',
  tubeLength: '20',
  tubeMaterial: '',
  tubeLayout: '30',
  tubePitch: '',
  tubeJoint: 'expanded',
  tubePasses: '1',
  baffleType: 'single_segmental',
  baffleCut: '25',
  baffleSpacing: '',
  impingementPlate: 'yes',
  shellMawp: '',
  shellDesignTemp: '',
  shellCorrosionAllowance: '',
  shellFluid: '',
  tubeMawp: '',
  tubeDesignTemp: '',
  tubeCorrosionAllowance: '',
  tubeFluid: '',
  nozzles: [
    { mark: 'N1', service: 'Shell Inlet',         size: '4', rating: '150', projection: 6, flangeType: 'RFWN', facing: 'RF', material: 'SA-105', materialCustom: '', location: 'shell',      quantity: 1, shellAngle: null, headPos: 'center' },
    { mark: 'N2', service: 'Shell Outlet',        size: '4', rating: '150', projection: 6, flangeType: 'RFWN', facing: 'RF', material: 'SA-105', materialCustom: '', location: 'shell',      quantity: 1, shellAngle: null, headPos: 'center' },
    { mark: 'N3', service: 'Tube Inlet (Channel)',  size: '3', rating: '150', projection: 6, flangeType: 'RFWN', facing: 'RF', material: 'SA-105', materialCustom: '', location: 'right_head', quantity: 1, shellAngle: null, headPos: 'center' },
    { mark: 'N4', service: 'Tube Outlet (Channel)', size: '3', rating: '150', projection: 6, flangeType: 'RFWN', facing: 'RF', material: 'SA-105', materialCustom: '', location: 'right_head', quantity: 1, shellAngle: null, headPos: 'center' },
  ],
  notes: '',
}

function emptyNozzle(mark: string): NozzleRow {
  return {
    mark, service: '', size: '4', rating: '150', projection: 6,
    flangeType: 'RFWN', facing: 'RF', material: 'SA-105', materialCustom: '',
    quantity: 1, location: 'shell', shellAngle: null, headPos: 'center',
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: string }) {
  return <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">{children}</h2>
}

function HelpTip({ text }: { text: string }) {
  return (
    <span className="relative inline-block ml-1.5 group">
      <button type="button" tabIndex={0}
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-500 text-[10px] font-bold cursor-help leading-none select-none focus:outline-none focus:ring-1 focus:ring-blue-400 align-middle">
        ?
      </button>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 leading-relaxed opacity-0 pointer-events-none group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 z-50 shadow-xl whitespace-normal">
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-[5px] border-x-transparent border-t-[5px] border-t-slate-800" />
      </span>
    </span>
  )
}

function FieldLabel({ children, unit, help }: { children: string; unit?: string; help?: string }) {
  return (
    <label className="block text-sm font-medium text-slate-700 mb-1">
      {children}
      {unit && <span className="font-normal text-slate-400 ml-1">({unit})</span>}
      {help && <HelpTip text={help} />}
    </label>
  )
}

const nozzleCellCls = 'w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

function NozzleCard({ nozzle, onUpdate, onRemove, locationOptions, serviceOptions }: {
  nozzle: NozzleRow
  onUpdate: <K extends keyof NozzleRow>(key: K, value: NozzleRow[K]) => void
  onRemove: () => void
  locationOptions: { value: NozzleLocation; label: string }[]
  serviceOptions?: string[]
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 shrink-0 min-w-[2.25rem] justify-center">
          {nozzle.mark}
        </span>
        {serviceOptions
          ? <select value={nozzle.service} onChange={e => onUpdate('service', e.target.value)}
              className={`${nozzleCellCls} flex-1`}>
              {serviceOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          : <input type="text" value={nozzle.service} onChange={e => onUpdate('service', e.target.value)}
              placeholder="Service (e.g. Inlet, Vent, Drain…)"
              className={`${nozzleCellCls} flex-1`} />
        }
        <button type="button" onClick={onRemove}
          className="text-slate-400 hover:text-red-500 transition-colors text-xl font-light leading-none shrink-0 px-1">
          ×
        </button>
      </div>
      {/* Body */}
      <div className="px-3 pb-3 pt-2.5 space-y-3">
        {/* Row 1: Size, Rating, Projection */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-xs text-slate-500 font-medium mb-1">Size (NPS)</p>
            <select value={nozzle.size} onChange={e => onUpdate('size', e.target.value)}
              className={nozzleCellCls}>
              {NPS_SIZES.map(s => <option key={s} value={s}>{s}&quot;</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium mb-1">Rating</p>
            <select value={nozzle.rating} onChange={e => onUpdate('rating', e.target.value as NozzleRating)}
              className={nozzleCellCls}>
              {RATINGS.map(r => <option key={r} value={r}>{r}#</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium mb-1">Projection (in)</p>
            <input type="number" min="0" step="1" value={nozzle.projection}
              onChange={e => onUpdate('projection', parseFloat(e.target.value) || 0)}
              className={nozzleCellCls} />
          </div>
        </div>
        {/* Row 2: Flange Type, Material, Location */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <p className="text-xs text-slate-500 font-medium mb-1">
              Flange Type
              <HelpTip text="Facing is implied by the designation — RF = raised face, FF = flat face, RJ = ring joint. For blind flanges, note the required facing in the Remarks field." />
            </p>
            <select value={nozzle.flangeType} onChange={e => onUpdate('flangeType', e.target.value as FlangeType)}
              className={nozzleCellCls}>
              {FLANGE_TYPES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium mb-1">Material</p>
            <select value={nozzle.material} onChange={e => onUpdate('material', e.target.value)}
              className={nozzleCellCls}>
              {NOZZLE_MATERIALS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              <option value={NOZZLE_MATERIAL_SENTINEL}>Other (specify)</option>
            </select>
            {nozzle.material === NOZZLE_MATERIAL_SENTINEL && (
              <input type="text" value={nozzle.materialCustom}
                onChange={e => onUpdate('materialCustom', e.target.value)}
                placeholder="Specify material…"
                className={`${nozzleCellCls} mt-1.5`} />
            )}
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium mb-1">Location</p>
            <select value={nozzle.location} onChange={e => onUpdate('location', e.target.value as NozzleLocation)}
              className={nozzleCellCls}>
              {locationOptions.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}

function StepCard({ stepNum, title, done, active, onEdit, summary, children }: {
  stepNum: number
  title: string
  done: boolean
  active: boolean
  onEdit: () => void
  summary?: ReactNode
  children?: ReactNode
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className={`flex items-center justify-between px-5 py-4${active ? ' border-b border-slate-100' : ''}`}>
        <div className="flex items-center gap-3">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${done ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 ring-1 ring-blue-200'}`}>
            {done ? '✓' : stepNum}
          </div>
          <span className="font-semibold text-slate-800">{title}</span>
        </div>
        {done && !active && (
          <button type="button" onClick={onEdit}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors">
            Edit
          </button>
        )}
      </div>
      {!active && done && summary && (
        <div className="px-5 pb-4 text-sm text-slate-600">{summary}</div>
      )}
      {active && <div className="px-5 pb-5">{children}</div>}
    </section>
  )
}

const inputCls  = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white'
const selectCls = inputCls

// ─── Main page ────────────────────────────────────────────────────────────────

export default function VesselDesignerPage() {
  const navigate = useNavigate()

  const [vesselType, setVesselType] = useState<VesselType>('tank')
  const [form, setForm]             = useState<VesselDesignState>(initialTankState)
  const [hxForm, setHxForm]         = useState<HxDesignState>(initialHxState)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')
  const [useCustomMaterial, setUseCustomMaterial] = useState(false)
  const [hxUseCustomShellMat, setHxUseCustomShellMat] = useState(false)
  const [hxUseCustomTubeMat,  setHxUseCustomTubeMat]  = useState(false)
  const customMaterialRef   = useRef<HTMLInputElement>(null)
  const hxCustomShellMatRef = useRef<HTMLInputElement>(null)
  const hxCustomTubeMatRef  = useRef<HTMLInputElement>(null)

  // ── HX Wizard state ────────────────────────────────────────────────────────
  const [hxStep, setHxStep]               = useState(1)
  const [hxStepsDone, setHxStepsDone]     = useState<Set<number>>(new Set())
  const [hxDuty, setHxDuty]               = useState('')
  const [hxHazardous, setHxHazardous]     = useState('')
  const [hxShellCleaning, setHxShellCleaning] = useState('')
  const [hxHighDeltaT, setHxHighDeltaT]   = useState('')
  const [hxArrangement, setHxArrangement] = useState('')
  const [hxShowAdvanced, setHxShowAdvanced] = useState(false)

  // ── Tank handlers ──────────────────────────────────────────────────────────

  function setField<K extends keyof VesselDesignState>(key: K, value: VesselDesignState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }
  function handleOrientationChange(o: Orientation) {
    setForm(prev => ({
      ...prev,
      orientation: o,
      supportType: o === 'horizontal' ? 'saddles' : 'skirt',
      saddleHeight: o === 'horizontal' ? prev.saddleHeight : '',
      saddleWidth:  o === 'horizontal' ? prev.saddleWidth  : '',
    }))
  }
  function fieldInput(key: keyof VesselDesignState) {
    return (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setField(key, e.target.value as VesselDesignState[typeof key])
  }
  function addNozzle() {
    const mark = `N${form.nozzles.length + 1}`
    setField('nozzles', [...form.nozzles, emptyNozzle(mark)])
  }
  function removeNozzle(i: number) {
    setField('nozzles', form.nozzles.filter((_, idx) => idx !== i))
  }
  function updateNozzle<K extends keyof NozzleRow>(i: number, key: K, value: NozzleRow[K]) {
    setField('nozzles', form.nozzles.map((n, idx) => idx === i ? { ...n, [key]: value } : n))
  }

  // ── HX handlers ────────────────────────────────────────────────────────────

  function setHxField<K extends keyof HxDesignState>(key: K, value: HxDesignState[K]) {
    setHxForm(prev => ({ ...prev, [key]: value }))
  }
  function hxFieldInput(key: keyof HxDesignState) {
    return (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setHxField(key, e.target.value as HxDesignState[typeof key])
  }
  function addHxNozzle() {
    const mark = `N${hxForm.nozzles.length + 1}`
    setHxField('nozzles', [...hxForm.nozzles, { ...emptyNozzle(mark), service: HX_NOZZLE_SERVICES[0] }])
  }
  function removeHxNozzle(i: number) {
    setHxField('nozzles', hxForm.nozzles.filter((_, idx) => idx !== i))
  }
  function updateHxNozzle<K extends keyof NozzleRow>(i: number, key: K, value: NozzleRow[K]) {
    setHxField('nozzles', hxForm.nozzles.map((n, idx) => idx === i ? { ...n, [key]: value } : n))
  }

  function handleTubeOdChange(val: TubeOd) {
    const odIn: Record<TubeOd, number> = { '3/4': 0.75, '1': 1.0, '1-1/4': 1.25, '1-1/2': 1.5, '2': 2.0 }
    const suggested = (odIn[val] * 1.25).toFixed(4).replace(/\.?0+$/, '')
    setHxForm(prev => ({ ...prev, tubeOd: val, tubePitch: suggested }))
  }

  function handleSelectArrangement(code: string) {
    setHxArrangement(code)
    if (code.length === 3) {
      const [front, shell, rear] = code.split('')
      setHxForm(prev => ({
        ...prev,
        temaFront: front as TemaFrontHead,
        temaShell: shell as TemaShell,
        temaRear:  rear  as TemaRearHead,
      }))
    }
  }

  function completeStep1() {
    const newOptions = getHxArrangements(hxDuty, hxHazardous, hxShellCleaning, hxHighDeltaT)
    if (hxArrangement && !newOptions.includes(hxArrangement)) setHxArrangement('')
    setHxStepsDone(s => new Set([...s, 1]))
    setHxStep(2)
  }

  // Computed
  const hxBaffleSpacing = parseFloat(hxForm.baffleSpacing) || 0
  const hxShellLenIn    = Math.max(parseFloat(hxForm.shellLength) || 0, 0)
  const hxBaffleCount   = hxBaffleSpacing > 0 && hxShellLenIn > 0
    ? Math.max(0, Math.floor(hxShellLenIn / hxBaffleSpacing) - 1)
    : null

  const temaCode = `${hxForm.temaFront || '?'}${hxForm.temaShell || '?'}${hxForm.temaRear || '?'}`

  const tubeOdNums: Record<string, number> = { '3/4': 0.75, '1': 1.0, '1-1/4': 1.25, '1-1/2': 1.5, '2': 2.0 }
  const suggestedPitch = hxForm.tubeOd
    ? ((tubeOdNums[hxForm.tubeOd] || 0) * 1.25).toFixed(4).replace(/\.?0+$/, '')
    : ''

  // Tube length validation
  const tubeLengthIn  = (parseFloat(hxForm.tubeLength) || 0) * 12
  const shellLengthIn = parseFloat(hxForm.shellLength) || 0
  const tubeLengthError = shellLengthIn > 0 && tubeLengthIn > shellLengthIn
    ? `Tube length cannot exceed shell length. Shell is ${shellLengthIn}" T/T (${(shellLengthIn / 12).toFixed(1)} ft).`
    : null

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setError('')
    const title = vesselType === 'tank' ? form.title : hxForm.title
    if (!title.trim()) return setError('RFQ title is required')

    setSubmitting(true)
    try {
      let result: { rfq: { id: number; title: string; vesselType?: string } }
      if (vesselType === 'tank') {
        result = await api.post('/rfqs', {
          vesselType: 'tank',
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
          nozzles: form.nozzles.map(n => ({
            ...n,
            material: n.material === NOZZLE_MATERIAL_SENTINEL ? n.materialCustom : n.material,
          })),
        })
        navigate('/rfq-submitted', {
          state: {
            rfqId:       result.rfq.id,
            title:       form.title.trim(),
            vesselType:  'tank',
            shellOd:     form.shellOd || undefined,
            shellLength: form.shellLength || undefined,
            headType:    form.headType || undefined,
            mawp:        form.mawp || undefined,
            nozzleCount: form.nozzles.length,
          },
        })
      } else {
        result = await api.post('/rfqs', {
          vesselType: 'heat_exchanger',
          title: hxForm.title.trim(),
          orientation: hxForm.orientation,
          shellOd: hxForm.shellOd || undefined,
          shellLength: hxForm.shellLength || undefined,
          shellMaterial: hxForm.shellMaterial || undefined,
          temaFront: hxForm.temaFront || undefined,
          temaShell: hxForm.temaShell || undefined,
          temaRear: hxForm.temaRear || undefined,
          shellsInSeries: hxForm.shellsInSeries || undefined,
          shellsInParallel: hxForm.shellsInParallel || undefined,
          tubeCount: hxForm.tubeCount || undefined,
          tubeOd: hxForm.tubeOd || undefined,
          tubeBwg: hxForm.tubeBwg || undefined,
          tubeLength: hxForm.tubeLength || undefined,
          tubeMaterial: hxForm.tubeMaterial || undefined,
          tubeLayout: hxForm.tubeLayout || undefined,
          tubePitch: hxForm.tubePitch || undefined,
          tubeJoint: hxForm.tubeJoint || undefined,
          baffleType: hxForm.baffleType || undefined,
          baffleCut: hxForm.baffleCut || undefined,
          baffleSpacing: hxForm.baffleSpacing || undefined,
          impingementPlate: hxForm.impingementPlate,
          shellMawp: hxForm.shellMawp || undefined,
          shellDesignTemp: hxForm.shellDesignTemp || undefined,
          shellCorrosionAllowance: hxForm.shellCorrosionAllowance || undefined,
          shellFluid: hxForm.shellFluid || undefined,
          tubeMawp: hxForm.tubeMawp || undefined,
          tubeDesignTemp: hxForm.tubeDesignTemp || undefined,
          tubeCorrosionAllowance: hxForm.tubeCorrosionAllowance || undefined,
          tubeFluid: hxForm.tubeFluid || undefined,
          notes: hxForm.notes || undefined,
          nozzles: hxForm.nozzles.map(n => ({
            ...n,
            material: n.material === NOZZLE_MATERIAL_SENTINEL ? n.materialCustom : n.material,
          })),
        })
        const temaCode = (hxForm.temaFront && hxForm.temaShell && hxForm.temaRear)
          ? `${hxForm.temaFront}-${hxForm.temaShell}-${hxForm.temaRear}`
          : undefined
        navigate('/rfq-submitted', {
          state: {
            rfqId:       result.rfq.id,
            title:       hxForm.title.trim(),
            vesselType:  'heat_exchanger',
            shellOd:     hxForm.shellOd || undefined,
            shellLength: hxForm.shellLength || undefined,
            mawp:        hxForm.shellMawp || undefined,
            temaCode,
            nozzleCount: hxForm.nozzles.length,
          },
        })
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Navbar />

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">

        {/* ── 3D Viewer ───────────────────────────────────────────────────── */}
        <div className="relative h-56 sm:h-72 lg:h-auto lg:flex-1 bg-slate-950 order-first lg:order-last">
          {vesselType === 'tank'
            ? <VesselViewer form={form} />
            : <HeatExchangerViewer form={hxForm} />
          }
          <div className="absolute bottom-3 right-3 text-slate-600 text-xs select-none pointer-events-none">
            Drag to orbit · Scroll to zoom
          </div>
        </div>

        {/* ── Form ────────────────────────────────────────────────────────── */}
        <div className="lg:w-[44%] xl:w-[42%] overflow-y-auto bg-slate-50 flex flex-col order-last lg:order-first">
          <div className="px-5 sm:px-6 py-5 space-y-5 flex-1">

            {/* Vessel type selector */}
            <section className="bg-white border border-slate-200 rounded-xl p-5">
              <SectionHeader>Vessel Type</SectionHeader>
              <div className="flex gap-6">
                {([['tank', 'Tank'], ['heat_exchanger', 'Heat Exchanger']] as [VesselType, string][]).map(([v, label]) => (
                  <label key={v} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="vesselType" value={v} checked={vesselType === v}
                      onChange={() => setVesselType(v)} className="accent-blue-600" />
                    <span className="text-sm font-medium text-slate-700">{label}</span>
                  </label>
                ))}
              </div>
            </section>

            {/* RFQ title + submit */}
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={vesselType === 'tank' ? form.title : hxForm.title}
                  onChange={e => vesselType === 'tank'
                    ? setField('title', e.target.value)
                    : setHxField('title', e.target.value)
                  }
                  placeholder={vesselType === 'tank'
                    ? 'RFQ Title (e.g. 60-inch OD Separator — Project 1241)'
                    : 'RFQ Title (e.g. 24" OD AES Heat Exchanger — Project 1241)'}
                  className="w-full text-base font-semibold border-0 border-b-2 border-slate-200 focus:border-blue-500 focus:outline-none bg-transparent pb-1 placeholder:text-slate-300 placeholder:font-normal"
                />
                <p className="text-xs text-slate-400 mt-1">Give this RFQ a descriptive title</p>
              </div>
              <button onClick={handleSubmit} disabled={submitting}
                className="shrink-0 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium text-sm px-4 py-2 rounded-lg transition-colors">
                {submitting ? 'Submitting…' : 'Submit RFQ'}
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
            )}

            {/* ════════════════════════════════════════════════════════════ */}
            {vesselType === 'tank' ? (
              <>
                {/* ── Shell Configuration ───────────────────────────────── */}
                <section className="bg-white border border-slate-200 rounded-xl p-5">
                  <SectionHeader>Shell Configuration</SectionHeader>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <FieldLabel unit="in OD">Shell Diameter</FieldLabel>
                      <input type="number" min="0" step="0.125" value={form.shellOd}
                        onChange={fieldInput('shellOd')} className={inputCls} placeholder="60" />
                    </div>
                    <div>
                      <FieldLabel unit="in T/T">Shell Length</FieldLabel>
                      <input type="number" min="0" step="0.125" value={form.shellLength}
                        onChange={fieldInput('shellLength')} className={inputCls} placeholder="120" />
                    </div>
                    <div>
                      <FieldLabel>Shell Material</FieldLabel>
                      <select
                        value={useCustomMaterial ? CUSTOM_MATERIAL_SENTINEL : form.shellMaterial}
                        onChange={e => {
                          if (e.target.value === CUSTOM_MATERIAL_SENTINEL) {
                            setUseCustomMaterial(true); setField('shellMaterial', '')
                            setTimeout(() => customMaterialRef.current?.focus(), 50)
                          } else {
                            setUseCustomMaterial(false); setField('shellMaterial', e.target.value)
                          }
                        }} className={selectCls}>
                        <option value="">— Select —</option>
                        {SHELL_MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
                        <option value={CUSTOM_MATERIAL_SENTINEL}>Other (specify)</option>
                      </select>
                      {useCustomMaterial && (
                        <input ref={customMaterialRef} type="text" value={form.shellMaterial}
                          onChange={fieldInput('shellMaterial')}
                          placeholder="e.g. Inconel 625, Duplex 2205…" className={inputCls + ' mt-2'} />
                      )}
                    </div>
                  </div>
                </section>

                {/* ── Orientation ───────────────────────────────────────── */}
                <section className="bg-white border border-slate-200 rounded-xl p-5">
                  <SectionHeader>Orientation</SectionHeader>
                  <div className="flex gap-6">
                    {(['horizontal', 'vertical'] as Orientation[]).map(o => (
                      <label key={o} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="orientation" value={o} checked={form.orientation === o}
                          onChange={() => handleOrientationChange(o)} className="accent-blue-600" />
                        <span className="text-sm text-slate-700 capitalize">{o}</span>
                      </label>
                    ))}
                  </div>
                </section>

                {/* ── Head Configuration ────────────────────────────────── */}
                <section className="bg-white border border-slate-200 rounded-xl p-5">
                  <SectionHeader>Head Configuration</SectionHeader>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <FieldLabel>Head Type</FieldLabel>
                      <select value={form.headType} onChange={fieldInput('headType')} className={selectCls}>
                        <option value="">— Select —</option>
                        {HEAD_TYPES.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                      <p className="text-xs text-slate-400 mt-1">Applies to both heads</p>
                    </div>
                  </div>
                </section>

                {/* ── Design Conditions ─────────────────────────────────── */}
                <section className="bg-white border border-slate-200 rounded-xl p-5">
                  <SectionHeader>Design Conditions</SectionHeader>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <FieldLabel unit="psi">MAWP</FieldLabel>
                      <input type="number" min="0" step="1" value={form.mawp}
                        onChange={fieldInput('mawp')} className={inputCls} placeholder="150" />
                    </div>
                    <div>
                      <FieldLabel unit="°F">Design Temperature</FieldLabel>
                      <input type="number" step="1" value={form.designTemp}
                        onChange={fieldInput('designTemp')} className={inputCls} placeholder="300" />
                    </div>
                    <div>
                      <FieldLabel unit="in">Corrosion Allowance</FieldLabel>
                      <input type="number" min="0" step="0.0625" value={form.corrosionAllowance}
                        onChange={fieldInput('corrosionAllowance')} className={inputCls} placeholder="0.125" />
                    </div>
                  </div>
                </section>

                {/* ── Nozzle Schedule ───────────────────────────────────── */}
                <section className="bg-white border border-slate-200 rounded-xl p-5">
                  <SectionHeader>Nozzle Schedule</SectionHeader>
                  <div className="space-y-2">
                    {form.nozzles.map((nozzle, i) => (
                      <NozzleCard
                        key={i}
                        nozzle={nozzle}
                        onUpdate={(key, value) => updateNozzle(i, key, value)}
                        onRemove={() => removeNozzle(i)}
                        locationOptions={getLocations(form.orientation)}
                      />
                    ))}
                    <button type="button" onClick={addNozzle}
                      className="w-full border-2 border-dashed border-slate-300 hover:border-blue-400 text-slate-500 hover:text-blue-600 rounded-xl py-3 text-sm font-medium transition-colors mt-1">
                      + Add Nozzle
                    </button>
                  </div>
                </section>

                {/* ── Supports ──────────────────────────────────────────── */}
                <section className="bg-white border border-slate-200 rounded-xl p-5">
                  <SectionHeader>Supports</SectionHeader>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <FieldLabel>Support Type</FieldLabel>
                      <div className="flex flex-wrap gap-3">
                        {(form.orientation === 'horizontal' ? HORIZONTAL_SUPPORTS : VERTICAL_SUPPORTS).map(({ value, label }) => (
                          <label key={value} className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="supportType" value={value}
                              checked={form.supportType === value}
                              onChange={() => {
                                setField('supportType', value as SupportType)
                                if (value !== 'saddles') { setField('saddleHeight', ''); setField('saddleWidth', '') }
                              }} className="accent-blue-600" />
                            <span className="text-sm text-slate-700">{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    {form.supportType === 'saddles' && (
                      <div className="sm:col-span-2 grid grid-cols-2 gap-4 max-w-sm">
                        <div>
                          <FieldLabel unit="in">Saddle Height</FieldLabel>
                          <input type="number" min="0" step="0.125" value={form.saddleHeight}
                            onChange={fieldInput('saddleHeight')} className={inputCls} placeholder="18" />
                        </div>
                        <div>
                          <FieldLabel unit="in">Saddle Width</FieldLabel>
                          <input type="number" min="0" step="0.125" value={form.saddleWidth}
                            onChange={fieldInput('saddleWidth')} className={inputCls} placeholder="12" />
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                {/* ── Notes ─────────────────────────────────────────────── */}
                <section className="bg-white border border-slate-200 rounded-xl p-5">
                  <SectionHeader>Remarks / Special Requirements</SectionHeader>
                  <textarea value={form.notes} onChange={fieldInput('notes')} rows={3}
                    placeholder="PWHT required, special NDE, paint spec, insulation clips, nameplate requirements, etc."
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y" />
                </section>
              </>
            ) : (
              /* ════════════════════════════════════════════════════════════ */
              /* HEAT EXCHANGER WIZARD                                        */
              /* ════════════════════════════════════════════════════════════ */
              <>
                {/* ── Progress bar ──────────────────────────────────────── */}
                <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
                  <div className="flex items-center">
                    {[
                      { n: 1, label: 'Service' },
                      { n: 2, label: 'Arrangement' },
                      { n: 3, label: 'Dimensions' },
                      { n: 4, label: 'Conditions' },
                    ].map(({ n, label }, idx) => {
                      const done   = hxStepsDone.has(n)
                      const active = hxStep === n
                      return (
                        <div key={n} className="flex items-center flex-1 last:flex-none">
                          <div className="flex flex-col items-center min-w-0">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${done ? 'bg-blue-600 text-white' : active ? 'bg-blue-600 text-white ring-4 ring-blue-100' : 'bg-slate-100 text-slate-400'}`}>
                              {done ? '✓' : n}
                            </div>
                            <span className={`text-xs mt-1 font-medium whitespace-nowrap transition-colors ${done || active ? 'text-blue-600' : 'text-slate-400'}`}>{label}</span>
                          </div>
                          {idx < 3 && (
                            <div className={`flex-1 h-0.5 mx-2 mb-4 transition-colors ${done ? 'bg-blue-600' : 'bg-slate-200'}`} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* ── Step 1 — Service Requirements ─────────────────────── */}
                <StepCard
                  stepNum={1}
                  title="Service Requirements"
                  done={hxStepsDone.has(1)}
                  active={hxStep === 1}
                  onEdit={() => setHxStep(1)}
                  summary={
                    <p className="text-sm text-slate-600">
                      {HX_DUTIES.find(d => d.value === hxDuty)?.label}
                      {' · '}
                      {hxHazardous === 'yes' ? 'Hazardous / high-pressure tube side' : 'Non-hazardous tube side'}
                      {' · '}
                      {hxShellCleaning === 'yes' ? 'Shell side cleaning needed' : 'No shell cleaning'}
                      {' · '}
                      {hxHighDeltaT === 'yes' ? 'Significant ΔT' : 'Similar temperatures'}
                    </p>
                  }
                >
                  <div className="space-y-6 pt-1">
                    {/* Q1 */}
                    <div>
                      <p className="text-sm font-semibold text-slate-800 mb-2">What is the primary duty?</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {HX_DUTIES.map(d => (
                          <button key={d.value} type="button" onClick={() => setHxDuty(d.value)}
                            className={`text-sm px-3 py-2.5 rounded-lg border font-medium text-left transition-colors ${hxDuty === d.value ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-blue-200'}`}>
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Q2 */}
                    <div>
                      <p className="text-sm font-semibold text-slate-800 mb-0.5">Is the tube side fluid hazardous, toxic, or above 1500 psi?</p>
                      <p className="text-xs text-slate-400 mb-2">Affects head type — high-risk fluids require tighter containment</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }].map(({ v, l }) => (
                          <button key={v} type="button" onClick={() => setHxHazardous(v)}
                            className={`py-2.5 rounded-lg border text-sm font-medium transition-colors ${hxHazardous === v ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-blue-200'}`}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Q3 */}
                    <div>
                      <p className="text-sm font-semibold text-slate-800 mb-0.5">Do you need to mechanically clean the shell side?</p>
                      <p className="text-xs text-slate-400 mb-2">Square tube pitch allows cleaning lanes; triangular pitch does not</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[{ v: 'yes', l: 'Yes — fouling service' }, { v: 'no', l: 'No — clean service' }].map(({ v, l }) => (
                          <button key={v} type="button" onClick={() => setHxShellCleaning(v)}
                            className={`py-2.5 rounded-lg border text-sm font-medium transition-colors ${hxShellCleaning === v ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-blue-200'}`}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Q4 */}
                    <div>
                      <p className="text-sm font-semibold text-slate-800 mb-0.5">Is there a significant temperature difference between shell and tube side?</p>
                      <p className="text-xs text-slate-400 mb-2">ΔT &gt; ~50°F affects whether a floating head or expansion joint is needed</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[{ v: 'yes', l: 'Yes — significant ΔT' }, { v: 'no', l: 'No — similar temperatures' }].map(({ v, l }) => (
                          <button key={v} type="button" onClick={() => setHxHighDeltaT(v)}
                            className={`py-2.5 rounded-lg border text-sm font-medium transition-colors ${hxHighDeltaT === v ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-blue-200'}`}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button type="button"
                        disabled={!hxDuty || !hxHazardous || !hxShellCleaning || !hxHighDeltaT}
                        onClick={completeStep1}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
                        Continue →
                      </button>
                    </div>
                  </div>
                </StepCard>

                {/* ── Step 2 — Arrangement Selection ────────────────────── */}
                {(hxStep === 2 || hxStepsDone.has(2)) && hxStepsDone.has(1) && (() => {
                  const options = getHxArrangements(hxDuty, hxHazardous, hxShellCleaning, hxHighDeltaT, hxForm.tubePasses)
                  return (
                    <StepCard
                      stepNum={2}
                      title="Arrangement Selection"
                      done={hxStepsDone.has(2)}
                      active={hxStep === 2}
                      onEdit={() => setHxStep(2)}
                      summary={
                        hxArrangement ? (
                          <p className="text-sm text-slate-600">
                            <span className="font-mono font-bold text-blue-700 text-base mr-2">{hxArrangement}</span>
                            {ARRANGEMENT_INFO[hxArrangement]?.name}
                          </p>
                        ) : undefined
                      }
                    >
                      <div className="space-y-1 pt-1">
                        <p className="text-sm text-slate-500 mb-4">Here are the arrangements that fit your requirements.</p>
                        <div className="space-y-3">
                          {options.map(code => {
                            const info = ARRANGEMENT_INFO[code]
                            const selected = hxArrangement === code
                            return (
                              <button key={code} type="button" onClick={() => handleSelectArrangement(code)}
                                className={`w-full text-left p-4 rounded-xl border-2 transition-colors ${selected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-200 bg-white'}`}>
                                <div className="flex items-start gap-4">
                                  <span className="font-mono text-2xl font-bold text-blue-700 shrink-0 mt-0.5 min-w-[3rem]">{code}</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-800 mb-1">{info?.name}</p>
                                    <p className="text-xs text-slate-500 leading-relaxed">{info?.why}</p>
                                  </div>
                                  {selected && (
                                    <div className="shrink-0 mt-0.5">
                                      <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                          <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                                        </svg>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                        <div className="flex items-center justify-between pt-4">
                          <button type="button" onClick={() => setHxStep(1)}
                            className="text-slate-500 hover:text-slate-700 text-sm transition-colors">← Back</button>
                          <button type="button"
                            disabled={!hxArrangement}
                            onClick={() => { setHxStepsDone(s => new Set([...s, 2])); setHxStep(3) }}
                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
                            Continue →
                          </button>
                        </div>
                      </div>
                    </StepCard>
                  )
                })()}

                {/* ── Step 3 — Physical Dimensions ──────────────────────── */}
                {(hxStep === 3 || hxStepsDone.has(3)) && hxStepsDone.has(2) && (
                  <StepCard
                    stepNum={3}
                    title="Physical Dimensions"
                    done={hxStepsDone.has(3)}
                    active={hxStep === 3}
                    onEdit={() => setHxStep(3)}
                    summary={
                      <div className="space-y-0.5 text-sm text-slate-600">
                        {(hxForm.shellOd || hxForm.shellLength) && (
                          <p>
                            Shell:{' '}
                            {hxForm.shellOd && <span>{hxForm.shellOd}&quot; OD</span>}
                            {hxForm.shellOd && hxForm.shellLength && ' × '}
                            {hxForm.shellLength && <span>{hxForm.shellLength}&quot; T/T</span>}
                            {hxForm.shellMaterial && <span> · {hxForm.shellMaterial}</span>}
                            {' · '}<span className="capitalize">{hxForm.orientation}</span>
                          </p>
                        )}
                        {(hxForm.tubeCount || hxForm.tubeOd) && (
                          <p>
                            Tubes:{' '}
                            {hxForm.tubeCount && <span>{hxForm.tubeCount} × </span>}
                            {hxForm.tubeOd && <span>{hxForm.tubeOd}&quot; OD</span>}
                            {hxForm.tubeBwg && <span> BWG {hxForm.tubeBwg}</span>}
                            {hxForm.tubeLength && <span>, {hxForm.tubeLength} ft</span>}
                            {hxForm.tubePasses && hxForm.tubePasses !== '1' && <span>, {hxForm.tubePasses}-pass</span>}
                            {hxForm.tubeMaterial && <span> · {hxForm.tubeMaterial}</span>}
                          </p>
                        )}
                        {hxForm.baffleType && (
                          <p>Baffles: {BAFFLE_TYPES.find(b => b.value === hxForm.baffleType)?.label}{hxForm.baffleCut && `, ${hxForm.baffleCut}% cut`}{hxForm.baffleSpacing && `, ${hxForm.baffleSpacing}" spacing`}</p>
                        )}
                      </div>
                    }
                  >
                    <div className="space-y-6 pt-1">

                      {/* Shell */}
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Shell</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div>
                            <FieldLabel unit="in OD" help={`Outside diameter of the shell in inches. Common sizes: 8" to 60". TEMA specifies standard shell sizes. Larger diameter = more tubes but higher cost per unit area.`}>Shell OD</FieldLabel>
                            <input type="number" min="0" step="0.125" value={hxForm.shellOd}
                              onChange={hxFieldInput('shellOd')} className={inputCls} placeholder="24" />
                          </div>
                          <div>
                            <FieldLabel unit="in T/T" help={`Tangent-to-tangent length — measured from where the head curves begin on each end. Does not include head depth. Typical range: 96" to 240". Longer shells have more heat transfer area but higher shipping and installation cost.`}>Shell Length</FieldLabel>
                            <input type="number" min="0" step="0.125" value={hxForm.shellLength}
                              onChange={hxFieldInput('shellLength')} className={inputCls} placeholder="240" />
                          </div>
                          <div>
                            <FieldLabel help="Horizontal is most common. Vertical units are used when plot space is limited, for kettle reboilers, or when liquid draining is important. Condensers are often horizontal.">Orientation</FieldLabel>
                            <div className="flex gap-4 mt-2">
                              {(['horizontal', 'vertical'] as Orientation[]).map(o => (
                                <label key={o} className="flex items-center gap-2 cursor-pointer">
                                  <input type="radio" name="hxOrientation" value={o}
                                    checked={hxForm.orientation === o}
                                    onChange={() => setHxField('orientation', o)}
                                    className="accent-blue-600" />
                                  <span className="text-sm text-slate-700 capitalize">{o}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                          <div>
                            <FieldLabel>Shell Material</FieldLabel>
                            <select
                              value={hxUseCustomShellMat ? CUSTOM_MATERIAL_SENTINEL : hxForm.shellMaterial}
                              onChange={e => {
                                if (e.target.value === CUSTOM_MATERIAL_SENTINEL) {
                                  setHxUseCustomShellMat(true); setHxField('shellMaterial', '')
                                  setTimeout(() => hxCustomShellMatRef.current?.focus(), 50)
                                } else {
                                  setHxUseCustomShellMat(false); setHxField('shellMaterial', e.target.value)
                                }
                              }} className={selectCls}>
                              <option value="">— Select —</option>
                              {SHELL_MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
                              <option value={CUSTOM_MATERIAL_SENTINEL}>Other (specify)</option>
                            </select>
                            {hxUseCustomShellMat && (
                              <input ref={hxCustomShellMatRef} type="text" value={hxForm.shellMaterial}
                                onChange={hxFieldInput('shellMaterial')}
                                placeholder="e.g. Duplex 2205, Hastelloy…" className={inputCls + ' mt-2'} />
                            )}
                          </div>
                          <div>
                            <FieldLabel help="Multiple shells in series increases the effective temperature cross. Use when a single shell cannot achieve the required heat duty due to temperature cross constraints. Each shell adds cost and pressure drop.">Shells in Series</FieldLabel>
                            <input type="number" min="1" step="1" value={hxForm.shellsInSeries}
                              onChange={hxFieldInput('shellsInSeries')} className={inputCls} />
                          </div>
                          <div>
                            <FieldLabel help="Parallel shells split the flow between multiple identical units. Used when flow rate exceeds practical shell size, or for spare capacity. All shells must be identical.">Shells in Parallel</FieldLabel>
                            <input type="number" min="1" step="1" value={hxForm.shellsInParallel}
                              onChange={hxFieldInput('shellsInParallel')} className={inputCls} />
                          </div>
                        </div>
                      </div>

                      {/* Tube Bundle */}
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Tube Bundle</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                          <div>
                            <FieldLabel help="Total tube count determines heat transfer area. Area = π × OD × length × count. More tubes = more area but also more cost and weight. Typical densities: 200–600 tubes for small exchangers, 1000–5000 for large.">Number of Tubes</FieldLabel>
                            <input type="number" min="1" step="1" value={hxForm.tubeCount}
                              onChange={hxFieldInput('tubeCount')} className={inputCls} placeholder="500" />
                          </div>
                          <div>
                            <FieldLabel help={`3/4" is the most common and economical choice. 1" tubes are used for fouling services or when mechanical cleaning is required. Larger OD = lower tube-side pressure drop but fewer tubes per shell.`}>Tube OD</FieldLabel>
                            <select value={hxForm.tubeOd}
                              onChange={e => handleTubeOdChange(e.target.value as TubeOd)}
                              className={selectCls}>
                              {TUBE_ODS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <FieldLabel help="Birmingham Wire Gauge — lower number = thicker wall. BWG 16 (0.065&quot;) is most common for process service. Thicker walls (BWG 10–12) for high pressure, corrosive, or erosive service. Thinner walls (BWG 18) reduce cost but limit pressure rating.">Tube BWG</FieldLabel>
                            <select value={hxForm.tubeBwg}
                              onChange={e => setHxField('tubeBwg', e.target.value as TubeBwg)}
                              className={selectCls}>
                              {TUBE_BWGS.map(b => <option key={b.value} value={b.value}>BWG {b.value} ({b.wall} wall)</option>)}
                            </select>
                          </div>
                          <div>
                            <FieldLabel unit="ft" help={`Longer tubes reduce the shell diameter needed for a given area, lowering cost. Standard lengths: 8, 10, 12, 16, 20 ft. Must be shorter than shell T/T length. 20 ft tubes are most economical but may cause shipping or plot space issues.`}>Tube Length</FieldLabel>
                            <select value={hxForm.tubeLength}
                              onChange={e => setHxField('tubeLength', e.target.value as TubeLength)}
                              className={`${selectCls}${tubeLengthError ? ' !border-red-400 focus:!ring-red-500' : ''}`}>
                              {TUBE_LENGTHS.map(l => <option key={l} value={l}>{l} ft</option>)}
                            </select>
                            {tubeLengthError && (
                              <p className="text-xs text-red-600 mt-1 leading-snug">{tubeLengthError}</p>
                            )}
                          </div>
                          <div>
                            <FieldLabel help="Number of times the tube-side fluid traverses the shell length. More passes increase tube-side velocity and heat transfer coefficient but also increase pressure drop. Even numbers only for fixed tubesheet and floating head types. U-tube bundles are inherently 2-pass.">Number of Tube Passes</FieldLabel>
                            <select value={hxForm.tubePasses}
                              onChange={e => setHxField('tubePasses', e.target.value)}
                              className={selectCls}>
                              {['1','2','4','6','8'].map(p => (
                                <option key={p} value={p}>{p} {p === '1' ? 'pass' : 'passes'}</option>
                              ))}
                            </select>
                            {hxForm.tubePasses !== '1' && (
                              <p className="text-xs text-slate-500 mt-1 leading-snug">Multi-pass increases tube-side velocity and heat transfer. Effective tube-side length = tube length × {hxForm.tubePasses} passes.</p>
                            )}
                          </div>
                          <div>
                            <FieldLabel help="Match to tube-side fluid corrosivity. Carbon steel (SA-214) for non-corrosive service. Stainless (SA-213-TP316) for mild corrosion. Use admiralty brass, copper-nickel, or titanium for seawater and aggressive services.">Tube Material</FieldLabel>
                            <select
                              value={hxUseCustomTubeMat ? CUSTOM_MATERIAL_SENTINEL : hxForm.tubeMaterial}
                              onChange={e => {
                                if (e.target.value === CUSTOM_MATERIAL_SENTINEL) {
                                  setHxUseCustomTubeMat(true); setHxField('tubeMaterial', '')
                                  setTimeout(() => hxCustomTubeMatRef.current?.focus(), 50)
                                } else {
                                  setHxUseCustomTubeMat(false); setHxField('tubeMaterial', e.target.value)
                                }
                              }} className={selectCls}>
                              <option value="">— Select —</option>
                              {SHELL_MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
                              <option value="SA-213-T11">SA-213-T11</option>
                              <option value="SA-213-T22">SA-213-T22</option>
                              <option value="SA-213-TP304">SA-213-TP304</option>
                              <option value="SA-213-TP316">SA-213-TP316</option>
                              <option value={CUSTOM_MATERIAL_SENTINEL}>Other (specify)</option>
                            </select>
                            {hxUseCustomTubeMat && (
                              <input ref={hxCustomTubeMatRef} type="text" value={hxForm.tubeMaterial}
                                onChange={hxFieldInput('tubeMaterial')}
                                placeholder="e.g. Admiralty brass, Titanium Gr 2…" className={inputCls + ' mt-2'} />
                            )}
                          </div>
                          <div>
                            <FieldLabel unit="in" help={`Center-to-center distance between tubes. TEMA minimum is 1.25× tube OD. Standard pitch for 3/4" tubes is 15/16" (triangular) or 1" (square). Tighter pitch = more tubes but higher shell-side pressure drop and more fouling risk.`}>Tube Pitch</FieldLabel>
                            <input type="number" min="0" step="0.0625" value={hxForm.tubePitch}
                              onChange={hxFieldInput('tubePitch')} className={inputCls}
                              placeholder={suggestedPitch || '0.9375'} />
                            {suggestedPitch && !hxForm.tubePitch && (
                              <p className="text-xs text-slate-400 mt-1">Suggested: {suggestedPitch}" (1.25× OD)</p>
                            )}
                          </div>
                        </div>

                        <div className="mb-4">
                          <FieldLabel help="Triangular pitch packs more tubes per shell — use for clean services. Square pitch allows mechanical cleaning lanes on the shell side — required for fouling shell-side fluids. Rotated square balances cleaning access with better heat transfer.">Tube Layout</FieldLabel>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                            {TUBE_LAYOUTS.map(opt => (
                              <label key={opt.value} className={`flex gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${hxForm.tubeLayout === opt.value ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-200'}`}>
                                <input type="radio" name="tubeLayout" value={opt.value}
                                  checked={hxForm.tubeLayout === opt.value}
                                  onChange={() => setHxField('tubeLayout', opt.value as TubeLayout)}
                                  className="accent-blue-600 mt-0.5 shrink-0" />
                                <div>
                                  <p className="text-xs font-semibold text-slate-700">{opt.label}</p>
                                  <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div>
                          <FieldLabel help="Expanded joints are standard and lowest cost. Add seal weld when zero leakage between shell and tube side is required (toxic or high-value fluids). Strength weld for high temperature (above 600°F), lethal service, or when ASME Code requires.">Tube-to-Tubesheet Joint</FieldLabel>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
                            {TUBE_JOINTS.map(opt => (
                              <label key={opt.value} className={`flex gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${hxForm.tubeJoint === opt.value ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-200'}`}>
                                <input type="radio" name="tubeJoint" value={opt.value}
                                  checked={hxForm.tubeJoint === opt.value}
                                  onChange={() => setHxField('tubeJoint', opt.value as TubeJoint)}
                                  className="accent-blue-600 mt-0.5 shrink-0" />
                                <div>
                                  <p className="text-xs font-semibold text-slate-700">{opt.label}</p>
                                  <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Baffles */}
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Baffles</p>
                        <div className="mb-4">
                          <FieldLabel help="Single segmental is standard for most applications. Use double or triple segmental to reduce shell-side pressure drop when it is the limiting constraint. Rod baffles eliminate vibration in gas-gas service.">Baffle Type</FieldLabel>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                            {BAFFLE_TYPES.map(opt => (
                              <label key={opt.value} className={`flex gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${hxForm.baffleType === opt.value ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-200'}`}>
                                <input type="radio" name="baffleType" value={opt.value}
                                  checked={hxForm.baffleType === opt.value}
                                  onChange={() => setHxField('baffleType', opt.value as BaffleType)}
                                  className="accent-blue-600 mt-0.5 shrink-0" />
                                <div>
                                  <p className="text-xs font-semibold text-slate-700">{opt.label}</p>
                                  <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                          <div>
                            <FieldLabel unit="%" help="Percentage of shell diameter cut away. 25% is standard. Lower cut (15–20%) increases velocity and heat transfer but raises pressure drop. Higher cut (35–45%) reduces pressure drop for gas service.">Baffle Cut</FieldLabel>
                            <input type="number" min="15" max="45" step="1" value={hxForm.baffleCut}
                              onChange={hxFieldInput('baffleCut')} className={inputCls} placeholder="25" />
                            <p className="text-xs text-slate-400 mt-1">15–45%. Standard 25%.</p>
                          </div>
                          <div>
                            <FieldLabel unit="in" help="Distance between baffles. Closer spacing increases shell-side heat transfer and pressure drop. TEMA sets minimum spacing at 20% of shell ID or 2 inches, whichever is greater. Maximum spacing is shell ID.">Baffle Spacing</FieldLabel>
                            <input type="number" min="0" step="0.25" value={hxForm.baffleSpacing}
                              onChange={hxFieldInput('baffleSpacing')} className={inputCls} placeholder="12" />
                          </div>
                          <div>
                            <FieldLabel>No. of Baffles</FieldLabel>
                            <div className={`${inputCls} bg-slate-50 text-slate-500`}>
                              {hxBaffleCount !== null ? hxBaffleCount : '—'}
                            </div>
                            <p className="text-xs text-slate-400 mt-1">Auto-calculated</p>
                          </div>
                          <div>
                            <FieldLabel help="Steel plate positioned above the shell inlet nozzle to protect tubes from direct fluid impingement. Required by TEMA when the product of fluid density × velocity² exceeds 1500 for non-corrosive fluids, or 500 for corrosive or erosive fluids.">Impingement Plate</FieldLabel>
                            <div className="flex gap-4 mt-2">
                              {(['yes', 'no'] as const).map(v => (
                                <label key={v} className="flex items-center gap-2 cursor-pointer">
                                  <input type="radio" name="impingement" value={v}
                                    checked={hxForm.impingementPlate === v}
                                    onChange={() => setHxField('impingementPlate', v)}
                                    className="accent-blue-600" />
                                  <span className="text-sm text-slate-700 capitalize">{v}</span>
                                </label>
                              ))}
                            </div>
                            <p className="text-xs text-slate-400 mt-1">Required when ρV² &gt; 1500</p>
                          </div>
                        </div>
                      </div>

                      {/* Advanced toggle */}
                      <div className="border-t border-slate-100 pt-4">
                        <button type="button"
                          onClick={() => setHxShowAdvanced(v => !v)}
                          className="text-sm text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-1.5">
                          <svg className={`w-4 h-4 transition-transform ${hxShowAdvanced ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          Need to specify exact TEMA types or override recommendations? Advanced mode
                        </button>

                        {hxShowAdvanced && (
                          <div className="mt-4 space-y-4">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">TEMA Override</p>
                              <span className="font-mono text-xl font-bold text-blue-600">{temaCode}</span>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                              <div>
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Front Head</p>
                                <div className="space-y-1.5">
                                  {TEMA_FRONT.map(opt => (
                                    <label key={opt.value} className={`flex gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${hxForm.temaFront === opt.value ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-200'}`}>
                                      <input type="radio" name="temaFrontAdv" value={opt.value}
                                        checked={hxForm.temaFront === opt.value}
                                        onChange={() => setHxField('temaFront', opt.value as TemaFrontHead)}
                                        className="accent-blue-600 mt-0.5 shrink-0" />
                                      <div>
                                        <p className="text-xs font-semibold text-slate-700">{opt.label}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Shell Type</p>
                                <div className="space-y-1.5">
                                  {TEMA_SHELL.map(opt => (
                                    <label key={opt.value} className={`flex gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${hxForm.temaShell === opt.value ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-200'}`}>
                                      <input type="radio" name="temaShellAdv" value={opt.value}
                                        checked={hxForm.temaShell === opt.value}
                                        onChange={() => setHxField('temaShell', opt.value as TemaShell)}
                                        className="accent-blue-600 mt-0.5 shrink-0" />
                                      <div>
                                        <p className="text-xs font-semibold text-slate-700">{opt.label}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Rear Head</p>
                                <div className="space-y-1.5">
                                  {TEMA_REAR.map(opt => (
                                    <label key={opt.value} className={`flex gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${hxForm.temaRear === opt.value ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-200'}`}>
                                      <input type="radio" name="temaRearAdv" value={opt.value}
                                        checked={hxForm.temaRear === opt.value}
                                        onChange={() => setHxField('temaRear', opt.value as TemaRearHead)}
                                        className="accent-blue-600 mt-0.5 shrink-0" />
                                      <div>
                                        <p className="text-xs font-semibold text-slate-700">{opt.label}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <button type="button" onClick={() => setHxStep(2)}
                          className="text-slate-500 hover:text-slate-700 text-sm transition-colors">← Back</button>
                        <button type="button"
                          onClick={() => { setHxStepsDone(s => new Set([...s, 3])); setHxStep(4) }}
                          disabled={!!tubeLengthError}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                          Continue →
                        </button>
                      </div>
                    </div>
                  </StepCard>
                )}

                {/* ── Step 4 — Design Conditions & Nozzles ──────────────── */}
                {hxStep === 4 && hxStepsDone.has(3) && (
                  <StepCard
                    stepNum={4}
                    title="Design Conditions & Nozzles"
                    done={hxStepsDone.has(4)}
                    active={true}
                    onEdit={() => setHxStep(4)}
                  >
                    <div className="space-y-6 pt-1">

                      {/* Design Conditions */}
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Design Conditions</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div>
                            <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-3 border-b border-slate-100 pb-2">Shell Side</p>
                            <div className="space-y-3">
                              <div>
                                <FieldLabel unit="psi" help="Maximum allowable working pressure on the shell side in psi. Used to size the shell wall, nozzles, and flanges. Add 10% margin over operating pressure minimum; consult process engineer for final value.">Design Pressure</FieldLabel>
                                <input type="number" min="0" step="1" value={hxForm.shellMawp}
                                  onChange={hxFieldInput('shellMawp')} className={inputCls} placeholder="150" />
                              </div>
                              <div>
                                <FieldLabel unit="°F" help="Maximum temperature the shell side will see in service in °F. Drives material selection and allowable stress. Include upsets and regeneration cycles, not just normal operating temperature.">Design Temperature</FieldLabel>
                                <input type="number" step="1" value={hxForm.shellDesignTemp}
                                  onChange={hxFieldInput('shellDesignTemp')} className={inputCls} placeholder="300" />
                              </div>
                              <div>
                                <FieldLabel unit="in" help="Additional wall thickness added to compensate for corrosion over the design life, typically 10–25 years. Common values: 0.0625″ for clean services, 0.125″ for mild corrosion, 0.250″ for aggressive services.">Corrosion Allowance</FieldLabel>
                                <input type="number" min="0" step="0.0625" value={hxForm.shellCorrosionAllowance}
                                  onChange={hxFieldInput('shellCorrosionAllowance')} className={inputCls} placeholder="0.125" />
                              </div>
                              <div>
                                <FieldLabel help="Brief description of the shell-side fluid. Helps fabricators select materials and identify any special handling requirements (e.g. H₂S service, cryogenic, lethal).">Fluid Service</FieldLabel>
                                <input type="text" value={hxForm.shellFluid}
                                  onChange={hxFieldInput('shellFluid')} className={inputCls} placeholder="e.g. Crude oil, steam…" />
                              </div>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-3 border-b border-slate-100 pb-2">Tube Side</p>
                            <div className="space-y-3">
                              <div>
                                <FieldLabel unit="psi" help="Maximum allowable working pressure on the tube side in psi. Tube-side pressure is typically higher than shell-side since tubes can handle higher pressure more economically than a large-diameter shell.">Design Pressure</FieldLabel>
                                <input type="number" min="0" step="1" value={hxForm.tubeMawp}
                                  onChange={hxFieldInput('tubeMawp')} className={inputCls} placeholder="300" />
                              </div>
                              <div>
                                <FieldLabel unit="°F" help="Maximum temperature the tube side will see in °F. If tube-side fluid is the hot stream, this drives tube material selection and may require expansion accommodation (floating head or U-tube).">Design Temperature</FieldLabel>
                                <input type="number" step="1" value={hxForm.tubeDesignTemp}
                                  onChange={hxFieldInput('tubeDesignTemp')} className={inputCls} placeholder="400" />
                              </div>
                              <div>
                                <FieldLabel unit="in" help="Additional tube wall thickness for corrosion. Because tubes have thin walls, corrosion allowance here is typically smaller than shell side — 0.0625″ is common. Severely corrosive tube-side services may warrant a different tube material instead.">Corrosion Allowance</FieldLabel>
                                <input type="number" min="0" step="0.0625" value={hxForm.tubeCorrosionAllowance}
                                  onChange={hxFieldInput('tubeCorrosionAllowance')} className={inputCls} placeholder="0.0625" />
                              </div>
                              <div>
                                <FieldLabel help="Brief description of the tube-side fluid. Corrosive, fouling, or hazardous tube-side fluids are common reasons to put them inside the tubes rather than on the shell side.">Fluid Service</FieldLabel>
                                <input type="text" value={hxForm.tubeFluid}
                                  onChange={hxFieldInput('tubeFluid')} className={inputCls} placeholder="e.g. Cooling water, naphtha…" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Nozzle Schedule */}
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Nozzle Schedule</p>
                        <div className="space-y-2">
                          {hxForm.nozzles.map((nozzle, i) => (
                            <NozzleCard
                              key={i}
                              nozzle={nozzle}
                              onUpdate={(key, value) => updateHxNozzle(i, key, value)}
                              onRemove={() => removeHxNozzle(i)}
                              locationOptions={getHxLocations()}
                              serviceOptions={HX_NOZZLE_SERVICES}
                            />
                          ))}
                          <button type="button" onClick={addHxNozzle}
                            className="w-full border-2 border-dashed border-slate-300 hover:border-blue-400 text-slate-500 hover:text-blue-600 rounded-xl py-3 text-sm font-medium transition-colors mt-1">
                            + Add Nozzle
                          </button>
                        </div>
                      </div>

                      {/* Notes */}
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Remarks / Special Requirements</p>
                        <textarea value={hxForm.notes} onChange={hxFieldInput('notes')} rows={3}
                          placeholder="PWHT, special NDE, surface preparation, ASME U-stamp, bundle pull clearance, nozzle orientation requirements, etc."
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y" />
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <button type="button" onClick={() => setHxStep(3)}
                          className="text-slate-500 hover:text-slate-700 text-sm transition-colors">← Back</button>
                        <button onClick={handleSubmit} disabled={submitting}
                          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium text-sm px-5 py-2.5 rounded-lg transition-colors">
                          {submitting ? 'Submitting…' : 'Submit RFQ'}
                        </button>
                      </div>
                    </div>
                  </StepCard>
                )}
              </>
            )}

            {/* Bottom actions */}
            <div className="flex items-center justify-between pb-6">
              <button type="button" onClick={() => navigate('/dashboard')}
                className="text-slate-500 hover:text-slate-700 text-sm transition-colors">
                ← Back to dashboard
              </button>
              {vesselType === 'tank' && (
                <button onClick={handleSubmit} disabled={submitting}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium text-sm px-5 py-2.5 rounded-lg transition-colors">
                  {submitting ? 'Submitting…' : 'Submit RFQ'}
                </button>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
