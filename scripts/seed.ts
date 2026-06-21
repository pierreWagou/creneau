/**
 * Seed script for creneau-preview.
 *
 * Generates drizzle/seed.db with realistic test data.
 * Run: DATABASE_URL=file:./drizzle/seed.db npx tsx scripts/seed.ts
 *
 * Idempotent: uses onConflictDoNothing() throughout.
 */

import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createClient } from '@libsql/client';
import { hash } from '@node-rs/argon2';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { booking, flat, spot } from '../src/lib/server/db/schema.js';

// ---------------------------------------------------------------------------
// DB setup
// ---------------------------------------------------------------------------

const DB_PATH = process.env.DATABASE_URL ?? `file:${resolve('drizzle/seed.db')}`;

const fileMatch = DB_PATH.match(/^file:(.+)$/);
if (fileMatch) {
	mkdirSync(dirname(fileMatch[1]), { recursive: true });
}

const client = createClient({ url: DB_PATH });
client.execute('PRAGMA journal_mode = WAL');
client.execute('PRAGMA foreign_keys = ON');

const db = drizzle(client);

// Run all migrations so the schema is up to date
await migrate(db, { migrationsFolder: resolve('drizzle') });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns an ISO datetime string offset by `hours` from today at midnight. */
function dt(dayOffset: number, hour: number): string {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	d.setDate(d.getDate() + dayOffset);
	d.setHours(hour);
	return d.toISOString().replace(/\.\d{3}Z$/, '');
}

// ---------------------------------------------------------------------------
// Spot
// ---------------------------------------------------------------------------

console.log('Inserting spot…');
await db.insert(spot).values({ number: '36' }).onConflictDoNothing();

// ---------------------------------------------------------------------------
// Flats
// ---------------------------------------------------------------------------

console.log('Hashing PINs…');
const pinHash = await hash('1234');

const flats: (typeof flat.$inferInsert)[] = [
	// Admins
	{ number: 'A00', displayName: 'Gardien A', pinHash, isAdmin: true, isActive: true, activatedAt: dt(-60, 10) },
	{ number: 'B00', displayName: 'Gardien B', pinHash, isAdmin: true, isActive: true, activatedAt: dt(-60, 10) },
	// Active residents — staircase A
	{ number: 'A01', displayName: 'Dupont', pinHash, isAdmin: false, isActive: true, activatedAt: dt(-45, 9) },
	{ number: 'A02', displayName: 'Martin', pinHash, isAdmin: false, isActive: true, activatedAt: dt(-40, 11) },
	{ number: 'A03', displayName: 'Bernard', pinHash, isAdmin: false, isActive: true, activatedAt: dt(-30, 14) },
	{ number: 'A04', displayName: 'Petit', pinHash, isAdmin: false, isActive: true, activatedAt: dt(-20, 8) },
	// Active residents — staircase B
	{ number: 'B01', displayName: 'Durand', pinHash, isAdmin: false, isActive: true, activatedAt: dt(-35, 10) },
	{ number: 'B02', displayName: 'Leroy', pinHash, isAdmin: false, isActive: true, activatedAt: dt(-25, 16) },
	{ number: 'B03', displayName: 'Moreau', pinHash, isAdmin: false, isActive: true, activatedAt: dt(-15, 9) },
	// Inactive (no PIN, not activated)
	{ number: 'A05', displayName: null, pinHash: null, isAdmin: false, isActive: false },
	{ number: 'B05', displayName: null, pinHash: null, isAdmin: false, isActive: false }
];

console.log('Inserting flats…');
await db.insert(flat).values(flats).onConflictDoNothing();

// ---------------------------------------------------------------------------
// Bookings — spot 36, past 2 weeks + next 2 weeks
// ---------------------------------------------------------------------------

const bookings: (typeof booking.$inferInsert)[] = [
	// --- Past bookings ---
	{ spotNumber: '36', flatNumber: 'A01', startTime: dt(-13, 8), endTime: dt(-13, 18), note: 'Travaux peinture' },
	{ spotNumber: '36', flatNumber: 'B01', startTime: dt(-11, 9), endTime: dt(-11, 12) },
	{ spotNumber: '36', flatNumber: 'A02', startTime: dt(-9, 14), endTime: dt(-9, 20), note: 'Livraison meubles' },
	{ spotNumber: '36', flatNumber: 'B02', startTime: dt(-7, 8), endTime: dt(-7, 17) },
	{ spotNumber: '36', flatNumber: 'A03', startTime: dt(-5, 10), endTime: dt(-5, 14) },
	{ spotNumber: '36', flatNumber: 'A04', startTime: dt(-3, 7), endTime: dt(-3, 19), note: 'Déménagement' },
	{ spotNumber: '36', flatNumber: 'B03', startTime: dt(-1, 9), endTime: dt(-1, 11) },
	// --- Future bookings ---
	{ spotNumber: '36', flatNumber: 'A01', startTime: dt(1, 8), endTime: dt(1, 16) },
	{ spotNumber: '36', flatNumber: 'B02', startTime: dt(3, 10), endTime: dt(3, 18), note: 'Réception colis' },
	{ spotNumber: '36', flatNumber: 'A02', startTime: dt(5, 9), endTime: dt(5, 13) },
	{ spotNumber: '36', flatNumber: 'B01', startTime: dt(8, 8), endTime: dt(9, 20), note: 'Weekend bricolage' },
	{ spotNumber: '36', flatNumber: 'A03', startTime: dt(11, 14), endTime: dt(11, 24) },
	{ spotNumber: '36', flatNumber: 'B03', startTime: dt(13, 9), endTime: dt(13, 17) }
];

console.log('Inserting bookings…');
// Bookings have autoincrement IDs — no conflict possible; skip if table already populated
const existingCount = await db.$count(booking);
if (existingCount === 0) {
	await db.insert(booking).values(bookings);
} else {
	console.log(`  Skipping bookings — ${existingCount} already present.`);
}

console.log('Done. Seed DB ready at', DB_PATH.replace('file:', ''));
client.close();
