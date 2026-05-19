import { describe, it, expect } from 'vitest';
import { buildSpotTimeline } from './availability';
import type { BookingWithFlat } from '$lib/types';

function makeBooking(overrides: Partial<BookingWithFlat> & { startTime: string; endTime: string }): BookingWithFlat {
	return {
		id: 1,
		spotId: 1,
		flatId: 1,
		note: null,
		createdAt: '2026-01-01T00:00:00',
		flatNumber: 'B23',
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
