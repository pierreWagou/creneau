import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MS_PER_DAY } from '$lib/constants';
import type { BookingWithFlat } from '$lib/types';
import {
	buildSpotTimeline,
	dayRatioFromFree,
	excludeBookingFromTimeline,
	getCalendarStatuses,
	validateRangeWindow
} from './availability';
import { getBookingsInRange } from './bookings';

vi.mock('./bookings', () => ({
	getBookingsInRange: vi.fn()
}));

function makeBooking(overrides: Partial<BookingWithFlat> & { startTime: string; endTime: string }): BookingWithFlat {
	return {
		id: 1,
		spotNumber: '36',
		flatNumber: 'B23',
		note: null,
		createdAt: '2026-01-01T00:00:00',
		status: 'active',
		flatDisplayName: null,
		...overrides
	};
}

describe('buildSpotTimeline', () => {
	describe('single day, no bookings', () => {
		it('returns the full day as one available slot', () => {
			const timeline = buildSpotTimeline([], '2026-05-19', '2026-05-19');

			expect(timeline.bookings).toHaveLength(0);
			expect(timeline.available).toHaveLength(1);
			expect(timeline.available[0]).toEqual({
				start: '2026-05-19T00:00:00',
				end: '2026-05-19T24:00:00'
			});
		});
	});

	describe('single day, one booking in the middle', () => {
		it('returns two free slots around the booking', () => {
			const bookings = [makeBooking({ startTime: '2026-05-19T10:00:00', endTime: '2026-05-19T14:00:00' })];

			const timeline = buildSpotTimeline(bookings, '2026-05-19', '2026-05-19');

			expect(timeline.bookings).toHaveLength(1);
			expect(timeline.available).toHaveLength(2);
			expect(timeline.available[0]).toEqual({
				start: '2026-05-19T00:00:00',
				end: '2026-05-19T10:00:00'
			});
			expect(timeline.available[1]).toEqual({
				start: '2026-05-19T14:00:00',
				end: '2026-05-19T24:00:00'
			});
		});
	});

	describe('single day, booking covers full day', () => {
		it('returns no available slots', () => {
			const bookings = [makeBooking({ startTime: '2026-05-19T00:00:00', endTime: '2026-05-19T24:00:00' })];

			const timeline = buildSpotTimeline(bookings, '2026-05-19', '2026-05-19');

			expect(timeline.bookings).toHaveLength(1);
			expect(timeline.available).toHaveLength(0);
		});
	});

	describe('single day, multiple bookings', () => {
		it('returns free slots between bookings', () => {
			const bookings = [
				makeBooking({ id: 1, startTime: '2026-05-19T08:00:00', endTime: '2026-05-19T10:00:00' }),
				makeBooking({ id: 2, startTime: '2026-05-19T14:00:00', endTime: '2026-05-19T18:00:00' })
			];

			const timeline = buildSpotTimeline(bookings, '2026-05-19', '2026-05-19');

			expect(timeline.bookings).toHaveLength(2);
			expect(timeline.available).toHaveLength(3);
			expect(timeline.available[0]).toEqual({ start: '2026-05-19T00:00:00', end: '2026-05-19T08:00:00' });
			expect(timeline.available[1]).toEqual({ start: '2026-05-19T10:00:00', end: '2026-05-19T14:00:00' });
			expect(timeline.available[2]).toEqual({ start: '2026-05-19T18:00:00', end: '2026-05-19T24:00:00' });
		});
	});

	describe('multi-day, no bookings', () => {
		it('merges consecutive free days into one slot', () => {
			const timeline = buildSpotTimeline([], '2026-05-19', '2026-05-21');

			expect(timeline.available).toHaveLength(1);
			expect(timeline.available[0]).toEqual({
				start: '2026-05-19T00:00:00',
				end: '2026-05-21T24:00:00'
			});
		});
	});

	describe('multi-day, booking spans across days', () => {
		it('splits the free time around the multi-day booking', () => {
			const bookings = [makeBooking({ startTime: '2026-05-19T18:00:00', endTime: '2026-05-20T10:00:00' })];

			const timeline = buildSpotTimeline(bookings, '2026-05-19', '2026-05-20');

			expect(timeline.bookings).toHaveLength(1);
			expect(timeline.available).toHaveLength(2);
			expect(timeline.available[0]).toEqual({ start: '2026-05-19T00:00:00', end: '2026-05-19T18:00:00' });
			expect(timeline.available[1]).toEqual({ start: '2026-05-20T10:00:00', end: '2026-05-20T24:00:00' });
		});
	});

	describe('multi-day, booking on middle day blocks merging', () => {
		it('returns separate free slots when a booking breaks continuity', () => {
			const bookings = [makeBooking({ startTime: '2026-05-20T00:00:00', endTime: '2026-05-20T24:00:00' })];

			const timeline = buildSpotTimeline(bookings, '2026-05-19', '2026-05-21');

			expect(timeline.bookings).toHaveLength(1);
			// Day 1 free, day 2 fully booked, day 3 free — no merge possible
			expect(timeline.available).toHaveLength(2);
			expect(timeline.available[0]).toEqual({ start: '2026-05-19T00:00:00', end: '2026-05-19T24:00:00' });
			expect(timeline.available[1]).toEqual({ start: '2026-05-21T00:00:00', end: '2026-05-21T24:00:00' });
		});
	});

	describe('single day, booking at start of day', () => {
		it('returns one free slot after the booking', () => {
			const bookings = [makeBooking({ startTime: '2026-05-19T00:00:00', endTime: '2026-05-19T08:00:00' })];

			const timeline = buildSpotTimeline(bookings, '2026-05-19', '2026-05-19');

			expect(timeline.available).toHaveLength(1);
			expect(timeline.available[0]).toEqual({ start: '2026-05-19T08:00:00', end: '2026-05-19T24:00:00' });
		});
	});

	describe('single day, booking at end of day', () => {
		it('returns one free slot before the booking', () => {
			const bookings = [makeBooking({ startTime: '2026-05-19T20:00:00', endTime: '2026-05-19T24:00:00' })];

			const timeline = buildSpotTimeline(bookings, '2026-05-19', '2026-05-19');

			expect(timeline.available).toHaveLength(1);
			expect(timeline.available[0]).toEqual({ start: '2026-05-19T00:00:00', end: '2026-05-19T20:00:00' });
		});
	});
});

