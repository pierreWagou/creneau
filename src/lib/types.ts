// ============================================================
// Global constants
// ============================================================

/** Start of bookable day (hour) */
export const DAY_START = 7;

/** End of bookable day (hour) */
export const DAY_END = 22;

/** Total bookable minutes in a day */
export const DAY_TOTAL_MINUTES = (DAY_END - DAY_START) * 60;

// ============================================================
// Types
// ============================================================

/**
 * An available time range for booking.
 * Can span multiple days (overnight 22:00→07:00 is implicitly bridged).
 * Start and end are ISO datetime strings representing actual bookable boundaries.
 */
export interface AvailableSlot {
	start: string; // e.g. "2026-05-06T14:00:00"
	end: string; // e.g. "2026-05-08T10:00:00"
}

/** Day status for calendar coloring */
export interface CalendarDayStatus {
	date: string;
	status: 'free' | 'partial' | 'full';
}

/** Booking info for calendar display */
export interface BookingForCalendar {
	id: number;
	startTime: string;
	endTime: string;
	flatNumber: string;
	flatDisplayName: string | null;
}
