import { Pool } from 'pg';

let pool: Pool | null = null;

/**
 * Returns a singleton PostgreSQL connection pool.
 *
 * Environment variables used:
 * - PGHOST
 * - PGPORT
 * - PGDATABASE
 * - PGUSER
 * - PGPASSWORD
 *
 * This module is infrastructure-only.
 * No domain or application logic is allowed here.
 */
export function getPostgresPool(): Pool {
  if (pool) {
    return pool;
  }

  pool = new Pool({
    host: process.env.PGHOST,
    port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: process.env.PGSSLMODE === 'require'
      ? { rejectUnauthorized: false }
      : undefined,
  });

  return pool;
}
