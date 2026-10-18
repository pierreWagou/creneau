import { eq } from 'drizzle-orm';
import { db } from './db';
import { spot } from './db/schema';
import type { SpotMachineEvent } from './spot-machine';
import { machineCan } from './spot-machine';

/**
 * Stored spot lifecycle: shared (pool, bookable) · assigned (a lot's, ⟺ flatNumber set)
 * · unassigned (limbo to route). Invariant: assigned ⟺ flatNumber set; only shared is bookable.
 */
export type SpotStatus = 'shared' | 'assigned' | 'unassigned';

export type SpotEvent = 'bind' | 'unbind' | 'share' | 'limbo';

const TO_MACHINE_EVENT: Record<SpotEvent, SpotMachineEvent> = {
	bind: 'BIND',
	unbind: 'UNBIND',
	share: 'SHARE',
	limbo: 'LIMBO'
};

/**
 * Legality check delegating to the XState machine (single source of truth).
 * `hasFlat` defaults to false to preserve the two-arg call shape.
 */
export function canTransition(from: string, event: SpotEvent, opts?: { hasFlat?: boolean }): boolean {
	if (!['shared', 'assigned', 'unassigned'].includes(from)) return false;
	return machineCan(from as SpotStatus, TO_MACHINE_EVENT[event], { hasFlat: opts?.hasFlat ?? false });
}

export class SpotTransitionError extends Error {
	statusCode: number;
	constructor(message: string, statusCode = 409) {
		super(message);
		this.statusCode = statusCode;
	}
}

type SpotRow = typeof spot.$inferSelect;

export async function getSpotOrThrow(number: string): Promise<SpotRow> {
	const row = await db.select().from(spot).where(eq(spot.number, number)).get();
	if (!row) {
		throw new SpotTransitionError('Place de parking introuvable', 404);
	}
	return row;
}

/**
 * share — unassigned → shared (move to the bookable pool).
 * Refuses bound spots (invariant: assigned ⟺ flatNumber set).
 */
export async function shareSpot(number: string): Promise<SpotRow> {
	const existing = await getSpotOrThrow(number);
	if (existing.flatNumber) {
		throw new SpotTransitionError('Place attribuée — utilisez les flux de lot', 409);
	}
	if (!canTransition(existing.status, 'share')) {
		throw new SpotTransitionError('Cette place est déjà partagée', 409);
	}
	await db.update(spot).set({ status: 'shared' }).where(eq(spot.number, number));
	return getSpotOrThrow(number);
}

/**
 * shelve — shared|assigned → unassigned (hold in limbo).
 * Bound spots are accepted: the flat binding is cleared in the same write,
 * but the holder lot must keep at least one spot (strand guard, same shape
 * as DELETE /api/spots/:number — kept inline to avoid a rebind import cycle).
 */
export async function shelveSpot(number: string): Promise<SpotRow> {
	const existing = await getSpotOrThrow(number);
	if (existing.flatNumber) {
		const held = await db.select().from(spot).where(eq(spot.flatNumber, existing.flatNumber)).all();
		if (held.length <= 1) {
			throw new SpotTransitionError(
				`Impossible de réaffecter la place de parking ${number} — le lot ${existing.flatNumber} n'aurait plus de place de parking`,
				409
			);
		}
	}
	if (!canTransition(existing.status, 'limbo', { hasFlat: !!existing.flatNumber })) {
		throw new SpotTransitionError('Cette place est déjà non affectée', 409);
	}
	await db.update(spot).set({ flatNumber: null, status: 'unassigned' }).where(eq(spot.number, number));
	return getSpotOrThrow(number);
}
