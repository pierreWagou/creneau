import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createClient } from '@libsql/client';
import { lt } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import * as schema from './schema';

const DB_PATH = process.env.DATABASE_URL || `file:${resolve('data/creneau.db')}`;

// Ensure the directory exists for local file databases
const fileMatch = DB_PATH.match(/^file:(.+)$/);
if (fileMatch) {
	mkdirSync(dirname(fileMatch[1]), { recursive: true });
}

const client = createClient({ url: DB_PATH });

// Enable WAL mode (idempotent)
await client.execute('PRAGMA journal_mode = WAL');

export const db = drizzle(client, { schema });

// --- Migration ---
// Disable foreign keys so migration 0012's DROP TABLE flat works
await client.execute('PRAGMA foreign_keys = OFF');

// Create migrations table if not exists
await client.execute(`
	CREATE TABLE IF NOT EXISTS __drizzle_migrations (
		id SERIAL PRIMARY KEY,
		hash text NOT NULL,
		created_at numeric
	)
`);

// Get applied migration hashes
const applied = await client.execute('SELECT hash FROM __drizzle_migrations');
const appliedHashes = new Set(applied.rows.map((r) => r.hash));

// Read and apply pending migrations
const migrations = readMigrationFiles({ migrationsFolder: resolve('drizzle') });
for (const migration of migrations) {
	if (!appliedHashes.has(migration.hash)) {
		for (const sqlChunk of migration.sql) {
			const stmts = sqlChunk
				.split(';')
				.map((s) => s.trim())
				.filter((s) => s.length > 0);
			for (const stmt of stmts) {
				try {
					await client.execute(stmt);
				} catch (e: any) {
					// Ignore idempotent errors (IF NOT EXISTS, DROP IF EXISTS)
					if (!e.message.includes('already exists') && !e.message.includes('no such table')) {
						console.error(`[db/migrate] ${e.message}`);
					}
				}
			}
		}
		await client.execute({
			sql: 'INSERT OR IGNORE INTO __drizzle_migrations ("hash", "created_at") VALUES (?, ?)',
			args: [migration.hash, migration.folderMillis]
		});
	}
}

// Re-enable foreign keys
await client.execute('PRAGMA foreign_keys = ON');

// Clean up expired sessions on startup
await db.delete(schema.session).where(lt(schema.session.expiresAt, new Date().toISOString()));
