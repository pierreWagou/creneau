import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	bookingHours,
	bookingStatusPill,
	computeUtilization,
	findBookingById,
	splitBookingsByLiveness
} from './bookings';

function booking(id: number, startTime: string, endTime: string) {
	return { id, startTime, endTime };
}

describe('splitBookingsByLiveness', () => {
	it('splits into ongoing/upcoming/past with stable orders', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-10-09T12:00:00'));
		try {
			const list = [
				booking(1, '2026-10-20T10:00:00', '2026-10-20T12:00:00'),
				booking(2, '2026-10-01T10:00:00', '2026-10-01T12:00:00'),
				booking(3, '2026-10-09T10:00:00', '2026-10-09T14:00:00'),
				booking(4, '2026-10-15T10:00:00', '2026-10-15T12:00:00'),
				booking(5, '2026-09-20T10:00:00', '2026-09-20T12:00:00')
			];
			const { ongoing, upcoming, past } = splitBookingsByLiveness(list);

			expect(ongoing.map((b) => b.id)).toEqual([3]);
			expect(upcoming.map((b) => b.id)).toEqual([4, 1]);
			expect(past.map((b) => b.id)).toEqual([2, 5]);
		} finally {
			vi.useRealTimers();
		}
	});

	it('returns empty slices for an empty list', () => {
		expect(splitBookingsByLiveness([])).toEqual({ ongoing: [], upcoming: [], past: [] });
	});
});

describe('computeUtilization', () => {
	it('divides booked hours by shared-spot capacity with one decimal', () => {
		// 30h booked over 31 days × 24h × 3 shared spots ≈ 1.34% → 1.3
		expect(computeUtilization(30, 3, 31)).toBe(1.3);
	});

	it('returns 0 without capacity (no spots, no days)', () => {
		expect(computeUtilization(30, 0, 31)).toBe(0);
		expect(computeUtilization(30, 3, 0)).toBe(0);
		expect(computeUtilization(0, 3, 31)).toBe(0);
	});
});

describe('bookingStatusPill', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-10-09T12:00:00'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('marks past bookings grey', () => {
		expect(bookingStatusPill('2026-10-01T10:00:00', '2026-10-01T12:00:00')).toEqual({
			label: 'Passée',
			className: 'bg-foreground on-solid'
		});
	});

	it('marks ongoing bookings blue', () => {
		expect(bookingStatusPill('2026-10-09T10:00:00', '2026-10-09T14:00:00')).toEqual({
			label: 'En cours',
			className: 'bg-primary on-solid'
		});
	});

	it("marks today's upcoming bookings green", () => {
		expect(bookingStatusPill('2026-10-09T14:00:00', '2026-10-09T16:00:00')).toEqual({
			label: "Aujourd'hui",
			className: 'bg-success on-solid'
		});
	});

	it("marks tomorrow's bookings green", () => {
		expect(bookingStatusPill('2026-10-10T10:00:00', '2026-10-10T12:00:00')).toEqual({
			label: 'Demain',
			className: 'bg-success on-solid'
		});
	});

	it('marks later bookings green with a day count', () => {
		expect(bookingStatusPill('2026-10-15T10:00:00', '2026-10-15T12:00:00')).toEqual({
			label: 'Dans 6 j',
			className: 'bg-success on-solid'
		});
	});

	it('marks cancelled bookings red whatever their dates', () => {
		expect(bookingStatusPill('2026-10-15T10:00:00', '2026-10-15T12:00:00', 'cancelled')).toEqual({
			label: 'Annulée',
			className: 'bg-destructive on-solid'
		});
		expect(bookingStatusPill('2026-10-01T10:00:00', '2026-10-01T12:00:00', 'cancelled')).toEqual({
			label: 'Annulée',
			className: 'bg-destructive on-solid'
		});
	});
});

describe('bookingHours', () => {
	it('divides the duration by the hour', () => {
		expect(bookingHours('2026-10-17T10:00:00', '2026-10-17T12:00:00')).toBe(2);
		expect(bookingHours('2026-10-17T10:00:00', '2026-10-17T10:30:00')).toBe(0.5);
	});
});

describe('findBookingById', () => {
	const list = [{ id: 7 }, { id: 8 }];
	it('finds by id in a loaded list', () => {
		expect(findBookingById(list, 8)).toEqual({ id: 8 });
		expect(findBookingById(list, 9)).toBeUndefined();
	});

	it('answers undefined for nullish ids', () => {
		expect(findBookingById(list, null)).toBeUndefined();
		expect(findBookingById(list, undefined)).toBeUndefined();
	});
});
