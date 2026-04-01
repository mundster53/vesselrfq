export type HeadType = '2:1 Elliptical' | 'Hemispherical' | 'ASME F&D' | 'Torispherical' | 'Flat'

export type SupportType = 'saddles' | 'legs' | 'skirt' | 'lugs'

export type NozzleLocation = 'shell' | 'left_head' | 'right_head'

export type NozzleRating = '150' | '300' | '600' | '900' | '1500' | '2500'

export type FlangeType =
  | 'RFWN' | 'RFSO' | 'RFSW' | 'RFTH'
  | 'FFWN' | 'FFSO'
  | 'RJWN'
  | 'LJWN' | 'LJFSE'
  | 'BFSO' | 'BF'
  | 'TC'

export type FlangeFacing = 'RF' | 'FF' | 'RTJ'

export type ShellMaterial =
  | 'SA-516-70'
  | 'SA-516-60'
  | 'SA-240-304'
  | 'SA-240-316'
  | 'SA-240-316L'
  | 'SA-285-C'

export type NozzleMaterial =
  | 'SA-106-B'
  | 'SA-105'
  | 'SA-312-TP304'
  | 'SA-312-TP316'
  | 'SA-182-F304'
  | 'SA-182-F316'

export type NozzleType = 'standard' | 'sight_glass' | 'manway'

export interface NozzleRow {
  mark: string
  service: string
  nozzleType: NozzleType
  size: string
  rating: NozzleRating
  projection: number
  flangeType: FlangeType
  facing: FlangeFacing
  material: string       // predefined value or NOZZLE_MATERIAL_SENTINEL
  materialCustom: string // custom text when material === NOZZLE_MATERIAL_SENTINEL
  location: NozzleLocation
  quantity: number
  // Shell nozzles: degrees from 12 o'clock, counterclockwise viewed from right end.
  // null = auto-distribute evenly.
  shellAngle: number | null
  // Head nozzles: 'center' = on head axis, 'offset' = 30% off-center.
  headPos: 'center' | 'offset'
  // Manway sub-options (only when nozzleType === 'manway')
  manwaySize?: string
  manwayCoverType?: string
  manwayCoverHandling?: string
}

export type Orientation = 'horizontal' | 'vertical'

export interface VesselDesignState {
  orientation: Orientation
  title: string
  shellOd: string
  shellLength: string
  shellMaterial: string  // ShellMaterial or any custom string
  headType: HeadType | ''
  mawp: string
  designTemp: string
  corrosionAllowance: string
  supportType: SupportType | ''
  saddleHeight: string
  saddleWidth: string
  nozzles: NozzleRow[]
  notes: string
  // Vertical vessel accessories (only when orientation === 'vertical')
  ladderCaged?: boolean
  platforms?: boolean
  platformCount?: string
  platformCoverage?: string
  handrails?: boolean
}

export type RfqStatus = 'draft' | 'submitted' | 'quoted' | 'awarded'

export interface RfqSummary {
  id: number
  title: string
  status: RfqStatus
  shellOd: string | null
  shellLength: string | null
  shellMaterial: string | null
  headType: string | null
  mawp: string | null
  designTemp: number | null
  createdAt: string
  nozzleCount: number
}

// ── Heat Exchanger types ──────────────────────────────────────────────────────

export type VesselType = 'tank' | 'heat_exchanger'

export type TemaFrontHead = 'A' | 'B' | 'C' | 'N' | 'D'
export type TemaShell     = 'E' | 'F' | 'G' | 'H' | 'J' | 'K' | 'X'
export type TemaRearHead  = 'L' | 'M' | 'N' | 'P' | 'S' | 'T' | 'U' | 'W'

export type TubeOd     = '3/4' | '1' | '1-1/4' | '1-1/2' | '2'
export type TubeBwg    = '10' | '11' | '12' | '13' | '14' | '15' | '16' | '17' | '18'
export type TubeLength = '6' | '8' | '10' | '12' | '16' | '20'
export type TubeLayout = '30' | '60' | '90' | '45'
export type TubeJoint  = 'expanded' | 'seal_welded' | 'strength_welded'
export type BaffleType =
  | 'single_segmental'
  | 'double_segmental'
  | 'triple_segmental'
  | 'disc_donut'
  | 'rod'
  | 'ntiw'

export interface HxDesignState {
  title: string
  orientation: Orientation

  temaFront: TemaFrontHead | ''
  temaShell: TemaShell | ''
  temaRear:  TemaRearHead | ''

  shellOd:           string
  shellLength:       string
  shellMaterial:     string
  shellsInSeries:    string
  shellsInParallel:  string

  tubeCount:    string
  tubeOd:       TubeOd | ''
  tubeBwg:      TubeBwg | ''
  tubeLength:   TubeLength | ''
  tubeMaterial: string
  tubeLayout:   TubeLayout | ''
  tubePitch:    string
  tubeJoint:    TubeJoint | ''
  tubePasses:   string

  baffleType:       BaffleType | ''
  baffleCut:        string
  baffleSpacing:    string
  impingementPlate: 'yes' | 'no'

  shellMawp:               string
  shellDesignTemp:          string
  shellCorrosionAllowance:  string
  shellFluid:               string

  tubeMawp:               string
  tubeDesignTemp:          string
  tubeCorrosionAllowance:  string
  tubeFluid:               string

  nozzles: NozzleRow[]
  notes:   string
}
