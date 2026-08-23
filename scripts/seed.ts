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
import {
	booking,
	flat,
	flatEmail,
	flatPhone,
	request,
	requestEmail,
	requestPhone,
	requestSpot,
	spot
} from '../src/lib/server/db/schema.js';
import { formatPhone } from '../src/lib/utils/phone.js';

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

// Disable FK checks during migration — migration 0012 rebuilds the flat table
// (DROP + recreate) which fails with FKs enabled
client.execute('PRAGMA foreign_keys = OFF');
await migrate(db, { migrationsFolder: resolve('drizzle') });
client.execute('PRAGMA foreign_keys = ON');

// Migration 0012 may partially fail on fresh DBs (Drizzle breakpoint issue).
// Ensure request junction tables exist as a fallback.
const ensureTable = async (sql: string) => {
	try {
		await client.execute(sql);
	} catch {
		// table already exists
	}
};
await ensureTable(
	'CREATE TABLE IF NOT EXISTS request_spot (request_id integer NOT NULL, spot_number text NOT NULL, PRIMARY KEY(request_id, spot_number), FOREIGN KEY (request_id) REFERENCES request(id) ON UPDATE no action ON DELETE cascade)'
);
await ensureTable(
	'CREATE TABLE IF NOT EXISTS request_email (request_id integer NOT NULL, email text NOT NULL, PRIMARY KEY(request_id, email), FOREIGN KEY (request_id) REFERENCES request(id) ON UPDATE no action ON DELETE cascade)'
);
await ensureTable(
	'CREATE TABLE IF NOT EXISTS request_phone (request_id integer NOT NULL, phone text NOT NULL, PRIMARY KEY(request_id, phone), FOREIGN KEY (request_id) REFERENCES request(id) ON UPDATE no action ON DELETE cascade)'
);
// Also ensure the flat table was rebuilt without reviewed_by/reviewed_at
const flatInfo = await client.execute("SELECT sql FROM sqlite_master WHERE name='flat' AND type='table'");
const flatSql = flatInfo.rows[0]?.sql as string | undefined;
if (flatSql && (flatSql.includes('reviewed_by') || flatSql.includes('reviewed_at'))) {
	await client.execute('PRAGMA foreign_keys = OFF');
	await client.execute(
		"CREATE TABLE IF NOT EXISTS __new_flat2 (number text PRIMARY KEY NOT NULL, status text DEFAULT 'inactive' NOT NULL, activation_code text, activation_code_expires_at text, display_name text, pin_hash text, is_admin integer DEFAULT false NOT NULL, activated_at text, created_at text DEFAULT (datetime('now')) NOT NULL)"
	);
	await client.execute(
		'INSERT OR IGNORE INTO __new_flat2 SELECT number, status, activation_code, activation_code_expires_at, display_name, pin_hash, is_admin, activated_at, created_at FROM flat'
	);
	await client.execute('DROP TABLE flat');
	await client.execute('ALTER TABLE __new_flat2 RENAME TO flat');
	await client.execute('PRAGMA foreign_keys = ON');
}

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
	{ number: 'A00', status: 'active', displayName: 'Gardien A', pinHash, isAdmin: true, activatedAt: dt(-60, 10) },
	{ number: 'B00', status: 'active', displayName: 'Gardien B', pinHash, isAdmin: true, activatedAt: dt(-60, 10) },
	// Active residents — staircase A
	{ number: 'A01', status: 'active', displayName: 'Dupont', pinHash, activatedAt: dt(-45, 9) },
	{ number: 'A02', status: 'active', displayName: 'Martin', pinHash, activatedAt: dt(-40, 11) },
	{ number: 'A03', status: 'active', displayName: 'Bernard', pinHash, activatedAt: dt(-30, 14) },
	{ number: 'A04', status: 'active', displayName: 'Petit', pinHash, activatedAt: dt(-20, 8) },
	// Active residents — staircase B
	{ number: 'B01', status: 'active', displayName: 'Durand', pinHash, activatedAt: dt(-35, 10) },
	{ number: 'B02', status: 'active', displayName: 'Leroy', pinHash, activatedAt: dt(-25, 16) },
	{ number: 'B03', status: 'active', displayName: 'Moreau', pinHash, activatedAt: dt(-15, 9) },
	// Inactive (no PIN, not activated)
	{ number: 'A05', status: 'inactive', displayName: null, pinHash: null },
	{ number: 'B05', status: 'inactive', displayName: null, pinHash: null }
];