describe('excludeBookingFromTimeline', () => {
	const bookings = [
		makeBooking({ id: 7, flatNumber: 'B23', startTime: '2026-05-19T10:00:00', endTime: '2026-05-19T12:00:00' }),
		makeBooking({ id: 8, flatNumber: 'B24', startTime: '2026-05-19T14:00:00', endTime: '2026-05-19T16:00:00' })
	];

	it("drops the requester's own booking", () => {
		expect(excludeBookingFromTimeline(bookings, 7, 'B23').map((b) => b.id)).toEqual([8]);
	});

	it("keeps another flat's booking even when the id matches", () => {
		expect(excludeBookingFromTimeline(bookings, 8, 'B23').map((b) => b.id)).toEqual([7, 8]);
	});

	it("lets an admin ghost another flat's booking", () => {
		expect(excludeBookingFromTimeline(bookings, 8, 'B23', true).map((b) => b.id)).toEqual([7]);
	});

	it('keeps the owner behavior identical when the admin flag is false', () => {
		expect(excludeBookingFromTimeline(bookings, 7, 'B23', false).map((b) => b.id)).toEqual([8]);
		expect(excludeBookingFromTimeline(bookings, 8, 'B23', false).map((b) => b.id)).toEqual([7, 8]);
	});

	it('ignores unknown ids', () => {
		expect(excludeBookingFromTimeline(bookings, 99, 'B23')).toHaveLength(2);
	});

	it('ignores NaN and missing flat', () => {
		expect(excludeBookingFromTimeline(bookings, NaN, 'B23')).toHaveLength(2);
		expect(excludeBookingFromTimeline(bookings, 7, null)).toHaveLength(2);
		expect(excludeBookingFromTimeline(bookings, 7, undefined)).toHaveLength(2);
	});

	it('frees the whole day through buildSpotTimeline once excluded', () => {
		const own = [
			makeBooking({ id: 7, flatNumber: 'B23', startTime: '2026-05-19T00:00:00', endTime: '2026-05-19T24:00:00' })
		];
		const timeline = buildSpotTimeline(excludeBookingFromTimeline(own, 7, 'B23'), '2026-05-19', '2026-05-19');

		expect(timeline.bookings).toHaveLength(0);
		expect(timeline.available).toHaveLength(1);
	});
});

