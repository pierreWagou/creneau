import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createClient } from '@libsql/client';
import { lt } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { applyPendingMigrations } from './migrate';
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

/** Transaction handle (inferred) — helpers accept db or tx so endpoints can wrap writes */
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbOrTx = typeof db | DbTransaction;

// --- Migration ---
// Disable foreign keys so migration 0012's DROP TABLE flat works
await client.execute('PRAGMA foreign_keys = OFF');

const migrations = readMigrationFiles({ migrationsFolder: resolve('drizzle') });
await applyPendingMigrations(client, migrations);

// Re-enable foreign keys
await client.execute('PRAGMA foreign_keys = ON');

// Clean up expired sessions on startup
await db.delete(schema.session).where(lt(schema.session.expiresAt, new Date().toISOString()));