console.log('Inserting flats…');
await db.insert(flat).values(flats).onConflictDoNothing();

// ---------------------------------------------------------------------------
// Contacts (flat_email + flat_phone)
// ---------------------------------------------------------------------------

console.log('Inserting contacts…');
const contacts: { flatNumber: string; email: string; phone: string }[] = [
	{ flatNumber: 'A00', email: 'gardien.a@example.com', phone: formatPhone('06 00 00 00 01') },
	{ flatNumber: 'B00', email: 'gardien.b@example.com', phone: formatPhone('06 00 00 00 02') },
	{ flatNumber: 'A01', email: 'dupont@example.com', phone: formatPhone('06 12 34 56 01') },
	{ flatNumber: 'A02', email: 'martin@example.com', phone: formatPhone('06 12 34 56 02') },
	{ flatNumber: 'A03', email: 'bernard@example.com', phone: formatPhone('06 12 34 56 03') },
	{ flatNumber: 'A04', email: 'petit@example.com', phone: formatPhone('06 12 34 56 04') },
	{ flatNumber: 'B01', email: 'durand@example.com', phone: formatPhone('06 12 34 56 05') },
	{ flatNumber: 'B02', email: 'leroy@example.com', phone: formatPhone('06 12 34 56 06') },
	{ flatNumber: 'B03', email: 'moreau@example.com', phone: formatPhone('06 12 34 56 07') },
	{ flatNumber: 'A05', email: 'a05@example.com', phone: formatPhone('06 12 34 56 08') },
	{ flatNumber: 'B05', email: 'b05@example.com', phone: formatPhone('06 12 34 56 09') }
];

await db
	.insert(flatEmail)
	.values(contacts.map((c) => ({ flatNumber: c.flatNumber, email: c.email })))
	.onConflictDoNothing();
await db
	.insert(flatPhone)
	.values(contacts.map((c) => ({ flatNumber: c.flatNumber, phone: c.phone })))
	.onConflictDoNothing();

// ---------------------------------------------------------------------------
// Bound spots — one per flat (inserted after flats to satisfy FK)
// ---------------------------------------------------------------------------

console.log('Inserting bound spots…');
const boundSpots: (typeof spot.$inferInsert)[] = [
	{ number: '01', flatNumber: 'A00' },
	{ number: '02', flatNumber: 'B00' },
	{ number: '03', flatNumber: 'A01' },
	{ number: '04', flatNumber: 'A02' },
	{ number: '05', flatNumber: 'A03' },
	{ number: '06', flatNumber: 'A04' },
	{ number: '07', flatNumber: 'B01' },
	{ number: '08', flatNumber: 'B02' },
	{ number: '09', flatNumber: 'B03' },
	{ number: '10', flatNumber: 'A05' },
	{ number: '11', flatNumber: 'B05' }
];
await db.insert(spot).values(boundSpots).onConflictDoNothing();

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

// ---------------------------------------------------------------------------
// Pending requests — one OK, one conflicting
// ---------------------------------------------------------------------------

console.log('Inserting pending requests…');
const existingRequests = await db.$count(request);
if (existingRequests === 0) {
	const reqRows = await db
		.insert(request)
		.values([
			{ flatNumber: 'A06', requesterName: 'Nouveau A', status: 'pending' },
			{ flatNumber: 'B06', requesterName: 'Nouveau B', status: 'pending' }
		])
		.returning();

	const [reqA06, reqB06] = reqRows;

	// Request A06 — spot 12 (new, no conflict)
	await db.insert(requestSpot).values([{ requestId: reqA06.id, spotNumber: '12' }]);
	await db.insert(requestEmail).values([{ requestId: reqA06.id, email: 'a06@example.com' }]);
	await db.insert(requestPhone).values([{ requestId: reqA06.id, phone: formatPhone('+33612345610') }]);

	// Request B06 — spot 03 (conflicts with A01)
	await db.insert(requestSpot).values([{ requestId: reqB06.id, spotNumber: '03' }]);
	await db.insert(requestEmail).values([{ requestId: reqB06.id, email: 'b06@example.com' }]);
	await db.insert(requestPhone).values([{ requestId: reqB06.id, phone: formatPhone('+33612345611') }]);
} else {
	console.log(`  Skipping requests — ${existingRequests} already present.`);
}

console.log('Done. Seed DB ready at', DB_PATH.replace('file:', ''));
client.close();
