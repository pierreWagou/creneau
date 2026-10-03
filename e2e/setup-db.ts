import { mkdirSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createClient } from '@libsql/client';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { applyPendingMigrations } from '../src/lib/server/db/migrate';

const dbPath = resolve('data/test.db');

// Delete any existing test DB
for (const ext of ['', '-wal', '-shm']) {
	try {
		unlinkSync(dbPath + ext);
	} catch {}
}

mkdirSync(dirname(dbPath), { recursive: true });

const client = createClient({ url: `file:${dbPath}` });

// Disable foreign keys so migration 0012's DROP TABLE flat works
await client.execute('PRAGMA foreign_keys = OFF');
await client.execute('PRAGMA journal_mode = WAL');

// Read and apply migrations (shared runner — see src/lib/server/db/migrate.ts)
const migrations = readMigrationFiles({ migrationsFolder: resolve('drizzle') });
await applyPendingMigrations(client, migrations);

await client.execute('PRAGMA foreign_keys = ON');

const result = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
console.log('Test DB created with tables:', result.rows.map((r) => r.name).join(', '));