describe('getCalendarStatuses', () => {
	const day = '2026-05-19';
	const own = makeBooking({
		id: 7,
		flatNumber: 'B23',
		startTime: `${day}T10:00:00`,
		endTime: `${day}T12:00:00`
	});

	beforeEach(() => {
		vi.mocked(getBookingsInRange).mockResolvedValue([own]);
	});

	it('paints partial when the booking counts', async () => {
		const [s] = await getCalendarStatuses(day, day, '36');
		expect(s).toMatchObject({ date: day, status: 'partial' });
		expect(s.ratio).toBeGreaterThan(0);
	});

	it('paints free when the own booking is excluded', async () => {
		const [s] = await getCalendarStatuses(day, day, '36', 7, 'B23');
		expect(s).toMatchObject({ date: day, status: 'free', ratio: 0 });
	});

	it('still paints when the id belongs to another flat', async () => {
		const [s] = await getCalendarStatuses(day, day, '36', 7, 'B24');
		expect(s.status).toBe('partial');
	});
});

describe('dayRatioFromFree', () => {
	const DAY_MS = MS_PER_DAY;
	const iv = (start: string, end: string) => ({ start, end });

	it('returns 0 for a fully free day', () => {
		expect(dayRatioFromFree([iv('2026-10-12T00:00:00', '2026-10-12T24:00:00')], DAY_MS)).toBe(0);
		expect(dayRatioFromFree([], 0)).toBe(0);
	});

	it('returns 1 for a fully booked day', () => {
		expect(dayRatioFromFree([], DAY_MS)).toBe(1);
	});

	it('scales with booked time across intervals', () => {
		expect(dayRatioFromFree([iv('2026-10-12T12:00:00', '2026-10-12T24:00:00')], DAY_MS)).toBe(0.5);
		expect(
			dayRatioFromFree(
				[iv('2026-10-12T00:00:00', '2026-10-12T06:00:00'), iv('2026-10-12T18:00:00', '2026-10-12T24:00:00')],
				DAY_MS
			)
		).toBe(0.5);
	});

	it('snaps float dust and clamps out-of-range input', () => {
		expect(dayRatioFromFree([iv('2026-10-12T00:00:00', '2026-10-12T00:00:01')], DAY_MS)).toBe(1);
		expect(dayRatioFromFree([iv('2026-10-12T00:00:00', '2026-10-13T00:00:00')], DAY_MS)).toBe(0);
	});
});

describe('DST night continuity (mergeConsecutiveDays via buildSpotTimeline)', () => {
	const previousTz = process.env.TZ;

	beforeEach(() => {
		// Load-bearing: UTC runners measure exactly 24h and cannot catch the
		// wall-clock bug — pin Europe/Paris so the fallback/spring Sundays
		// really span 25/23 local hours.
		process.env.TZ = 'Europe/Paris';
	});

	afterEach(() => {
		if (previousTz === undefined) delete process.env.TZ;
		else process.env.TZ = previousTz;
	});

	it('merges across the October fallback Sunday (25h local day)', () => {
		const timeline = buildSpotTimeline([], '2026-10-24', '2026-10-26');
		expect(timeline.available).toHaveLength(1);
		expect(timeline.available[0]).toMatchObject({
			start: '2026-10-24T00:00:00',
			end: '2026-10-26T24:00:00'
		});
	});

	it('merges across the March spring-forward Sunday (23h local day)', () => {
		const timeline = buildSpotTimeline([], '2026-03-28', '2026-03-30');
		expect(timeline.available).toHaveLength(1);
		expect(timeline.available[0]).toMatchObject({
			start: '2026-03-28T00:00:00',
			end: '2026-03-30T24:00:00'
		});
	});
});

describe('validateRangeWindow', () => {
	it('passes normal windows', () => {
		expect(validateRangeWindow('2026-10-01', '2026-10-31')).toBeNull();
	});

	it('refuses over-long ranges instead of pulling unbounded rows', () => {
		expect(validateRangeWindow('2026-01-01', '2026-12-31')).toBe('Plage trop large (maximum 93 jours)');
	});

	it('leaves inverted or unparsable ranges to their natural empty results', () => {
		expect(validateRangeWindow('2026-10-31', '2026-10-01')).toBeNull();
		expect(validateRangeWindow('abc', 'def')).toBeNull();
	});
});
