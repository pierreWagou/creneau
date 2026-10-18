import { describe, expect, it } from 'vitest';
import { getTimelineStatus, type SpotTimeline } from './types';

function timeline(bookings: number, available: number): SpotTimeline {
	return {
		bookings: Array.from({ length: bookings }, (_, i) => ({
			id: i,
			spotNumber: '36',
			flatNumber: 'B12',
			startTime: '2026-10-17T10:00:00',
			endTime: '2026-10-17T12:00:00',
			note: null,
			createdAt: '2026-10-01T00:00:00',
			status: 'active' as const,
			flatDisplayName: null
		})),
		available: Array.from({ length: available }, () => ({
			start: '2026-10-17T00:00:00',
			end: '2026-10-17T24:00:00'
		}))
	};
}

describe('getTimelineStatus', () => {
	it('is free with no bookings', () => {
		expect(getTimelineStatus(timeline(0, 1))).toBe('free');
	});

	it('is full with no available slots', () => {
		expect(getTimelineStatus(timeline(2, 0))).toBe('full');
	});

	it('is partial otherwise', () => {
		expect(getTimelineStatus(timeline(1, 1))).toBe('partial');
	});
});
