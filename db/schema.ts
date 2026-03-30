import { pgTable, serial, text, timestamp, integer, numeric } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['buyer', 'fabricator'] }).notNull().default('buyer'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const rfqs = pgTable('rfqs', {
  id: serial('id').primaryKey(),
  buyerId: integer('buyer_id').references(() => users.id).notNull(),
  title: text('title').notNull(),
  status: text('status', { enum: ['draft', 'submitted', 'quoted', 'awarded'] }).default('draft').notNull(),

  // Vessel type: 'tank' | 'heat_exchanger'
  vesselType: text('vessel_type'),

  // Shell (shared by tank and HX)
  shellOd: numeric('shell_od'),
  shellLength: numeric('shell_length'),
  shellMaterial: text('shell_material'),

  // Tank — heads & design conditions
  headType: text('head_type'),
  mawp: numeric('mawp'),
  designTemp: integer('design_temp'),
  corrosionAllowance: numeric('corrosion_allowance'),

  // Tank — supports
  supportType: text('support_type'),
  saddleHeight: numeric('saddle_height'),
  saddleWidth: numeric('saddle_width'),

  // HX — TEMA designation
  temaFront: text('tema_front'),
  temaShell: text('tema_shell'),
  temaRear:  text('tema_rear'),

  // HX — shell configuration
  orientation:       text('orientation'),
  shellsInSeries:    integer('shells_in_series'),
  shellsInParallel:  integer('shells_in_parallel'),

  // HX — tube bundle
  tubeCount:    integer('tube_count'),
  tubeOd:       text('tube_od'),
  tubeBwg:      text('tube_bwg'),
  tubeLength:   text('tube_length'),
  tubeMaterial: text('tube_material'),
  tubeLayout:   text('tube_layout'),
  tubePitch:    numeric('tube_pitch'),
  tubeJoint:    text('tube_joint'),

  // HX — baffles
  baffleType:       text('baffle_type'),
  baffleCut:        numeric('baffle_cut'),
  baffleSpacing:    numeric('baffle_spacing'),
  impingementPlate: text('impingement_plate'),

  // HX — shell side design conditions
  shellMawp:              numeric('shell_mawp'),
  shellDesignTemp:        integer('shell_design_temp'),
  shellCorrosionAllowance: numeric('shell_corrosion_allowance'),
  shellFluid:             text('shell_fluid'),

  // HX — tube side design conditions
  tubeMawp:              numeric('tube_mawp'),
  tubeDesignTemp:        integer('tube_design_temp'),
  tubeCorrosionAllowance: numeric('tube_corrosion_allowance'),
  tubeFluid:             text('tube_fluid'),

  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const nozzles = pgTable('nozzles', {
  id: serial('id').primaryKey(),
  rfqId: integer('rfq_id').references(() => rfqs.id, { onDelete: 'cascade' }).notNull(),
  mark: text('mark').notNull(),
  size: text('size').notNull(),
  rating: text('rating').notNull(),
  flangeType: text('flange_type').notNull(),
  facing: text('facing').notNull(),
  material: text('material').notNull(),
  service: text('service'),
  quantity: integer('quantity').default(1).notNull(),
  location: text('location', { enum: ['shell', 'left_head', 'right_head'] }).notNull(),
})
