import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', async () => {
	const { createClient } = await import('@libsql/client');
	const { drizzle } = await import('drizzle-orm/libsql');
	const client = createClient({ url: ':memory:' });
	(globalThis as unknown as Record<string, unknown>).__icsTestClient = client;
	return { db: drizzle(client) };
});

type MemClient = { execute: (sql: string) => Promise<unknown> };
function memDb(): MemClient {
	return (globalThis as unknown as Record<string, MemClient>).__icsTestClient;
}

function localsFor(flat: { number: string; isAdmin: boolean } | null) {
	return { flat } as unknown as App.Locals;
}

describe('GET /api/bookings/:id/ics', () => {
	beforeAll(async () => {
		await import('$lib/server/db');
		await memDb().execute('CREATE TABLE flat (number text PRIMARY KEY, status text, display_name text)');
		await memDb().execute(
			'CREATE TABLE spot (number text PRIMARY KEY, flat_number text, status text NOT NULL, description text, created_at text)'
		);
		await memDb().execute(`
			CREATE TABLE booking (
				id integer PRIMARY KEY AUTOINCREMENT,
				spot_number text,
				flat_number text,
				start_time text NOT NULL,
				end_time text NOT NULL,
				note text,
				created_at text,
				status text NOT NULL DEFAULT 'active'
			)
		`);
	});

	beforeEach(async () => {
		await memDb().execute('DELETE FROM booking');
		await memDb().execute("DELETE FROM sqlite_sequence WHERE name = 'booking'");
		await memDb().execute('DELETE FROM spot');
		await memDb().execute('DELETE FROM flat');
		await memDb().execute("INSERT INTO flat (number, status, display_name) VALUES ('A01', 'active', 'A')");
		await memDb().execute("INSERT INTO flat (number, status, display_name) VALUES ('B12', 'active', 'B')");
		await memDb().execute("INSERT INTO spot (number, flat_number, status) VALUES ('36', NULL, 'shared')");
		await memDb().execute(
			"INSERT INTO booking (spot_number, flat_number, start_time, end_time) VALUES ('36', 'A01', '2099-06-10T10:00:00', '2099-06-10T12:00:00')"
		);
	});

	it('401s without a session', async () => {
		const { GET } = await import('../../routes/api/bookings/[id]/ics/+server');
		const res = await GET({ params: { id: '1' }, locals: localsFor(null) } as never);
		expect(res.status).toBe(401);
	});

	it('400s on non-numeric ids and 404s on unknown bookings', async () => {
		const { GET } = await import('../../routes/api/bookings/[id]/ics/+server');
		const owner = localsFor({ number: 'A01', isAdmin: false });
		expect((await GET({ params: { id: 'nope' }, locals: owner } as never)).status).toBe(400);
		expect((await GET({ params: { id: '999' }, locals: owner } as never)).status).toBe(404);
	});

	it('403s for other flats without admin rights', async () => {
		const { GET } = await import('../../routes/api/bookings/[id]/ics/+server');
		const res = await GET({ params: { id: '1' }, locals: localsFor({ number: 'B12', isAdmin: false }) } as never);
		expect(res.status).toBe(403);
	});

	it('serves the calendar file to the owner and to admins', async () => {
		const { GET } = await import('../../routes/api/bookings/[id]/ics/+server');
		for (const locals of [localsFor({ number: 'A01', isAdmin: false }), localsFor({ number: 'B12', isAdmin: true })]) {
			const res = await GET({ params: { id: '1' }, locals } as never);
			expect(res.status).toBe(200);
			expect(res.headers.get('Content-Type')).toContain('text/calendar');
			expect(res.headers.get('Content-Disposition')).toContain('reservation-1.ics');
			const body = await res.text();
			expect(body).toContain('UID:booking-1@creneau');
			expect(body).toContain('DTSTART:20990610T100000');
		}
	});
});
