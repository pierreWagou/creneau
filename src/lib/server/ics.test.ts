import { describe, expect, it } from 'vitest';
import { bookingUid, buildICS, escapeICS, toICSDate } from './ics';

describe('toICSDate', () => {
	it('emits floating local time without separators', () => {
		expect(toICSDate('2026-07-24T14:00:00')).toBe('20260724T140000');
	});

	it('rolls a folded midnight end to next-day 00:00 (RFC 5545 has no hour 24)', () => {
		expect(toICSDate('2026-10-15T24:00:00')).toBe('20261016T000000');
		expect(toICSDate('2026-12-31T24:00:00')).toBe('20270101T000000');
	});
});

describe('escapeICS', () => {
	it('escapes backslash, semicolon, comma and newlines', () => {
		expect(escapeICS('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne');
	});
});

describe('buildICS', () => {
	it('builds a published event with stable UID', () => {
		const ics = buildICS({
			uid: bookingUid(7),
			start: '2026-07-24T14:00:00',
			end: '2026-07-24T16:00:00',
			summary: 'Place 36 (lot B12)',
			description: 'Créneau parking',
			method: 'PUBLISH'
		});
		expect(ics).toContain('UID:booking-7@creneau');
		expect(ics).toContain('METHOD:PUBLISH');
		expect(ics).toContain('DTSTART:20260724T140000');
		expect(ics).toContain('DTEND:20260724T160000');
		expect(ics).toContain('SEQUENCE:0');
		expect(ics).toContain('STATUS:CONFIRMED');
		expect(ics).toContain('DESCRIPTION:Cr\u00e9neau parking');
		expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
		expect(ics).toMatch(/END:VCALENDAR\r\n$/);
	});

	it('builds a cancellation with sequence', () => {
		const ics = buildICS({
			uid: bookingUid(7),
			start: '2026-07-24T14:00:00',
			end: '2026-07-24T16:00:00',
			summary: 'Place 36 (lot B12)',
			sequence: 1,
			method: 'CANCEL'
		});
		expect(ics).toContain('METHOD:CANCEL');
		expect(ics).toContain('SEQUENCE:1');
		expect(ics).toContain('STATUS:CANCELLED');
		expect(ics).not.toContain('DESCRIPTION:');
	});
});
