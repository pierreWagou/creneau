import {
	DAY_START,
	DAY_END,
	type AvailableSlot,
	type CalendarDayStatus,
	type SpotTimeline,
	type BookingWithFlat,
	getTimelineStatus
} from '$lib/types';
import { padH } from '$lib/utils/time';
import { getBookingsInRange } from './bookings';

// ============================================================
// Constants
// ============================================================

const MS_PER_DAY = 86400000;
const BRIDGE_TOLERANCE_MS = 1000;

// ============================================================
// SpotTimeline — pure computation (no DB access)
// ============================================================

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
export async function getCalendarStatuses(from: string, to: string, spotId?: number): Promise<CalendarDayStatus[]> {
	const allBookings = await getBookingsInRange(from, to, spotId);

	const statuses: CalendarDayStatus[] = [];
	const current = new Date(from + 'T12:00:00');
	const end = new Date(to + 'T12:00:00');

	while (current <= end) {
		const dateStr = current.toISOString().split('T')[0];
		const dayStartStr = `${dateStr}T${padH(DAY_START)}:00:00`;
		const dayEndStr = `${dateStr}T${padH(DAY_END)}:00:00`;

		// Filter bookings that overlap this day
		const dayBookings = allBookings.filter((b) => b.startTime < dayEndStr && b.endTime > dayStartStr);

		const timeline = buildSpotTimeline(dayBookings, dateStr, dateStr);
		statuses.push({ date: dateStr, status: getTimelineStatus(timeline) });
		current.setDate(current.getDate() + 1);
	}

	return statuses;
}

// ============================================================
// Internal helpers
// ============================================================

/**
 * Build the raw bookable timeline: one interval per day [DAY_START, DAY_END].
 */
function buildBookableTimeline(from: string, to: string): { start: string; end: string }[] {
	const intervals: { start: string; end: string }[] = [];
	const current = new Date(from + 'T12:00:00');
	const end = new Date(to + 'T12:00:00');

	while (current <= end) {
		const dateStr = current.toISOString().split('T')[0];
		intervals.push({
			start: `${dateStr}T${padH(DAY_START)}:00:00`,
			end: `${dateStr}T${padH(DAY_END)}:00:00`
		});
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
 */
function areConsecutiveDays(prevEnd: string, currStart: string): boolean {
	const prevEndTime = prevEnd.split('T')[1];
	const currStartTime = currStart.split('T')[1];

	if (prevEndTime !== `${padH(DAY_END)}:00:00`) return false;
	if (currStartTime !== `${padH(DAY_START)}:00:00`) return false;

	const prevDate = new Date(prevEnd.split('T')[0] + 'T12:00:00');
	const currDate = new Date(currStart.split('T')[0] + 'T12:00:00');
	const diffMs = currDate.getTime() - prevDate.getTime();

	return Math.abs(diffMs - MS_PER_DAY) < BRIDGE_TOLERANCE_MS;
}
