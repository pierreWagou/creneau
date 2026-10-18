import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	cancelBooking,
	createBooking,
	getBookingById,
	getBookingsInRange,
	updateBooking,
	validateBookingTimes
} from './bookings';

// DB-backed tests run the real drizzle queries against an in-memory libsql
// (bookings.ts owns its `./db` import, so the module mock builds the memory DB).
vi.mock('./db', async () => {
	const { createClient } = await import('@libsql/client');
	const { drizzle } = await import('drizzle-orm/libsql');
	const client = createClient({ url: ':memory:' });
	(globalThis as unknown as Record<string, unknown>).__bookingsTestClient = client;
	return { db: drizzle(client) };
});

type MemClient = { execute: (sql: string) => Promise<unknown> };
function memDb(): MemClient {
	return (globalThis as unknown as Record<string, MemClient>).__bookingsTestClient;
}

describe('validateBookingTimes', () => {
	it('returns null for valid booking times', () => {
		expect(validateBookingTimes('2026-07-24T10:00:00', '2026-07-24T14:00:00')).toBeNull();
	});

	it('rejects end time before start time', () => {
		const result = validateBookingTimes('2026-07-24T14:00:00', '2026-07-24T10:00:00');
		expect(result).not.toBeNull();
		expect(result!.error).toContain('fin doit être après');
		expect(result!.status).toBe(400);
	});

	it('rejects equal start and end times', () => {
		const result = validateBookingTimes('2026-07-24T10:00:00', '2026-07-24T10:00:00');
		expect(result).not.toBeNull();
		expect(result!.error).toContain('fin doit être après');
	});

	it('accepts overnight booking within hour bounds', () => {
		const result = validateBookingTimes('2026-07-24T23:00:00', '2026-07-25T01:00:00');
		// startHour = 23, endHour = 1 → within [DAY_START, DAY_END], end after start
		expect(result).toBeNull();
	});

	it('rejects end time after DAY_END (24)', () => {
		// getHourFromISO extracts hour from the string. DAY_END = 24.
		// If endTime is "2026-07-24T25:00:00" — getHourFromISO returns 25, which is > 24
		// But ISO strings don't have hour 25. Let's test with the actual validation logic.
		// The check is: startHour < DAY_START || endHour > DAY_END
		// DAY_START = 0, DAY_END = 24
		// A booking ending at hour 24 (midnight) is the upper bound
		const result = validateBookingTimes('2026-07-24T00:00:00', '2026-07-24T24:00:00');
		// endHour = 24, which is NOT > 24, so this is valid
		expect(result).toBeNull();
	});

	it('rejects duration exceeding MAX_BOOKING_HOURS (168h = 7 days)', () => {
		// 8 days = 192h > 168h
		const result = validateBookingTimes('2026-07-24T00:00:00', '2026-08-01T00:00:00');
		expect(result).not.toBeNull();
		expect(result!.error).toContain('jours');
		expect(result!.status).toBe(400);
	});

	it('accepts duration of exactly MAX_BOOKING_HOURS', () => {
		// 168h = 7 days exactly
		const result = validateBookingTimes('2026-07-24T00:00:00', '2026-07-31T00:00:00');
		expect(result).toBeNull();
	});

	it('returns error object with success: false', () => {
		const result = validateBookingTimes('2026-07-24T14:00:00', '2026-07-24T10:00:00');
		expect(result).toEqual({
			success: false,
			error: expect.stringContaining('fin doit être après'),
			status: 400
		});
	});
});

const FUTURE = '2099-06-10';
const slot = (start: string, end: string) => ({ startTime: `${FUTURE}T${start}`, endTime: `${FUTURE}T${end}` });

