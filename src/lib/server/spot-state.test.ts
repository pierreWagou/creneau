import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { machineCan } from './spot-machine';
import type { SpotEvent } from './spot-state';

// Write tests run the real drizzle queries against an in-memory libsql
// (spot-state.ts owns its `./db` import, so the module mock builds the memory DB).
vi.mock('./db', async () => {
	const { createClient } = await import('@libsql/client');
	const { drizzle } = await import('drizzle-orm/libsql');
	const client = createClient({ url: ':memory:' });
	(globalThis as unknown as Record<string, unknown>).__spotStateClient = client;
	return { db: drizzle(client) };
});

type MemClient = { execute: (sql: string) => Promise<unknown> };
function memDb(): MemClient {
	return (globalThis as unknown as Record<string, MemClient>).__spotStateClient;
}

import { canTransition, getSpotOrThrow, SpotTransitionError, shareSpot, shelveSpot } from './spot-state';

describe('canTransition', () => {
	const cases: Array<[string, SpotEvent, boolean]> = [
		// bind: legal from every state (rebind on assigned is a legal self-transition)
		['shared', 'bind', true],
		['assigned', 'bind', true],
		['unassigned', 'bind', true],
		// unbind: assigned only (shared/unassigned have no flat to release);
		// defaults to hasFlat:false — the hasFlat:true case is covered by the guard test below
		['assigned', 'unbind', false],
		['shared', 'unbind', false],
		['unassigned', 'unbind', false],
		// share: unassigned only (shared is a no-op self; assigned has no SHARE transition)
		['unassigned', 'share', true],
		['shared', 'share', false],
		['assigned', 'share', false],
		// limbo: shared, or assigned with hasFlat (guarded — the default
		// hasFlat:false below refuses assigned, like unbind)
		['shared', 'limbo', true],
		['unassigned', 'limbo', false],
		['assigned', 'limbo', false],
		// unknown states never transition
		['expired', 'bind', false],
		['', 'share', false]
	];

	for (const [from, event, expected] of cases) {
		it(`${event} from ${from || '(empty)'} → ${expected}`, () => {
			expect(canTransition(from, event)).toBe(expected);
		});
	}

	it('unbind from assigned requires hasFlat (machine guard)', () => {
		expect(canTransition('assigned', 'unbind', { hasFlat: true })).toBe(true);
		expect(canTransition('assigned', 'unbind', { hasFlat: false })).toBe(false);
		expect(canTransition('assigned', 'unbind')).toBe(false);
	});

	it('limbo from assigned requires hasFlat (machine guard)', () => {
		expect(canTransition('assigned', 'limbo', { hasFlat: true })).toBe(true);
		expect(canTransition('assigned', 'limbo', { hasFlat: false })).toBe(false);
		expect(canTransition('assigned', 'limbo')).toBe(false);
	});
});

describe('machineCan (XState source of truth)', () => {
	it('BIND advances shared → assigned and unassigned → assigned', () => {
		expect(machineCan('shared', 'BIND', { hasFlat: false })).toBe(true);
		expect(machineCan('unassigned', 'BIND', { hasFlat: false })).toBe(true);
	});

	it('BIND on assigned is a legal re-bind', () => {
		expect(machineCan('assigned', 'BIND', { hasFlat: true })).toBe(true);
	});

	it('UNBIND follows the hasFlat guard', () => {
		expect(machineCan('assigned', 'UNBIND', { hasFlat: true })).toBe(true);
		expect(machineCan('assigned', 'UNBIND', { hasFlat: false })).toBe(false);
	});

	it('SHARE advances unassigned → shared only', () => {
		expect(machineCan('unassigned', 'SHARE', { hasFlat: false })).toBe(true);
		expect(machineCan('shared', 'SHARE', { hasFlat: false })).toBe(false);
		expect(machineCan('assigned', 'SHARE', { hasFlat: true })).toBe(false);
	});

	it('LIMBO advances shared|assigned → unassigned', () => {
		expect(machineCan('shared', 'LIMBO', { hasFlat: false })).toBe(true);
		expect(machineCan('unassigned', 'LIMBO', { hasFlat: false })).toBe(false);
		expect(machineCan('assigned', 'LIMBO', { hasFlat: true })).toBe(true);
		expect(machineCan('assigned', 'LIMBO', { hasFlat: false })).toBe(false);
	});

	it('illegal events leave the value (not legal)', () => {
		expect(machineCan('shared', 'UNBIND', { hasFlat: false })).toBe(false);
		expect(machineCan('unassigned', 'UNBIND', { hasFlat: false })).toBe(false);
		expect(machineCan('assigned', 'SHARE', { hasFlat: true })).toBe(false);
	});
});

describe('SpotTransitionError', () => {
	it('defaults to 409', () => {
		const err = new SpotTransitionError('nope');
		expect(err.statusCode).toBe(409);
		expect(err.message).toBe('nope');
	});

	it('accepts a custom status code', () => {
		expect(new SpotTransitionError('missing', 404).statusCode).toBe(404);
	});
});

describe('spot writes (in-memory libsql)', () => {
	beforeAll(async () => {
		await memDb().execute(`
			CREATE TABLE spot (
				number text PRIMARY KEY,
				flat_number text,
				status text NOT NULL,
				description text,
				created_at text
			)
		`);
	});

	beforeEach(async () => {
		await memDb().execute('DELETE FROM spot');
	});

	async function seed(number: string, flatNumber: string | null, status: string): Promise<void> {
		await memDb().execute(
			`INSERT INTO spot (number, flat_number, status) VALUES ('${number}', ${flatNumber === null ? 'NULL' : `'${flatNumber}'`}, '${status}')`
		);
	}

	it('getSpotOrThrow 404s on unknown numbers', async () => {
		await expect(getSpotOrThrow('ZZ')).rejects.toThrowError(SpotTransitionError);
	});

	it('shareSpot moves unassigned → shared', async () => {
		await seed('36', null, 'unassigned');
		const row = await shareSpot('36');
		expect(row.status).toBe('shared');
	});

	it('shareSpot refuses bound spots (lot flows own UNBIND)', async () => {
		await seed('36', 'B12', 'assigned');
		await expect(shareSpot('36')).rejects.toMatchObject({ statusCode: 409 });
	});

	it('shareSpot refuses already-shared spots', async () => {
		await seed('36', null, 'shared');
		await expect(shareSpot('36')).rejects.toMatchObject({ statusCode: 409 });
	});

	it('shelveSpot moves shared → unassigned', async () => {
		await seed('36', null, 'shared');
		const row = await shelveSpot('36');
		expect(row.status).toBe('unassigned');
		expect(row.flatNumber).toBeNull();
	});

	it('shelveSpot clears the binding when the holder keeps another spot', async () => {
		await seed('36', 'B12', 'assigned');
		await seed('37', 'B12', 'assigned');
		const row = await shelveSpot('36');
		expect(row.status).toBe('unassigned');
		expect(row.flatNumber).toBeNull();
	});

	it('shelveSpot refuses to strand the holder at 0 spots', async () => {
		await seed('36', 'B12', 'assigned');
		await expect(shelveSpot('36')).rejects.toMatchObject({ statusCode: 409 });
	});

	it('shelveSpot refuses already-unassigned spots', async () => {
		await seed('36', null, 'unassigned');
		await expect(shelveSpot('36')).rejects.toMatchObject({ statusCode: 409 });
	});
});
