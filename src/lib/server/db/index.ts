import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import { resolve } from 'path';

const DB_PATH = process.env.DATABASE_URL || `file:${resolve('data/creneau.db')}`;

const client = createClient({ url: DB_PATH });

// Enable WAL mode and foreign keys (fire-and-forget; these are idempotent)
client.execute('PRAGMA journal_mode = WAL');
client.execute('PRAGMA foreign_keys = ON');

export const db = drizzle(client, { schema });
