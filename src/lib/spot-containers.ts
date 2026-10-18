import { flatColorForIndex, getFlatColor, latte, mocha } from './colors';

/** Spot lifecycle states — the shared vocabulary (UI imports this, not server types). */
export type SpotLifecycleStatus = 'shared' | 'assigned' | 'unassigned';

/**
 * Things that hold spots: the shared pool, limbo (unassigned), and lots.
 * Single domain model for board columns, flight endpoints, and conflict
 * parties — previously three ad-hoc shapes with tint logic at each site.
 * Discriminated union (not classes): serializable, Svelte-runes friendly,
 * behavior via the pure helpers below.
 */
export type SpotContainer =
	/** Shared pool — blue avatar */
	| { kind: 'pool' }
	/** Unassigned limbo — muted (grey) avatar */
	| { kind: 'limbo' }
	/** A lot — avatar in the lot tint */
	| {
			kind: 'lot';
			flatNumber: string;
			displayName: string | null;
			/**
			 * Palette index (0–7) for a user-selected color. Absent/null =
			 * hash fallback (today's behavior). Forward-compatible with a
			 * stored `flat.color_index` column — no call-site changes then.
			 */
			colorIndex?: number | null;
	  };

/** Display title — byte-identical to the legacy strings (e2e + copy depend on them). */
export function containerTitle(container: SpotContainer): string {
	switch (container.kind) {
		case 'pool':
			return 'Places partagées';
		case 'limbo':
			return 'Non affectée';
		case 'lot':
			return `Lot ${container.flatNumber}`;
	}
}

/** Leading avatar for endpoint cards — the tint rule in one place. */
export function containerAvatar(container: SpotContainer, isDark: boolean): { initial: string; tint: string | null } {
	switch (container.kind) {
		case 'pool':
			return { initial: 'P', tint: isDark ? mocha.blue : latte.blue };
		case 'limbo':
			return { initial: 'N', tint: null };
		case 'lot': {
			const tint =
				container.colorIndex != null && Number.isInteger(container.colorIndex)
					? flatColorForIndex(container.colorIndex, isDark)
					: getFlatColor(container.flatNumber, isDark);
			return {
				initial: container.flatNumber.charAt(0).toUpperCase(),
				tint
			};
		}
	}
}

/** Minimal spot directory row for chip resolution (what booking loads return). */
export interface SpotDirectoryEntry {
	number: string;
	status: SpotLifecycleStatus;
	flatNumber: string | null;
}

/**
 * Chip props for one spot: lifecycle status + lot tint when assigned.
 * Single definition replacing the per-page copies — same semantics everywhere
 * (unknown spot → null status, assigned without holder → null tint).
 */
export function spotChipProps(
	spots: ReadonlyArray<SpotDirectoryEntry>,
	spotNumber: string,
	isDark: boolean
): { spotStatus: SpotLifecycleStatus | null; spotTint: string | null } {
	const spot = spots.find((s) => s.number === spotNumber);
	const spotStatus = spot?.status ?? null;
	const spotTint = spotStatus === 'assigned' && spot?.flatNumber ? getFlatColor(spot.flatNumber, isDark) : null;
	return { spotStatus, spotTint };
}
