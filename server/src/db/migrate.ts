import { closePool, pool } from './pool.js';
import { runMigrations } from './migrations.js';

try {
  const applied = await runMigrations(pool);
  if (applied.length) {
    console.log(`Applied migrations: ${applied.join(', ')}`);
  } else {
    console.log('Database already up to date.');
  }
} finally {
  await closePool();
}
