// packages/server/src/db/PostgresClient.ts
// Canonical PostgreSQL client — SINGLE SOURCE OF TRUTH

import { Pool } from 'pg';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Postgres configuration error: missing env variables (${name})`
    );
  }
  return value;
}

let pool: Pool | null = null;

export function getPostgresPool(): Pool {
  if (pool) return pool;

  pool = new Pool({
    host: requireEnv('POSTGRES_HOST'),
    port: Number(requireEnv('POSTGRES_PORT')),
    database: requireEnv('POSTGRES_DB'),
    user: requireEnv('POSTGRES_USER'),
    password: requireEnv('POSTGRES_PASSWORD'),
    ssl: false,
  });

  return pool;
}
