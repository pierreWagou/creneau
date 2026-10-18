import { MAX_TIMELINE_RANGE_DAYS, MS_PER_DAY, MS_PER_HOUR } from '$lib/constants';
import {
	type AvailableSlot,
	type BookingWithFlat,
	type CalendarDayStatus,
	DAY_END,
	DAY_START,
	getTimelineStatus,
	type SpotTimeline
} from '$lib/types';
import { dayBounds, isoDateKey, noonDate, padH, timeKey } from '$lib/utils/time';
import { getBookingsInRange } from './bookings';

// ============================================================
// SpotTimeline — pure computation (no DB access)
// ============================================================

/**
 * Bound an availability window (`from`/`to` ISO date-times). Over-long ranges
 * answer 400 instead of pulling unbounded rows; anything else (including
 * inverted or unparsable ranges, which naturally yield empty results) passes.
 */
export function validateRangeWindow(from: string, to: string): string | null {
	const days = (new Date(to).getTime() - new Date(from).getTime()) / MS_PER_DAY;
	if (Number.isFinite(days) && days > MAX_TIMELINE_RANGE_DAYS) {
		return `Plage trop large (maximum ${MAX_TIMELINE_RANGE_DAYS} jours)`;
	}
	return null;
}

/**
 * Edit mode: drop the booking being moved from the timeline input so its own
 * slot reads free. Owner-or-admin — the owner matches by flat, and admins may
 * edit any booking, so both ghost their target; anyone else matches nothing.
 * Pure function — no DB access.
 */
export function excludeBookingFromTimeline(
	bookings: BookingWithFlat[],
	excludeId: number,
	flatNumber: string | null | undefined,
	isAdmin = false
): BookingWithFlat[] {
	if (!Number.isInteger(excludeId) || !flatNumber) return bookings;
	return bookings.filter((b) => !(b.id === excludeId && (b.flatNumber === flatNumber || isAdmin)));
}

/**
 * Build a SpotTimeline from a list of bookings and a date range.
 * Pure function — no DB access. Computes available slots by subtracting
 * bookings from the bookable timeline.
 */
export function buildSpotTimeline(bookings: BookingWithFlat[], from: string, to: string): SpotTimeline {
	const timeline = buildBookableTimeline(from, to);
	const bookingIntervals = bookings.map((b) => ({ startTime: b.startTime, endTime: b.endTime }));
	const freeIntervals = subtractBookings(timeline, bookingIntervals);
	const available = mergeConsecutiveDays(freeIntervals);

	return { bookings, available };
}

// ============================================================
// Calendar statuses — derived from SpotTimeline per day
// ============================================================

/**
 * Compute day-level status for calendar coloring.
 * Uses SpotTimeline per day:
 * - No bookings → 'free'
 * - Bookings but available slots remain → 'partial'
 * - No available slots → 'full'
 */
export async function getCalendarStatuses(
	from: string,
	to: string,
	spotNumber?: string,
	excludeId: number = NaN,
	flatNumber?: string | null,
	isAdmin = false
): Promise<CalendarDayStatus[]> {
	const allBookings = await getBookingsInRange(from, to, spotNumber);
	// Edit mode: the booking being moved must not paint its own day.
	// Owner-or-admin, like the timeline exclusion above.
	const visible = excludeBookingFromTimeline(allBookings, excludeId, flatNumber, isAdmin);

	const statuses: CalendarDayStatus[] = [];
	const current = new Date(`${from}T12:00:00`);
	const end = new Date(`${to}T12:00:00`);

	while (current <= end) {
		const dateStr = isoDateKey(current);
		const { start: dayStartStr, end: dayEndStr } = dayBounds(dateStr);

		// Filter bookings that overlap this day
		const dayBookings = visible.filter((b) => b.startTime < dayEndStr && b.endTime > dayStartStr);

		const timeline = buildSpotTimeline(dayBookings, dateStr, dateStr);
		const totalMs = (DAY_END - DAY_START) * MS_PER_HOUR;
		statuses.push({
			date: dateStr,
			status: getTimelineStatus(timeline),
			ratio: dayRatioFromFree(timeline.available, totalMs)
		});
		current.setDate(current.getDate() + 1);
	}

	return statuses;
}

