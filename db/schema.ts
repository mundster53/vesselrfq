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

  // Shell
  shellOd: numeric('shell_od'),
  shellLength: numeric('shell_length'),
  shellMaterial: text('shell_material'),

  // Heads
  headType: text('head_type'),

  // Design conditions
  mawp: numeric('mawp'),
  designTemp: integer('design_temp'),
  corrosionAllowance: numeric('corrosion_allowance'),

  // Supports
  supportType: text('support_type'),
  saddleHeight: numeric('saddle_height'),
  saddleWidth: numeric('saddle_width'),

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
