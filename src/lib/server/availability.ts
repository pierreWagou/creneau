import { db } from './db';
import { booking, flat } from './db/schema';
import { eq, and, lt, gt } from 'drizzle-orm';
import { DAY_START, DAY_END, DAY_TOTAL_MINUTES, type AvailableSlot, type CalendarDayStatus } from '$lib/types';
import { padH } from '$lib/utils/time';

// ============================================================
// Constants
// ============================================================

const MS_PER_DAY = 86400000;
const BRIDGE_TOLERANCE_MS = 1000;
const FULL_DAY_TOLERANCE_MINUTES = 30;

// ============================================================
// Available slots computation
// ============================================================

/**
 * Compute available slots for a date range on a given slot.
 *
 * Returns a list of AvailableSlot (ISO datetime ranges) representing
 * contiguous free time. Consecutive free days are merged into a single slot.
 */
export async function getAvailableSlots(
	from: string,
	to: string,
	slotId: number
): Promise<AvailableSlot[]> {
	const fromDateTime = `${from}T${padH(DAY_START)}:00:00`;
	const toDateTime = `${to}T${padH(DAY_END)}:00:00`;

	// Fetch all bookings overlapping the range
	const bookings = await db
		.select({
			startTime: booking.startTime,
			endTime: booking.endTime
		})
		.from(booking)
		.where(
			and(
				eq(booking.slotId, slotId),
				lt(booking.startTime, toDateTime),
				gt(booking.endTime, fromDateTime)
			)
		)
		.all();

	// Build the bookable timeline: for each day, [DAY_START, DAY_END]
	const timeline = buildBookableTimeline(from, to);

	// Subtract bookings from the timeline
	const freeIntervals = subtractBookings(timeline, bookings);

	// Merge consecutive intervals that are bridged by overnight gaps
	return mergeConsecutiveDays(freeIntervals);
}

/**
 * Build the raw bookable timeline: one interval per day [DAY_START, DAY_END].
 */
function buildBookableTimeline(from: string, to: string): { start: string; end: string }[] {
	const intervals: { start: string; end: string }[] = [];
	const current = new Date(from + 'T12:00:00'); // Use noon to avoid timezone issues
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
	// Sort bookings by start time
	const sorted = [...bookings].sort((a, b) => a.startTime.localeCompare(b.startTime));

	let free: { start: string; end: string }[] = [...intervals];

	for (const bk of sorted) {
		const next: { start: string; end: string }[] = [];
		for (const interval of free) {
			// No overlap
			if (bk.endTime <= interval.start || bk.startTime >= interval.end) {
				next.push(interval);
				continue;
			}
			// Booking overlaps — split interval
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
 *
 * Two intervals are consecutive if:
 * - First ends at DAY_END on day N
 * - Second starts at DAY_START on day N+1
 */
function mergeConsecutiveDays(intervals: { start: string; end: string }[]): AvailableSlot[] {
	if (intervals.length === 0) return [];

	// Sort by start time
	const sorted = [...intervals].sort((a, b) => a.start.localeCompare(b.start));

	const merged: AvailableSlot[] = [{ start: sorted[0].start, end: sorted[0].end }];

	for (let i = 1; i < sorted.length; i++) {
		const prev = merged[merged.length - 1];
		const curr = sorted[i];

		if (areConsecutiveDays(prev.end, curr.start)) {
			// Merge: extend prev to cover curr
			prev.end = curr.end;
		} else {
			merged.push({ start: curr.start, end: curr.end });
		}
	}

	return merged;
}

/**
 * Check if two timestamps represent consecutive day boundaries.
 * i.e., prevEnd is DAY_END on day N, and currStart is DAY_START on day N+1.
 */
function areConsecutiveDays(prevEnd: string, currStart: string): boolean {
	const prevEndTime = prevEnd.split('T')[1];
	const currStartTime = currStart.split('T')[1];

	if (prevEndTime !== `${padH(DAY_END)}:00:00`) return false;
	if (currStartTime !== `${padH(DAY_START)}:00:00`) return false;

	// Check dates are consecutive
	const prevDate = new Date(prevEnd.split('T')[0] + 'T12:00:00');
	const currDate = new Date(currStart.split('T')[0] + 'T12:00:00');
	const diffMs = currDate.getTime() - prevDate.getTime();

	return Math.abs(diffMs - MS_PER_DAY) < BRIDGE_TOLERANCE_MS;
}

// ============================================================
// Calendar statuses (for coloring)
// ============================================================

/**
 * Compute day-level status for calendar coloring.
 * Simple: count booked minutes per day → free/partial/full.
 */
export async function getCalendarStatuses(
	from: string,
	to: string,
	slotId?: number
): Promise<CalendarDayStatus[]> {
	const fromDateTime = `${from}T00:00:00`;
	const toDateTime = `${to}T23:59:59`;

	const conditions = [lt(booking.startTime, toDateTime), gt(booking.endTime, fromDateTime)];
	if (slotId) {
		conditions.push(eq(booking.slotId, slotId));
	}

	const bookings = await db
		.select({
			startTime: booking.startTime,
			endTime: booking.endTime
		})
		.from(booking)
		.where(and(...conditions))
		.all();

	const statuses: CalendarDayStatus[] = [];
	const current = new Date(from + 'T12:00:00');
	const end = new Date(to + 'T12:00:00');

	while (current <= end) {
		const dateStr = current.toISOString().split('T')[0];
		const dayStartStr = `${dateStr}T${padH(DAY_START)}:00:00`;
		const dayEndStr = `${dateStr}T${padH(DAY_END)}:00:00`;

		// Sum booked minutes for this day
		let bookedMinutes = 0;
		for (const b of bookings) {
			if (b.startTime >= dayEndStr || b.endTime <= dayStartStr) continue;
			const clampedStart = b.startTime < dayStartStr ? dayStartStr : b.startTime;
			const clampedEnd = b.endTime > dayEndStr ? dayEndStr : b.endTime;
			bookedMinutes += (new Date(clampedEnd).getTime() - new Date(clampedStart).getTime()) / (1000 * 60);
		}

		let status: 'free' | 'partial' | 'full';
		if (bookedMinutes === 0) {
			status = 'free';
		} else if (bookedMinutes >= DAY_TOTAL_MINUTES - FULL_DAY_TOLERANCE_MINUTES) {
			status = 'full';
		} else {
			status = 'partial';
		}

		statuses.push({ date: dateStr, status });
		current.setDate(current.getDate() + 1);
	}

	return statuses;
}
