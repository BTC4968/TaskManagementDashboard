import { Pool, type PoolClient } from 'pg';
import { env } from '../config/env.js';

export type DbClient = Pool | PoolClient;

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.databaseSsl ? { rejectUnauthorized: false } : undefined,
  max: env.databasePoolMax,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
});

export async function closePool(): Promise<void> {
  await pool.end();
}
