import { eq } from 'drizzle-orm';
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

export function strandErrorMessage(c: SpotConflict): string {
	return `Impossible de réaffecter la place de parking ${c.spotNumber} — le lot ${c.currentFlat} n'aurait plus de place de parking`;
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
