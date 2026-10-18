import { json } from '@sveltejs/kit';
import { eq, inArray } from 'drizzle-orm';
import { formatSpotNumber, SPOT_NUMBER_REGEX } from '$lib/constants';
import { errorJson } from '$lib/server/handler';
import type { SpotConflict } from '$lib/types';
import type { DbOrTx } from './db';
import { spot } from './db/schema';
import { canTransition, type SpotStatus } from './spot-state';

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
	if (spotNumbers.length === 0) return [];
	// Single batched read; input order preserved for stable dialog ordering.
	const byNumber = new Map(
		(await database.select().from(spot).where(inArray(spot.number, spotNumbers)).all()).map((row) => [row.number, row])
	);
	const conflicts: SpotConflict[] = [];
	for (const spotNum of spotNumbers) {
		const existing = byNumber.get(spotNum);
		if (existing?.flatNumber && existing.flatNumber !== excludeFlat) {
			conflicts.push({ spotNumber: spotNum, currentFlat: existing.flatNumber });
		}
	}
	return conflicts;
}

/** Among conflicts, those whose holder would be left with 0 spots. Reads only. */
export async function detectStrands(database: DbOrTx, conflicts: SpotConflict[]): Promise<SpotConflict[]> {
	if (conflicts.length === 0) return [];
	// One holdings query for every distinct holder (not one per conflict).
	const flats = [...new Set(conflicts.map((c) => c.currentFlat))];
	const held = await database.select().from(spot).where(inArray(spot.flatNumber, flats)).all();
	const counts = new Map<string, number>();
	for (const row of held) {
		if (row.flatNumber) counts.set(row.flatNumber, (counts.get(row.flatNumber) ?? 0) + 1);
	}
	return conflicts.filter((c) => (counts.get(c.currentFlat) ?? 0) <= 1);
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

/**
 * Refuse to strand `currentFlat` at 0 spots: the 409 response when removing
 * `spotNumber` would empty its holder, else null.
 */
export async function assertNoStrand(
	database: DbOrTx,
	spotNumber: string,
	currentFlat: string
): Promise<Response | null> {
	const strands = await detectStrands(database, [{ spotNumber, currentFlat }]);
	if (strands.length > 0) {
		return errorJson(buildStrandErrorMessage(strands[0]), 409);
	}
	return null;
}

/** 400 when any normalized number isn't a valid spot number, else null. */
export function guardSpotFormats(spotNumbers: string[]): Response | null {
	for (const s of spotNumbers) {
		if (!SPOT_NUMBER_REGEX.test(s)) {
			return errorJson(`Format de place de parking invalide : "${s}" (ex. 01, 36)`, 400);
		}
	}
	return null;
}

/**
 * Normalize + empty-check + format-guard a raw spot-number list in one call.
 * Returns the normalized list, or the 400 response to answer with.
 * `emptyMessage` stays per-caller — each flow words "required" differently.
 */
export function parseSpotListInput(raw: unknown, emptyMessage: string): string[] | Response {
	const trimmed = normalizeSpotNumbers(raw);
	if (trimmed.length === 0) return errorJson(emptyMessage, 400);
	return guardSpotFormats(trimmed) ?? trimmed;
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
		// Hand-written (not errorJson): the 409 contract carries the `conflicts`
		// array for the client-side resolution dialog — errorJson() has no payload slot.
		return json({ error: 'Conflit de place de parking', conflicts }, { status: 409 });
	}

	// Force: refuse to strand any source flat with 0 spots
	if (force) {
		for (const conflict of conflicts) {
			const strandBlock = await assertNoStrand(database, conflict.spotNumber, conflict.currentFlat);
			if (strandBlock) return strandBlock;
		}
	}

	return null;
}

/** Bind each spot to the flat (update existing or insert), status → assigned. Caller owns the transaction. */
export async function bindSpotsToFlat(database: DbOrTx, spotNumbers: string[], flatNumber: string): Promise<void> {
	// Single batched read; writes stay per-row (update vs insert per spot).
	const byNumber = new Map(
		spotNumbers.length > 0
			? (await database.select().from(spot).where(inArray(spot.number, spotNumbers)).all()).map((row) => [
					row.number,
					row
				])
			: []
	);
	for (const spotNum of spotNumbers) {
		const existing = byNumber.get(spotNum);
		if (existing) {
			if (!canTransition(existing.status, 'bind', { hasFlat: !!existing.flatNumber })) {
				throw new Error(`Transition illégale : ${existing.status} → assigned (place ${spotNum})`);
			}
			await database.update(spot).set({ flatNumber, status: 'assigned' }).where(eq(spot.number, spotNum));
		} else {
			await database.insert(spot).values({ number: spotNum, flatNumber, status: 'assigned' });
		}
	}
}

type BatchMoveTarget = { type: 'flat'; flatNumber: string } | { type: 'shared' } | { type: 'unassigned' };

export interface BatchMove {
	spotNumber: string;
	to: BatchMoveTarget;
}

interface BatchSpotRow {
	number: string;
	flatNumber: string | null;
	status: string;
}

interface BatchWrite {
	spotNumber: string;
	flatNumber: string | null;
	status: SpotStatus;
}

type BatchValidationResult = { writes: BatchWrite[]; stranded: SpotConflict[] } | { error: string; status: number };

function batchError(error: string, status: number): { error: string; status: number } {
	return { error, status };
}

