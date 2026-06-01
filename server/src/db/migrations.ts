import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Pool } from 'pg';
import { serverRoot } from '../config/env.js';

export async function runMigrations(pool: Pool): Promise<string[]> {
  const migrationsDir = resolve(serverRoot, 'src/db/migrations');
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const applied: string[] = [];
  for (const file of files) {
    const exists = await pool.query<{ id: string }>('SELECT id FROM schema_migrations WHERE id = $1', [file]);
    if (exists.rowCount) {
      continue;
    }

    const sql = readFileSync(resolve(migrationsDir, file), 'utf-8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [file]);
      await client.query('COMMIT');
      applied.push(file);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  return applied;
}
