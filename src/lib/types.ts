// ============================================================
// Global constants
// ============================================================

// Bookable-day bounds live in constants.ts (single home for shared values);
// re-exported here so time-math importers keep a single import source.
export { DAY_END, DAY_START } from './constants';

// ============================================================
// Types
// ============================================================

/** Flat info carried in the session (subset of the full flat record) */
export interface SessionFlat {
	number: string;
	displayName: string | null;
	isAdmin: boolean;
	emails: string[];
	phones: string[];
}

/**
 * An available time range for booking.
 * Can span multiple days — consecutive days are merged into a single slot
 * when the end of one day (DAY_END) meets the start of the next (DAY_START).
 */
export interface AvailableSlot {
	start: string; // ISO datetime, e.g. "2026-05-06T14:00:00"
	end: string; // ISO datetime, e.g. "2026-05-08T10:00:00"
}

/** Day status for calendar coloring */
export interface CalendarDayStatus {
	date: string;
	status: 'free' | 'partial' | 'full';
	/** Booked share of reservable hours, 0 (free) … 1 (fully booked) */
	ratio: number;
}

/** Booking data joined with flat info */
export interface BookingWithFlat {
	id: number;
	spotNumber: string;
	flatNumber: string;
	startTime: string;
	endTime: string;
	note: string | null;
	createdAt: string;
	status: 'active' | 'cancelled';
	flatDisplayName: string | null;
}

/** Full timeline of a spot over a date range */
export interface SpotTimeline {
	bookings: BookingWithFlat[];
	available: AvailableSlot[];
}

/** Derive the day status from a SpotTimeline */
export function getTimelineStatus(timeline: SpotTimeline): 'free' | 'partial' | 'full' {
	if (timeline.bookings.length === 0) return 'free';
	if (timeline.available.length === 0) return 'full';
	return 'partial';
}

/**
 * A spot currently bound to another flat — the 409-conflict contract,
 * single-sourced here for server (`rebind.ts`) and client (`utils/spots.ts`).
 */
export interface SpotConflict {
	spotNumber: string;
	currentFlat: string;
}

/** Rebind 409 payload: optional conflicts plus the failure-only mail flag. */
export interface RebindConflictResult {
	conflicts?: SpotConflict[];
	mailFailed?: boolean;
}