/**
 * Pure batch-move validation for the mercato board (no DB access).
 *
 * Unlike the single-target `guardRebind` flow, moves are evaluated against the
 * *final* holdings: an A↔B swap is legal even though each leg taken alone looks
 * like a conflict. No-ops (spot already where it is sent) are dropped.
 * Unknown spots are rejected — the board only ever sends rows it displayed.
 *
 * `current` must cover every spot of every touched holder (the endpoint loads
 * the whole table): strand detection compares final holdings, so spots a
 * holder keeps have to be visible even when they are not moved.
 */
export function validateBatchMoves(
	current: BatchSpotRow[],
	knownFlats: string[],
	rawMoves: unknown
): BatchValidationResult {
	if (!Array.isArray(rawMoves) || rawMoves.length === 0) {
		return batchError('Au moins un déplacement est requis', 400);
	}

	// Normalize shape + numbers; last write wins per spot.
	const bySpot = new Map<string, BatchMoveTarget>();
	for (const raw of rawMoves) {
		if (typeof raw !== 'object' || raw === null) {
			return batchError('Déplacement invalide', 400);
		}
		const { spotNumber: rawNumber, to } = raw as { spotNumber?: unknown; to?: unknown };
		const trimmed = String(rawNumber ?? '').trim();
		if (!trimmed) {
			return batchError('Numéro de place de parking manquant', 400);
		}
		const number = formatSpotNumber(trimmed);
		if (!SPOT_NUMBER_REGEX.test(number)) {
			return batchError(`Format de place de parking invalide : "${number}" (ex. 01, 36)`, 400);
		}
		if (typeof to !== 'object' || to === null) {
			return batchError(`Destination invalide pour la place ${number}`, 400);
		}
		const { type, flatNumber: rawFlat } = to as { type?: unknown; flatNumber?: unknown };
		if (type === 'flat') {
			const flatNumber = String(rawFlat ?? '').trim();
			if (!flatNumber) {
				return batchError(`Lot de destination manquant pour la place ${number}`, 400);
			}
			bySpot.set(number, { type: 'flat', flatNumber });
		} else if (type === 'shared' || type === 'unassigned') {
			bySpot.set(number, { type });
		} else {
			return batchError(`Destination invalide pour la place ${number}`, 400);
		}
	}

	const currentByNumber = new Map(current.map((row) => [row.number, row]));
	const writes: BatchWrite[] = [];

	for (const [number, to] of bySpot) {
		const row = currentByNumber.get(number);
		if (!row) {
			return batchError('Place de parking introuvable', 404);
		}
		if (to.type === 'flat') {
			if (!knownFlats.includes(to.flatNumber)) {
				return batchError('Lot introuvable', 404);
			}
			if (row.flatNumber === to.flatNumber) continue; // already there
			writes.push({ spotNumber: number, flatNumber: to.flatNumber, status: 'assigned' });
		} else if (to.type === 'shared') {
			if (row.flatNumber) {
				if (!canTransition(row.status, 'unbind', { hasFlat: true })) {
					return batchError(`Transition illégale pour la place ${number}`, 409);
				}
				writes.push({ spotNumber: number, flatNumber: null, status: 'shared' });
			} else if (row.status === 'unassigned') {
				if (!canTransition(row.status, 'share')) {
					return batchError(`Transition illégale pour la place ${number}`, 409);
				}
				writes.push({ spotNumber: number, flatNumber: null, status: 'shared' });
			}
			// already shared → no-op
		} else {
			if (row.flatNumber) {
				// Bound spot straight to limbo: clears the binding in the same
				// write. Strand protection comes from the final-holdings
				// computation below (a holder left at 0 spots is refused).
				if (!canTransition(row.status, 'limbo', { hasFlat: true })) {
					return batchError(`Transition illégale pour la place ${number}`, 409);
				}
				writes.push({ spotNumber: number, flatNumber: null, status: 'unassigned' });
			} else if (row.status === 'shared') {
				if (!canTransition(row.status, 'limbo')) {
					return batchError(`Transition illégale pour la place ${number}`, 409);
				}
				writes.push({ spotNumber: number, flatNumber: null, status: 'unassigned' });
			}
			// already unassigned → no-op
		}
	}

	// Final holdings: apply every write to the current counts, then refuse to
	// leave any previously non-empty flat at 0 spots.
	const holdings = new Map<string, number>();
	for (const row of current) {
		if (row.flatNumber) holdings.set(row.flatNumber, (holdings.get(row.flatNumber) ?? 0) + 1);
	}
	const initial = new Map(holdings);
	const leftBehind = new Map<string, string>(); // flat → first spot that left it
	for (const write of writes) {
		const before = currentByNumber.get(write.spotNumber)!;
		if (before.flatNumber && before.flatNumber !== write.flatNumber) {
			holdings.set(before.flatNumber, (holdings.get(before.flatNumber) ?? 0) - 1);
			if (!leftBehind.has(before.flatNumber)) leftBehind.set(before.flatNumber, write.spotNumber);
		}
		if (write.flatNumber && write.flatNumber !== before.flatNumber) {
			holdings.set(write.flatNumber, (holdings.get(write.flatNumber) ?? 0) + 1);
		}
	}
	const stranded: SpotConflict[] = [];
	for (const [flatNumber, count] of holdings) {
		if (count === 0 && (initial.get(flatNumber) ?? 0) > 0) {
			stranded.push({ spotNumber: leftBehind.get(flatNumber)!, currentFlat: flatNumber });
		}
	}

	return { writes, stranded };
}