// ============================================================
// Internal helpers
// ============================================================

/**
 * Booked share of a day from its free intervals (pure): 0 (fully free) … 1
 * (fully booked). Snaps float dust at the top end so full days paint solid.
 */
export function dayRatioFromFree(free: { start: string; end: string }[], totalMs: number): number {
	if (totalMs <= 0) return 0;
	const freeMs = free.reduce((sum, i) => sum + Math.max(0, new Date(i.end).getTime() - new Date(i.start).getTime()), 0);
	const ratio = 1 - freeMs / totalMs;
	if (ratio >= 0.999) return 1;
	return Math.min(1, Math.max(0, ratio));
}

/**
 * Build the raw bookable timeline: one interval per day [DAY_START, DAY_END].
 */
function buildBookableTimeline(from: string, to: string): { start: string; end: string }[] {
	const intervals: { start: string; end: string }[] = [];
	const current = noonDate(from);
	const end = noonDate(to);

	while (current <= end) {
		const dateStr = isoDateKey(current);
		intervals.push(dayBounds(dateStr));
		current.setDate(current.getDate() + 1);
	}

	return intervals;
}

/**
 * Subtract bookings from a list of time intervals.
 * Returns the remaining free intervals.
 */
function subtractBookings(
	intervals: { start: string; end: string }[],
	bookings: { startTime: string; endTime: string }[]
): { start: string; end: string }[] {
	const sorted = [...bookings].sort((a, b) => a.startTime.localeCompare(b.startTime));

	let free: { start: string; end: string }[] = [...intervals];

	for (const bk of sorted) {
		const next: { start: string; end: string }[] = [];
		for (const interval of free) {
			if (bk.endTime <= interval.start || bk.startTime >= interval.end) {
				next.push(interval);
				continue;
			}
			if (bk.startTime > interval.start) {
				next.push({ start: interval.start, end: bk.startTime });
			}
			if (bk.endTime < interval.end) {
				next.push({ start: bk.endTime, end: interval.end });
			}
		}
		free = next;
	}

	return free;
}

/**
 * Merge consecutive free intervals into a single AvailableSlot.
 * Two intervals are consecutive if first ends at DAY_END on day N
 * and second starts at DAY_START on day N+1.
 */
function mergeConsecutiveDays(intervals: { start: string; end: string }[]): AvailableSlot[] {
	if (intervals.length === 0) return [];

	const sorted = [...intervals].sort((a, b) => a.start.localeCompare(b.start));
	const merged: AvailableSlot[] = [{ start: sorted[0].start, end: sorted[0].end }];

	for (let i = 1; i < sorted.length; i++) {
		const prev = merged[merged.length - 1];
		const curr = sorted[i];

		if (areConsecutiveDays(prev.end, curr.start)) {
			prev.end = curr.end;
		} else {
			merged.push({ start: curr.start, end: curr.end });
		}
	}

	return merged;
}

/**
 * Check if two timestamps represent consecutive day boundaries.
 * Calendar-day adjacency computed in UTC: immune to DST (a 23/24/25h local
 * day is still exactly one calendar day). Wall-clock diffs break on the
 * spring-forward/fallback Sundays (e.g. Oct 25, 2026).
 */
function areConsecutiveDays(prevEnd: string, currStart: string): boolean {
	const prevEndTime = timeKey(prevEnd);
	const currStartTime = timeKey(currStart);

	if (prevEndTime !== `${padH(DAY_END)}:00:00`) return false;
	if (currStartTime !== `${padH(DAY_START)}:00:00`) return false;

	const [py, pm, pd] = prevEnd.split('T')[0].split('-').map(Number);
	const [cy, cm, cd] = currStart.split('T')[0].split('-').map(Number);
	return Date.UTC(cy, cm - 1, cd) - Date.UTC(py, pm - 1, pd) === MS_PER_DAY;
}
