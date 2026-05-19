import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

const DB_PATH = process.env.DATABASE_URL || `file:${resolve('data/creneau.db')}`;

// Ensure the directory exists for local file databases
const fileMatch = DB_PATH.match(/^file:(.+)$/);
if (fileMatch) {
	mkdirSync(dirname(fileMatch[1]), { recursive: true });
}

const client = createClient({ url: DB_PATH });

// Enable WAL mode and foreign keys (fire-and-forget; these are idempotent)
client.execute('PRAGMA journal_mode = WAL');
client.execute('PRAGMA foreign_keys = ON');

export const db = drizzle(client, { schema });
