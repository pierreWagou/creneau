/**
 * Single source for status → badge-class mapping.
 *
 * Every status pill in detail surfaces must come from here (via
 * `<StatusBadge>`) instead of hand-written `bg-*` utilities, so a palette
 * change lands everywhere at once. The mapping preserves the established
 * visuals: bound lots stay neutral gray, limbo stays peach, pool blue.
 */
export type DetailStatus = 'active' | 'pending' | 'inactive' | 'assigned' | 'shared' | 'unassigned' | 'request';

const STATUS_BADGE_CLASS: Record<DetailStatus, string> = {
	active: 'flat-badge-active',
	pending: 'flat-badge-pending',
	inactive: 'flat-badge-inactive',
	// Bound spots show the holder instead of a frame: neutral, like inactive lots
	assigned: 'flat-badge-inactive',
	shared: 'flat-badge-request',
	// Limbo spots share the pending peach (see flat-badge-pending)
	unassigned: 'flat-badge-pending',
	request: 'flat-badge-request'
};

/** Badge class for a lifecycle status (see {@link STATUS_BADGE_CLASS}). */
export function statusBadgeClass(status: DetailStatus): string {
	return STATUS_BADGE_CLASS[status];
}
