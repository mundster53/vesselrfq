export type HeadType = '2:1 Elliptical' | 'Hemispherical' | 'ASME F&D' | 'Torispherical' | 'Flat'

export type SupportType = 'saddles' | 'legs' | 'skirt' | 'lugs'

export type NozzleLocation = 'shell' | 'left_head' | 'right_head'

export type NozzleRating = '150' | '300' | '600' | '900' | '1500' | '2500'

export type FlangeType = 'WN' | 'SO' | 'SW' | 'BL' | 'LJ' | 'THD'

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

export interface NozzleRow {
  mark: string
  size: string
  rating: NozzleRating
  flangeType: FlangeType
  facing: FlangeFacing
  material: string
  service: string
  quantity: number
  location: NozzleLocation
  // Shell nozzles: degrees from 12 o'clock, counterclockwise viewed from right end.
  // null = auto-distribute evenly.
  shellAngle: number | null
  // Head nozzles: 'center' = on head axis, 'offset' = 30% off-center.
  headPos: 'center' | 'offset'
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
