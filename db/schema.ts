import { pgTable, serial, text, timestamp, integer, numeric, boolean, unique } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['buyer', 'fabricator'] }).notNull().default('buyer'),
  active: boolean('active').notNull().default(true),
  stripeCustomerId: text('stripe_customer_id'),
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
  temaFront: text('tema_front_head'),
  temaShell: text('tema_shell'),
  temaRear:  text('tema_rear_head'),

  // HX — shell configuration
  orientation:       text('hx_orientation'),
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
  shellMawp:              numeric('shell_side_pressure'),
  shellDesignTemp:        integer('shell_side_temp'),
  shellCorrosionAllowance: numeric('shell_side_ca'),
  shellFluid:             text('shell_side_fluid'),

  // HX — tube side design conditions
  tubeMawp:              numeric('tube_side_pressure'),
  tubeDesignTemp:        integer('tube_side_temp'),
  tubeCorrosionAllowance: numeric('tube_side_ca'),
  tubeFluid:             text('tube_side_fluid'),

  fabricatorId: text('fabricator_id'),

  // Painting & surface prep
  surfacePrep:         text('surface_prep'),
  primer:              text('primer'),
  topcoat:             text('topcoat'),
  finishType:          text('finish_type'),

  // Insulation
  insulated:           boolean('insulated'),
  insulationType:      text('insulation_type'),
  insulationThickness: text('insulation_thickness'),
  insulationJacket:    text('insulation_jacket'),
  insulationShell:     boolean('insulation_shell'),
  insulationHeads:     boolean('insulation_heads'),

  // Coils
  internalCoil:         boolean('internal_coil'),
  internalCoilPipeSize: text('internal_coil_pipe_size'),
  internalCoilTurns:    integer('internal_coil_turns'),
  externalCoil:         boolean('external_coil'),
  externalCoilType:     text('external_coil_type'),
  externalCoilPipeSize: text('external_coil_pipe_size'),
  externalCoilCoverage: text('external_coil_coverage'),

  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const fabricatorProfiles = pgTable('fabricator_profiles', {
  id:          serial('id').primaryKey(),
  userId:      integer('user_id').references(() => users.id).notNull(),
  shopName:    text('shop_name').notNull(),
  city:        text('city').notNull(),
  state:       text('state').notNull(),
  stamps:      text('stamps').array().notNull(),
  contactName: text('contact_name').notNull(),
  phone:       text('phone').notNull(),
  website:     text('website'),
  rfqEmail:    text('rfq_email'),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
}, (t) => [unique().on(t.userId)])

export const buyerProfiles = pgTable('buyer_profiles', {
  id:          serial('id').primaryKey(),
  userId:      integer('user_id').references(() => users.id).notNull(),
  firstName:   text('first_name').notNull(),
  lastName:    text('last_name').notNull(),
  email:       text('email').notNull(),
  companyName: text('company_name').notNull(),
  jobTitle:    text('job_title').notNull(),
  phone:       text('phone').notNull(),
  city:        text('city').notNull(),
  state:       text('state').notNull(),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
}, (t) => [unique().on(t.userId)])

export const nozzles = pgTable('nozzles', {
  id: serial('id').primaryKey(),
  rfqId: integer('rfq_id').references(() => rfqs.id, { onDelete: 'cascade' }).notNull(),
  mark: text('mark').notNull(),
  size: text('size').notNull(),
  rating: text('rating'),
  flangeType: text('flange_type'),
  facing: text('facing'),
  material: text('material'),
  service: text('service'),
  quantity: integer('quantity').default(1).notNull(),
  location: text('location', { enum: ['shell', 'left_head', 'right_head'] }).notNull(),
})
