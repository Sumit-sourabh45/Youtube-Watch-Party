import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Auto-detect whether SSL is needed from the connection string.
// Cloud providers like Neon, Supabase, etc. always require SSL.
const connString = process.env.DATABASE_URL || '';
const needsSSL =
  connString.includes('sslmode=require') ||
  connString.includes('.neon.tech') ||
  connString.includes('.supabase.') ||
  process.env.NODE_ENV === 'production';

// Single connection pool shared across the entire app.
// Pool manages multiple Postgres connections automatically.
const pool = new Pool({
  connectionString: connString,
  ssl: needsSSL ? { rejectUnauthorized: false } : false,
});

// Drizzle instance — import this wherever you need DB access
export const db = drizzle(pool, { schema });

export { pool };
