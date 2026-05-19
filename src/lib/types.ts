// ============================================================
// Global constants
// ============================================================

/** Start of bookable day (hour) */
export const DAY_START = 0;

/** End of bookable day (hour) */
export const DAY_END = 24;

// ============================================================
// Types
// ============================================================

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
}

/** Booking data joined with flat info */
export interface BookingWithFlat {
	id: number;
	spotId: number;
	flatId: number;
	startTime: string;
	endTime: string;
	note: string | null;
	createdAt: string;
	flatNumber: string;
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
