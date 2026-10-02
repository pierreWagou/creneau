import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from './db/schema';
import {
	bindSpotsToFlat,
	buildStrandErrorMessage,
	detectConflicts,
	detectStrands,
	guardRebind,
	guardSpotFormats,
	normalizeSpotNumbers,
	type SpotConflict
} from './rebind';

/**
 * rebind.ts takes its connection as a parameter (its `./db` import is
 * type-only), so these tests run the real drizzle queries against an
 * in-memory libsql — a stub double would only exercise plumbing.
 */
const client = createClient({ url: ':memory:' });
const db = drizzle(client, { schema });

beforeAll(async () => {
	await client.execute(`
		CREATE TABLE spot (
			number text PRIMARY KEY,
			flat_number text,
			status text NOT NULL DEFAULT 'unassigned',
			description text,
			created_at text NOT NULL DEFAULT (datetime('now'))
		)
	`);
});

beforeEach(async () => {
	await client.execute('DELETE FROM spot');
});

async function seedSpot(number: string, flatNumber: string | null, status: string): Promise<void> {
	await client.execute({
		sql: 'INSERT INTO spot (number, flat_number, status) VALUES (?, ?, ?)',
		args: [number, flatNumber, status]
	});
}

describe('normalizeSpotNumbers', () => {
	it('returns [] for anything that is not an array', () => {
		expect(normalizeSpotNumbers(undefined)).toEqual([]);
		expect(normalizeSpotNumbers(null)).toEqual([]);
		expect(normalizeSpotNumbers('36')).toEqual([]);
		expect(normalizeSpotNumbers({ length: 1 })).toEqual([]);
	});

	it('zero-pads single digits and trims', () => {
		expect(normalizeSpotNumbers([' 3', ' 36 '])).toEqual(['03', '36']);
	});

	it('deduplicates after normalization', () => {
		expect(normalizeSpotNumbers(['3', '03', '3'])).toEqual(['03']);
	});

	it('drops empty entries', () => {
		expect(normalizeSpotNumbers(['', '   ', '05'])).toEqual(['05']);
	});

	it('coerces non-string entries', () => {
		expect(normalizeSpotNumbers([3, 36])).toEqual(['03', '36']);
	});
});

describe('guardSpotFormats', () => {
	it('passes a normalized list', () => {
		expect(guardSpotFormats(['03', '36'])).toBeNull();
	});

	it('rejects a malformed number with the shared French message', async () => {
		const res = guardSpotFormats(['abc']);
		expect(res).not.toBeNull();
		expect(res!.status).toBe(400);
		expect(await res!.json()).toEqual({
			error: 'Format de place de parking invalide : "abc" (ex. 01, 36)'
		});
	});
});

describe('detectConflicts', () => {
	it('flags spots held by another flat', async () => {
		await seedSpot('10', 'A01', 'assigned');
		const conflicts = await detectConflicts(db, ['10'], 'B01');
		expect(conflicts).toEqual([{ spotNumber: '10', currentFlat: 'A01' }]);
	});

	it('excludes the receiving flat own spots', async () => {
		await seedSpot('10', 'A01', 'assigned');
		expect(await detectConflicts(db, ['10'], 'A01')).toEqual([]);
	});

	it('ignores unbound spots', async () => {
		await seedSpot('10', null, 'shared');
		expect(await detectConflicts(db, ['10'], 'A01')).toEqual([]);
	});

	it('ignores unknown spots (they are created at bind time)', async () => {
		expect(await detectConflicts(db, ['99'], 'A01')).toEqual([]);
	});

	it('reports every conflict, in list order', async () => {
		await seedSpot('10', 'A01', 'assigned');
		await seedSpot('11', 'A02', 'assigned');
		await seedSpot('12', null, 'shared');
		expect(await detectConflicts(db, ['10', '12', '11'], 'B01')).toEqual([
			{ spotNumber: '10', currentFlat: 'A01' },
			{ spotNumber: '11', currentFlat: 'A02' }
		]);
	});
});

describe('detectStrands', () => {
	it('flags a holder whose only spot is being taken', async () => {
		await seedSpot('10', 'A01', 'assigned');
		const conflicts: SpotConflict[] = [{ spotNumber: '10', currentFlat: 'A01' }];
		expect(await detectStrands(db, conflicts)).toEqual(conflicts);
	});

	it('leaves a holder that keeps another spot', async () => {
		await seedSpot('10', 'A01', 'assigned');
		await seedSpot('11', 'A01', 'assigned');
		const conflicts: SpotConflict[] = [{ spotNumber: '10', currentFlat: 'A01' }];
		expect(await detectStrands(db, conflicts)).toEqual([]);
	});

	it('is empty when there is no conflict to resolve', async () => {
		expect(await detectStrands(db, [])).toEqual([]);
	});
});

describe('buildStrandErrorMessage', () => {
	it('matches the message asserted by the e2e suite', () => {
		expect(buildStrandErrorMessage({ spotNumber: '66', currentFlat: 'B10' })).toBe(
			"Impossible de réaffecter la place de parking 66 — le lot B10 n'aurait plus de place de parking"
		);
	});
});

describe('guardRebind', () => {
	it('refuses conflicts without force, echoing the conflicts payload', async () => {
		await seedSpot('10', 'A01', 'assigned');
		const conflicts: SpotConflict[] = [{ spotNumber: '10', currentFlat: 'A01' }];

		const res = await guardRebind(db, conflicts, false);
		expect(res).not.toBeNull();
		expect(res!.status).toBe(409);
		expect(await res!.json()).toEqual({ error: 'Conflit de place de parking', conflicts });
	});

	it('allows a clean rebind', async () => {
		expect(await guardRebind(db, [], false)).toBeNull();
	});

	it('allows forced rebind of a movable spot', async () => {
		await seedSpot('10', 'A01', 'assigned');
		await seedSpot('11', 'A01', 'assigned');
		const conflicts: SpotConflict[] = [{ spotNumber: '10', currentFlat: 'A01' }];
		expect(await guardRebind(db, conflicts, true)).toBeNull();
	});

	it('still refuses a forced rebind that would strand the holder', async () => {
		await seedSpot('10', 'A01', 'assigned');
		const conflicts: SpotConflict[] = [{ spotNumber: '10', currentFlat: 'A01' }];

		const res = await guardRebind(db, conflicts, true);
		expect(res).not.toBeNull();
		expect(res!.status).toBe(409);
		expect(await res!.json()).toEqual({
			error: buildStrandErrorMessage(conflicts[0])
		});
	});
});

describe('bindSpotsToFlat', () => {
	it('moves an existing spot and marks it assigned', async () => {
		await seedSpot('10', 'A01', 'assigned');
		await bindSpotsToFlat(db, ['10'], 'B01');

		const row = await client.execute("SELECT flat_number, status FROM spot WHERE number = '10'");
		expect(row.rows[0]).toEqual({ flat_number: 'B01', status: 'assigned' });
	});

	it('creates a spot that does not exist yet, marked assigned', async () => {
		await bindSpotsToFlat(db, ['10'], 'B01');

		const row = await client.execute("SELECT flat_number, status FROM spot WHERE number = '10'");
		expect(row.rows[0]).toEqual({ flat_number: 'B01', status: 'assigned' });
	});

	it('binds a whole list', async () => {
		await seedSpot('10', 'A01', 'assigned');
		await bindSpotsToFlat(db, ['10', '11'], 'B01');

		const rows = await client.execute('SELECT number FROM spot WHERE flat_number = ? ORDER BY number', ['B01']);
		expect(rows.rows.map((r) => r.number)).toEqual(['10', '11']);
	});
});
