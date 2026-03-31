import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema.js'

const client = postgres(process.env.DATABASE_URL!, {
  max: 1,          // one connection per serverless function instance
  prepare: false,  // required for Supabase PgBouncer transaction pooler
})

export const db = drizzle(client, { schema })