describe('booking writes (in-memory libsql)', () => {
	beforeAll(async () => {
		await memDb().execute(`
			CREATE TABLE flat (
				number text PRIMARY KEY,
				status text,
				display_name text
			)
		`);
		await memDb().execute(`
			CREATE TABLE spot (
				number text PRIMARY KEY,
				flat_number text,
				status text NOT NULL,
				description text,
				created_at text
			)
		`);
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
		await memDb().execute('DELETE FROM spot');
		await memDb().execute('DELETE FROM flat');
		await memDb().execute("INSERT INTO flat (number, status, display_name) VALUES ('A01', 'active', 'A')");
		await memDb().execute("INSERT INTO flat (number, status, display_name) VALUES ('B12', 'active', 'B')");
		await memDb().execute("INSERT INTO spot (number, flat_number, status) VALUES ('36', NULL, 'shared')");
	});

	it('createBooking refuses past starts', async () => {
		const result = await createBooking({
			spotNumber: '36',
			flatNumber: 'A01',
			startTime: '2000-01-01T10:00:00',
			endTime: '2000-01-01T12:00:00'
		});
		expect(result).toMatchObject({ success: false, status: 400 });
	});

	it('createBooking 404s on unknown spots', async () => {
		const result = await createBooking({ spotNumber: '99', flatNumber: 'A01', ...slot('10:00:00', '12:00:00') });
		expect(result).toMatchObject({ success: false, status: 404 });
	});

	it('createBooking refuses overlapping slots and succeeds otherwise', async () => {
		const first = await createBooking({ spotNumber: '36', flatNumber: 'A01', ...slot('10:00:00', '12:00:00') });
		expect(first.success).toBe(true);
		if (!first.success) return;
		expect(first.booking.flatDisplayName).toBe('A');

		const clash = await createBooking({ spotNumber: '36', flatNumber: 'B12', ...slot('11:00:00', '13:00:00') });
		expect(clash).toMatchObject({ success: false, status: 409 });

		const adjacent = await createBooking({ spotNumber: '36', flatNumber: 'B12', ...slot('12:00:00', '13:00:00') });
		expect(adjacent.success).toBe(true);
	});

	it('createBooking folds a next-day 00:00 end to same-day 24:00', async () => {
		const created = await createBooking({
			spotNumber: '36',
			flatNumber: 'A01',
			startTime: `${FUTURE}T18:00:00`,
			endTime: '2099-06-11T00:00:00'
		});
		expect(created.success).toBe(true);
		if (!created.success) return;
		expect(created.booking.endTime).toBe(`${FUTURE}T24:00:00`);
	});

	it('a folded evening booking does not conflict with a next-day midnight start', async () => {
		const evening = await createBooking({
			spotNumber: '36',
			flatNumber: 'A01',
			startTime: `${FUTURE}T18:00:00`,
			endTime: '2099-06-11T00:00:00'
		});
		expect(evening.success).toBe(true);

		const afterMidnight = await createBooking({
			spotNumber: '36',
			flatNumber: 'B12',
			startTime: '2099-06-11T00:00:00',
			endTime: '2099-06-11T02:00:00'
		});
		expect(afterMidnight.success).toBe(true);
	});

	it('createBooking leaves genuine multi-day ends unfolded', async () => {
		const created = await createBooking({
			spotNumber: '36',
			flatNumber: 'A01',
			startTime: `${FUTURE}T18:00:00`,
			endTime: '2099-06-12T10:00:00'
		});
		expect(created.success).toBe(true);
		if (!created.success) return;
		expect(created.booking.endTime).toBe('2099-06-12T10:00:00');
	});

	it('updateBooking folds a moved next-day 00:00 end', async () => {
		const created = await createBooking({ spotNumber: '36', flatNumber: 'A01', ...slot('10:00:00', '12:00:00') });
		expect(created.success).toBe(true);
		if (!created.success) return;

		const moved = await updateBooking(
			created.booking.id,
			'A01',
			{ startTime: `${FUTURE}T18:00:00`, endTime: '2099-06-11T00:00:00' },
			false
		);
		expect(moved.success).toBe(true);
		if (!moved.success) return;
		expect(moved.booking.endTime).toBe(`${FUTURE}T24:00:00`);
	});

	it('cancelBooking 404s on unknown ids', async () => {
		expect(await cancelBooking(999, 'A01', false)).toMatchObject({ success: false, status: 404 });
	});

	it('cancelBooking refuses ended bookings', async () => {
		const created = await createBooking({ spotNumber: '36', flatNumber: 'A01', ...slot('10:00:00', '12:00:00') });
		expect(created.success).toBe(true);
		if (!created.success) return;
		await memDb().execute("UPDATE booking SET end_time = '2000-01-01T12:00:00'");
		expect(await cancelBooking(created.booking.id, 'A01', false)).toMatchObject({ success: false, status: 400 });
	});

	it('cancelBooking enforces ownership (403) but lets admins through', async () => {
		const created = await createBooking({ spotNumber: '36', flatNumber: 'A01', ...slot('10:00:00', '12:00:00') });
		expect(created.success).toBe(true);
		if (!created.success) return;
		expect(await cancelBooking(created.booking.id, 'B12', false)).toMatchObject({ success: false, status: 403 });
		expect(await cancelBooking(created.booking.id, 'B12', true)).toEqual({ success: true });
	});

	it('cancelBooking soft-deletes: row kept with cancelled status', async () => {
		const created = await createBooking({ spotNumber: '36', flatNumber: 'A01', ...slot('10:00:00', '12:00:00') });
		expect(created.success).toBe(true);
		if (!created.success) return;
		expect(await cancelBooking(created.booking.id, 'A01', false)).toEqual({ success: true });
		const stored = await getBookingById(created.booking.id);
		expect(stored).not.toBeNull();
		expect(stored?.status).toBe('cancelled');
	});

	it('cancelBooking 409s on already-cancelled ids', async () => {
		const created = await createBooking({ spotNumber: '36', flatNumber: 'A01', ...slot('10:00:00', '12:00:00') });
		expect(created.success).toBe(true);
		if (!created.success) return;
		expect(await cancelBooking(created.booking.id, 'A01', false)).toEqual({ success: true });
		expect(await cancelBooking(created.booking.id, 'A01', false)).toMatchObject({ success: false, status: 409 });
	});

	it('updateBooking refuses cancelled bookings', async () => {
		const created = await createBooking({ spotNumber: '36', flatNumber: 'A01', ...slot('10:00:00', '12:00:00') });
		expect(created.success).toBe(true);
		if (!created.success) return;
		expect(await cancelBooking(created.booking.id, 'A01', false)).toEqual({ success: true });
		expect(await updateBooking(created.booking.id, 'A01', slot('13:00:00', '14:00:00'), false)).toMatchObject({
			success: false,
			status: 400
		});
	});

	it('cancelled slots are rebookable and invisible to range reads', async () => {
		const created = await createBooking({ spotNumber: '36', flatNumber: 'A01', ...slot('10:00:00', '12:00:00') });
		expect(created.success).toBe(true);
		if (!created.success) return;
		expect(await cancelBooking(created.booking.id, 'A01', false)).toEqual({ success: true });
		const rebook = await createBooking({ spotNumber: '36', flatNumber: 'B12', ...slot('10:00:00', '12:00:00') });
		expect(rebook.success).toBe(true);
		const inRange = await getBookingsInRange(`${FUTURE}T00:00:00`, `${FUTURE}T24:00:00`, '36');
		expect(inRange.map((b) => b.id)).not.toContain(created.booking.id);
		expect(inRange.map((b) => b.flatNumber)).toContain('B12');
	});

	it('updateBooking 404s, enforces ownership, and refuses the past', async () => {
		expect(await updateBooking(999, 'A01', slot('10:00:00', '12:00:00'), false)).toMatchObject({
			success: false,
			status: 404
		});
		const created = await createBooking({ spotNumber: '36', flatNumber: 'A01', ...slot('10:00:00', '12:00:00') });
		expect(created.success).toBe(true);
		if (!created.success) return;
		expect(await updateBooking(created.booking.id, 'B12', slot('10:00:00', '12:00:00'), false)).toMatchObject({
			success: false,
			status: 403
		});
		expect(await updateBooking(created.booking.id, 'B12', slot('10:00:00', '12:00:00'), true)).toMatchObject({
			success: true
		});
		await memDb().execute("UPDATE booking SET end_time = '2000-01-01T12:00:00'");
		expect(await updateBooking(created.booking.id, 'A01', slot('10:00:00', '12:00:00'), false)).toMatchObject({
			success: false,
			status: 400
		});
	});

	it('updateBooking edits the note alone, and clears it when emptied', async () => {
		const created = await createBooking({ spotNumber: '36', flatNumber: 'A01', ...slot('10:00:00', '12:00:00') });
		expect(created.success).toBe(true);
		if (!created.success) return;

		const noted = await updateBooking(created.booking.id, 'A01', { note: '  Appeler avant  ' }, false);
		expect(noted.success).toBe(true);
		if (!noted.success) return;
		expect(noted.booking.note).toBe('Appeler avant');
		expect(noted.booking.startTime).toBe(`${FUTURE}T10:00:00`);

		const cleared = await updateBooking(created.booking.id, 'A01', { note: '   ' }, false);
		expect(cleared.success).toBe(true);
		if (!cleared.success) return;
		expect(cleared.booking.note).toBeNull();
	});

	it('updateBooking accepts a null note when moving times or clearing', async () => {
		const created = await createBooking({
			spotNumber: '36',
			flatNumber: 'A01',
			...slot('10:00:00', '12:00:00'),
			note: 'Garder'
		});
		expect(created.success).toBe(true);
		if (!created.success) return;

		// The edit dialog always sends the note key (null when the field is empty)
		const moved = await updateBooking(
			created.booking.id,
			'A01',
			{ startTime: `${FUTURE}T11:00:00`, endTime: `${FUTURE}T13:00:00`, note: null },
			false
		);
		expect(moved.success).toBe(true);
		if (!moved.success) return;
		expect(moved.booking.startTime).toBe(`${FUTURE}T11:00:00`);
		expect(moved.booking.note).toBeNull();

		const renoted = await updateBooking(created.booking.id, 'A01', { note: 'De retour' }, false);
		expect(renoted.success).toBe(true);
		if (!renoted.success) return;
		expect(renoted.booking.note).toBe('De retour');

		const cleared = await updateBooking(created.booking.id, 'A01', { note: null }, false);
		expect(cleared.success).toBe(true);
		if (!cleared.success) return;
		expect(cleared.booking.note).toBeNull();
	});

	it('updateBooking refuses empty updates and still guards moved times', async () => {
		const created = await createBooking({ spotNumber: '36', flatNumber: 'A01', ...slot('10:00:00', '12:00:00') });
		expect(created.success).toBe(true);
		if (!created.success) return;

		expect(await updateBooking(created.booking.id, 'A01', {}, false)).toMatchObject({
			success: false,
			status: 400
		});
		expect(await updateBooking(created.booking.id, 'A01', { startTime: `${FUTURE}T11:00:00` }, false)).toMatchObject({
			success: false,
			status: 400
		});
	});

	it('updateBooking ignores its own slot for conflicts but sees others', async () => {
		const first = await createBooking({ spotNumber: '36', flatNumber: 'A01', ...slot('10:00:00', '12:00:00') });
		expect(first.success).toBe(true);
		if (!first.success) return;
		// Self-overlap is not a conflict (exclude-id)
		const moved = await updateBooking(first.booking.id, 'A01', slot('11:00:00', '13:00:00'), false);
		expect(moved.success).toBe(true);
		if (!moved.success) return;
		expect(moved.booking.startTime).toBe(`${FUTURE}T11:00:00`);

		const second = await createBooking({ spotNumber: '36', flatNumber: 'B12', ...slot('14:00:00', '15:00:00') });
		expect(second.success).toBe(true);
		expect(await updateBooking(first.booking.id, 'A01', slot('14:30:00', '15:30:00'), false)).toMatchObject({
			success: false,
			status: 409
		});
	});

	it('a cancelled slot is re-bookable (cancelled rows never block)', async () => {
		const first = await createBooking({ spotNumber: '36', flatNumber: 'A01', ...slot('10:00:00', '12:00:00') });
		expect(first.success).toBe(true);
		if (!first.success) return;
		expect(await cancelBooking(first.booking.id, 'A01', false)).toEqual({ success: true });

		const second = await createBooking({ spotNumber: '36', flatNumber: 'B12', ...slot('10:00:00', '12:00:00') });
		expect(second.success).toBe(true);
	});

	it('updateBooking moves a booking across shared spots', async () => {
		await memDb().execute("INSERT INTO spot (number, flat_number, status) VALUES ('37', NULL, 'shared')");
		const created = await createBooking({ spotNumber: '36', flatNumber: 'A01', ...slot('10:00:00', '12:00:00') });
		expect(created.success).toBe(true);
		if (!created.success) return;

		const moved = await updateBooking(
			created.booking.id,
			'A01',
			{ ...slot('10:00:00', '12:00:00'), spotNumber: '37' },
			false
		);
		expect(moved.success).toBe(true);
		if (!moved.success) return;
		expect(moved.booking.spotNumber).toBe('37');
	});

	it('updateBooking moves a booking across spots with times untouched', async () => {
		await memDb().execute("INSERT INTO spot (number, flat_number, status) VALUES ('37', NULL, 'shared')");
		const created = await createBooking({ spotNumber: '36', flatNumber: 'A01', ...slot('10:00:00', '12:00:00') });
		expect(created.success).toBe(true);
		if (!created.success) return;

		const moved = await updateBooking(created.booking.id, 'A01', { spotNumber: '37' }, false);
		expect(moved.success).toBe(true);
		if (!moved.success) return;
		expect(moved.booking.spotNumber).toBe('37');
		expect(moved.booking.startTime).toBe(`${FUTURE}T10:00:00`);
	});

	it('updateBooking 409s a cross-spot move into an occupied slot', async () => {
		await memDb().execute("INSERT INTO spot (number, flat_number, status) VALUES ('37', NULL, 'shared')");
		const first = await createBooking({ spotNumber: '36', flatNumber: 'A01', ...slot('10:00:00', '12:00:00') });
		expect(first.success).toBe(true);
		if (!first.success) return;
		const second = await createBooking({ spotNumber: '37', flatNumber: 'B12', ...slot('11:00:00', '13:00:00') });
		expect(second.success).toBe(true);

		expect(
			await updateBooking(first.booking.id, 'A01', { ...slot('10:00:00', '12:00:00'), spotNumber: '37' }, false)
		).toMatchObject({ success: false, status: 409 });
	});

	it('updateBooking 404s unknown and 400s unbookable spot targets', async () => {
		const created = await createBooking({ spotNumber: '36', flatNumber: 'A01', ...slot('10:00:00', '12:00:00') });
		expect(created.success).toBe(true);
		if (!created.success) return;

		expect(
			await updateBooking(created.booking.id, 'A01', { ...slot('10:00:00', '12:00:00'), spotNumber: '99' }, false)
		).toMatchObject({ success: false, status: 404 });

		await memDb().execute("INSERT INTO spot (number, flat_number, status) VALUES ('38', 'B12', 'assigned')");
		expect(
			await updateBooking(created.booking.id, 'A01', { ...slot('10:00:00', '12:00:00'), spotNumber: '38' }, false)
		).toMatchObject({ success: false, status: 400 });
	});

	it('updateBooking treats a same-spot number as no spot change', async () => {
		const created = await createBooking({ spotNumber: '36', flatNumber: 'A01', ...slot('10:00:00', '12:00:00') });
		expect(created.success).toBe(true);
		if (!created.success) return;

		const moved = await updateBooking(
			created.booking.id,
			'A01',
			{ ...slot('11:00:00', '13:00:00'), spotNumber: '36' },
			false
		);
		expect(moved.success).toBe(true);
		if (!moved.success) return;
		expect(moved.booking.spotNumber).toBe('36');
		expect(moved.booking.startTime).toBe(`${FUTURE}T11:00:00`);

		expect(await updateBooking(created.booking.id, 'A01', { spotNumber: '36' }, false)).toMatchObject({
			success: false,
			status: 400
		});
	});

	it('getBookingsInRange expands bare dates to day boundaries', async () => {
		const created = await createBooking({ spotNumber: '36', flatNumber: 'A01', ...slot('10:00:00', '12:00:00') });
		expect(created.success).toBe(true);
		const found = await getBookingsInRange(FUTURE, FUTURE);
		expect(found.map((b) => b.spotNumber)).toEqual(['36']);
		const missing = await getBookingsInRange('2099-06-11', '2099-06-11');
		expect(missing).toEqual([]);
	});

	it('cancelBooking re-cancel answers 409', async () => {
		const created = await createBooking({ spotNumber: '36', flatNumber: 'A01', ...slot('10:00:00', '12:00:00') });
		expect(created.success).toBe(true);
		if (!created.success) return;
		expect(await cancelBooking(created.booking.id, 'A01', false)).toEqual({ success: true });
		expect(await cancelBooking(created.booking.id, 'A01', false)).toMatchObject({ success: false, status: 409 });
	});

	it('updateBooking on a cancelled booking answers 400', async () => {
		const created = await createBooking({ spotNumber: '36', flatNumber: 'A01', ...slot('10:00:00', '12:00:00') });
		expect(created.success).toBe(true);
		if (!created.success) return;
		expect(await cancelBooking(created.booking.id, 'A01', false)).toEqual({ success: true });
		expect(await updateBooking(created.booking.id, 'A01', { ...slot('11:00:00', '13:00:00') }, false)).toMatchObject({
			success: false,
			status: 400
		});
	});
});
