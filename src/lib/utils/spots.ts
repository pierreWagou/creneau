export interface SpotConflict {
	spotNumber: string;
	currentFlat: string;
}

export interface DescribedSpotConflict extends SpotConflict {
	/** Spots the holder keeps if this one is reassigned */
	remainingForCurrent: number;
	/** True when reassigning would leave the holder spotless (server 409s this) */
	blocked: boolean;
	/** 'assigned' (default): bound to a flat · 'shared-pool': in the bookable pool */
	kind?: 'assigned' | 'shared-pool';
}

export interface SpotHolding {
	number: string;
	flatNumber: string | null;
}

/**
 * Finds spots already bound to another flat. `excludeFlat` skips the flat's own
 * spots (request/edit flows); omit it for create drafts where any bound spot conflicts.
 * Pure function — unit-tested; feeds conflict badges/tooltips.
 */
export function findSpotConflicts(
	spotNumbers: string[],
	allSpots: SpotHolding[],
	excludeFlat?: string | null
): SpotConflict[] {
	const conflicts: SpotConflict[] = [];
	for (const spotNum of spotNumbers) {
		const spotRow = allSpots.find((s) => s.number === spotNum);
		if (spotRow?.flatNumber && spotRow.flatNumber !== excludeFlat) {
			conflicts.push({ spotNumber: spotNum, currentFlat: spotRow.flatNumber });
		}
	}
	return conflicts;
}

/**
 * Annotates spot conflicts with consequences, mirroring the server 409 rule
 * (a reassignment that would leave the source flat with 0 spots is refused).
 * Pure function — unit-tested; feeds conflict badges/tooltips.
 */
export function describeSpotConflicts(conflicts: SpotConflict[], allSpots: SpotHolding[]): DescribedSpotConflict[] {
	return conflicts.map((c) => {
		const held = allSpots.filter((s) => s.flatNumber === c.currentFlat).length;
		const remainingForCurrent = Math.max(0, held - 1);
		return { ...c, remainingForCurrent, blocked: remainingForCurrent === 0 };
	});
}

/**
 * Selected shared-pool spots: requesting one removes it from the bookable pool
 * (approval binds silently — `detectConflicts` server-side only flags bound spots).
 * Non-blocking — informs the warning badge, nothing else.
 */
export function describeSharedPoolConflicts(
	spotNumbers: string[],
	allSpots: (SpotHolding & { status: 'shared' | 'assigned' | 'unassigned' })[]
): DescribedSpotConflict[] {
	const out: DescribedSpotConflict[] = [];
	for (const spotNum of spotNumbers) {
		const row = allSpots.find((s) => s.number === spotNum);
		if (row && row.status === 'shared' && !row.flatNumber) {
			out.push({
				spotNumber: spotNum,
				currentFlat: '',
				remainingForCurrent: 0,
				blocked: false,
				kind: 'shared-pool'
			});
		}
	}
	return out;
}
