import { mkdirSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createClient } from '@libsql/client';
import { readMigrationFiles } from 'drizzle-orm/migrator';

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

// Create migrations table
await client.execute(`
	CREATE TABLE IF NOT EXISTS __drizzle_migrations (
		id SERIAL PRIMARY KEY,
		hash text NOT NULL,
		created_at numeric
	)
`);

// Read and apply migrations
const migrations = readMigrationFiles({ migrationsFolder: resolve('drizzle') });

for (const migration of migrations) {
	for (const sqlChunk of migration.sql) {
		// Split multi-statement SQL by semicolons
		const stmts = sqlChunk
			.split(';')
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
		for (const stmt of stmts) {
			try {
				await client.execute(stmt);
			} catch (e: any) {
				// Ignore errors on re-runs (IF NOT EXISTS / DROP IF EXISTS handle idempotency)
				if (!e.message.includes('already exists') && !e.message.includes('no such table')) {
					console.error(`Migration ${migration.hash.substring(0, 8)} failed: ${e.message}`);
					console.error(`SQL: ${stmt.substring(0, 120)}`);
				}
			}
		}
	}
	// Record migration as applied
	await client.execute({
		sql: 'INSERT OR IGNORE INTO __drizzle_migrations ("hash", "created_at") VALUES (?, ?)',
		args: [migration.hash, migration.folderMillis]
	});
}

await client.execute('PRAGMA foreign_keys = ON');

const result = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
console.log('Test DB created with tables:', result.rows.map((r) => r.name).join(', '));
