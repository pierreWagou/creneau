import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { formatSpotNumber, SPOT_NUMBER_REGEX } from '$lib/constants';
import type { DbOrTx } from './db';
import { spot } from './db/schema';

export interface SpotConflict {
	spotNumber: string;
	currentFlat: string;
}

/**
 * Single home for the spot-rebind rule, shared by all mutating endpoints.
 * Reads (detect*) run on db or tx; writes must run inside the caller's transaction.
 */

/** Spots in the list currently bound to another flat (own spots excluded). Reads only. */
export async function detectConflicts(
	database: DbOrTx,
	spotNumbers: string[],
	excludeFlat?: string | null
): Promise<SpotConflict[]> {
	const conflicts: SpotConflict[] = [];
	for (const spotNum of spotNumbers) {
		const existing = await database.select().from(spot).where(eq(spot.number, spotNum)).get();
		if (existing?.flatNumber && existing.flatNumber !== excludeFlat) {
			conflicts.push({ spotNumber: spotNum, currentFlat: existing.flatNumber });
		}
	}
	return conflicts;
}

/** Among conflicts, those whose holder would be left with 0 spots. Reads only. */
export async function detectStrands(database: DbOrTx, conflicts: SpotConflict[]): Promise<SpotConflict[]> {
	const strands: SpotConflict[] = [];
	for (const c of conflicts) {
		const held = await database.select().from(spot).where(eq(spot.flatNumber, c.currentFlat)).all();
		if (held.length <= 1) strands.push(c);
	}
	return strands;
}

export function buildStrandErrorMessage(c: SpotConflict): string {
	return `Impossible de réaffecter la place de parking ${c.spotNumber} — le lot ${c.currentFlat} n'aurait plus de place de parking`;
}

/**
 * Normalize a raw spot-number list: stringify, trim, drop empties, zero-pad,
 * dedupe. Anything that isn't an array normalizes to `[]`.
 *
 * Trim/filter run before padding on purpose: padding first turned empty
 * entries into a bogus `00` spot.
 *
 * Format validation is separate ({@link guardSpotFormats}) so callers keep
 * their own empty-list message.
 */
export function normalizeSpotNumbers(spotNumbers: unknown): string[] {
	if (!Array.isArray(spotNumbers)) return [];
	return [
		...new Set(
			spotNumbers
				.map((s) => String(s).trim())
				.filter((s) => s.length > 0)
				.map((s) => formatSpotNumber(s))
		)
	];
}

/** 400 when any normalized number isn't a valid spot number, else null. */
export function guardSpotFormats(spotNumbers: string[]): Response | null {
	for (const s of spotNumbers) {
		if (!SPOT_NUMBER_REGEX.test(s)) {
			return json({ error: `Format de place de parking invalide : "${s}" (ex. 01, 36)` }, { status: 400 });
		}
	}
	return null;
}

/**
 * Conflict/strand gate run before any spot is rebound to a flat.
 * Returns the 409 response to answer with, else null (proceed).
 *
 * - Conflicts without `force` → 409 with the `conflicts` array for the
 *   client-side resolution dialog.
 * - `force` → allowed, except it never strands the holder lot at 0 spots.
 *
 * Reads only; the caller still owns the writes.
 */
export async function guardRebind(
	database: DbOrTx,
	conflicts: SpotConflict[],
	force: boolean
): Promise<Response | null> {
	if (conflicts.length > 0 && !force) {
		return json({ error: 'Conflit de place de parking', conflicts }, { status: 409 });
	}

	// Force: refuse to strand any source flat with 0 spots
	if (force) {
		const strands = await detectStrands(database, conflicts);
		if (strands.length > 0) {
			return json({ error: buildStrandErrorMessage(strands[0]) }, { status: 409 });
		}
	}

	return null;
}

/** Bind each spot to the flat (update existing or insert), status → assigned. Caller owns the transaction. */
export async function bindSpotsToFlat(database: DbOrTx, spotNumbers: string[], flatNumber: string): Promise<void> {
	for (const spotNum of spotNumbers) {
		const existing = await database.select().from(spot).where(eq(spot.number, spotNum)).get();
		if (existing) {
			await database.update(spot).set({ flatNumber, status: 'assigned' }).where(eq(spot.number, spotNum));
		} else {
			await database.insert(spot).values({ number: spotNum, flatNumber, status: 'assigned' });
		}
	}
}
