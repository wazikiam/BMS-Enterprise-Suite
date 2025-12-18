// packages/server/src/db/PostgresClient.ts
// CANONICAL POSTGRES CLIENT
//
// - Infrastructure-only
// - Loads environment variables deterministically
// - OVERRIDES host environment for tests
// - Shared singleton pool

import dotenv from 'dotenv';
import { Pool } from 'pg';

// Load environment variables BEFORE pool creation
// IMPORTANT: override=true so Windows env vars do NOT win
dotenv.config({ path: '.env.test', override: true });
dotenv.config({ path: '.env', override: false });

let pool: Pool | null = null;

/**
 * Returns a singleton PostgreSQL connection pool.
 */
export function getPostgresPool(): Pool {
  if (pool) return pool;

  const {
    PGHOST,
    PGPORT,
    PGDATABASE,
    PGUSER,
    PGPASSWORD,
    PGSSLMODE,
  } = process.env;

  if (!PGHOST || !PGDATABASE || !PGUSER || !PGPASSWORD) {
    throw new Error('Postgres configuration error: missing env variables');
  }

  pool = new Pool({
    host: PGHOST,
    port: PGPORT ? Number(PGPORT) : 5432,
    database: PGDATABASE,
    user: PGUSER,
    password: PGPASSWORD,
    ssl:
      PGSSLMODE === 'require'
        ? { rejectUnauthorized: false }
        : false,
  });

  return pool;
}
