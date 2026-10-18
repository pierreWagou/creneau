import { describe, expect, it, vi } from 'vitest';
import {
	bookingLiveness,
	countdownLabel,
	dateKey,
	dayBounds,
	foldMidnightEnd,
	formatBookingEndFr,
	formatBookingRangeFr,
	formatCountdownDuration,
	formatDateISO,
	formatDateShortFr,
	formatDuration,
	getHourFromISO,
	isMidnightEnd,
	isoDateKey,
	noonDate,
	padH,
	parseFrDateInput,
	TIME_BLOCKS,
	timeKey,
	toISOLocal
} from './time';

describe('padH', () => {
	it('pads single digits', () => {
		expect(padH(7)).toBe('07');
		expect(padH(0)).toBe('00');
		expect(padH(24)).toBe('24');
	});
});

describe('getHourFromISO', () => {
	it('extracts the hour', () => {
		expect(getHourFromISO('2026-05-06T14:00:00')).toBe(14);
		expect(getHourFromISO('2026-05-06T00:30:00')).toBe(0);
	});

	it('defaults malformed input to 0', () => {
		expect(getHourFromISO('nope')).toBe(0);
	});
});

describe('formatDateISO', () => {
	it('formats YYYY-MM-DD without timezone shift (noon trick)', () => {
		// Midnight local on a DST boundary must not slip to the previous day
		expect(formatDateISO(new Date(2026, 2, 29, 0, 0, 0))).toBe('2026-03-29');
		expect(formatDateISO(new Date(2026, 4, 6, 23, 59, 59))).toBe('2026-05-06');
	});
});

describe('formatDuration', () => {
	it('renders hours below a day', () => {
		expect(formatDuration('2026-05-06T14:00:00', '2026-05-06T17:00:00')).toBe('3h');
	});

	it('renders days with French plural', () => {
		expect(formatDuration('2026-05-06T14:00:00', '2026-05-07T14:00:00')).toBe('1 jour');
		expect(formatDuration('2026-05-06T14:00:00', '2026-05-08T15:00:00')).toBe('3 jours');
	});
});

describe('TIME_BLOCKS', () => {
	it('covers morning/afternoon/evening with French labels', () => {
		expect(TIME_BLOCKS.morning.label).toBe('Matin');
		expect(TIME_BLOCKS.afternoon.label).toBe('Après-midi');
		expect(TIME_BLOCKS.evening.label).toBe('Soirée');
	});
});

describe('bookingLiveness', () => {
	it('classifies past, ongoing and upcoming slots', () => {
		expect(bookingLiveness('2000-01-01T10:00:00', '2000-01-01T12:00:00')).toBe('past');
		const now = Date.now();
		const past = new Date(now - 3600000).toISOString();
		const future = new Date(now + 3600000).toISOString();
		expect(bookingLiveness(past, future)).toBe('ongoing');
		expect(bookingLiveness(future, new Date(now + 7200000).toISOString())).toBe('upcoming');
	});
});

describe('countdownLabel', () => {
	it('returns null for past slots', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-07-24T18:00:00'));
		expect(countdownLabel('2026-07-24T10:00:00', '2026-07-24T12:00:00')).toBeNull();
		vi.useRealTimers();
	});

	it('counts minutes, hours and days', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-07-24T09:00:00'));
		expect(countdownLabel('2026-07-24T09:25:00', '2026-07-24T10:00:00')).toBe('Commence dans 25min');
		expect(countdownLabel('2026-07-24T12:05:00', '2026-07-24T13:00:00')).toBe('Commence dans 3h05');
		expect(countdownLabel('2026-07-27T09:00:00', '2026-07-27T10:00:00')).toBe('Commence dans 3j');
		expect(countdownLabel('2026-07-24T08:00:00', '2026-07-24T09:30:00')).toBe('Se termine dans 30min');
		vi.useRealTimers();
	});
});

describe('parseFrDateInput', () => {
	it('parses numeric dates with / - . separators', () => {
		expect(parseFrDateInput('12/10/2026')).toBe('2026-10-12');
		expect(parseFrDateInput('12-10-2026')).toBe('2026-10-12');
		expect(parseFrDateInput('12.10.2026')).toBe('2026-10-12');
		expect(parseFrDateInput(' 1/2/2027 ')).toBe('2027-02-01');
	});

	it('parses French month names, case- and accent-insensitive', () => {
		expect(parseFrDateInput('12 octobre 2026')).toBe('2026-10-12');
		expect(parseFrDateInput('12 Octobre 2026')).toBe('2026-10-12');
		expect(parseFrDateInput('12 oct. 2026')).toBe('2026-10-12');
		expect(parseFrDateInput('1er janvier 2027')).toBe('2027-01-01');
		expect(parseFrDateInput('15 AOUT 2026')).toBe('2026-08-15');
		expect(parseFrDateInput('15 août 2026')).toBe('2026-08-15');
		expect(parseFrDateInput('29 fevrier 2024')).toBe('2024-02-29');
	});

	it('rejects impossible dates and garbage', () => {
		expect(parseFrDateInput('')).toBeNull();
		expect(parseFrDateInput('demain')).toBeNull();
		expect(parseFrDateInput('2026-10-12')).toBeNull();
		expect(parseFrDateInput('30/02/2026')).toBeNull();
		expect(parseFrDateInput('29/02/2025')).toBeNull();
		expect(parseFrDateInput('32/01/2026')).toBeNull();
		expect(parseFrDateInput('12/13/2026')).toBeNull();
		expect(parseFrDateInput('12 octobrr 2026')).toBeNull();
	});
});

describe('formatDateShortFr', () => {
	it('formats compactly in French', () => {
		expect(formatDateShortFr('2026-10-12')).toBe(
			new Date('2026-10-12T12:00:00').toLocaleDateString('fr-FR', {
				day: 'numeric',
				month: 'short',
				year: 'numeric'
			})
		);
	});
});

describe('foldMidnightEnd', () => {
	it('folds a next-day 00:00 end to same-day 24:00', () => {
		expect(foldMidnightEnd('2026-10-15T18:00:00', '2026-10-16T00:00:00')).toBe('2026-10-15T24:00:00');
	});

	it('folds genuine multi-day ends onto the previous day', () => {
		expect(foldMidnightEnd('2026-10-15T18:00:00', '2026-10-17T00:00:00')).toBe('2026-10-16T24:00:00');
	});

	it('folds midnight-to-midnight to a single 00:00–24:00 day', () => {
		expect(foldMidnightEnd('2026-10-16T00:00:00', '2026-10-17T00:00:00')).toBe('2026-10-16T24:00:00');
	});

	it('crosses month boundaries', () => {
		expect(foldMidnightEnd('2026-02-28T18:00:00', '2026-03-01T00:00:00')).toBe('2026-02-28T24:00:00');
	});

	it('leaves same-day and non-midnight ends untouched', () => {
		expect(foldMidnightEnd('2026-10-15T10:00:00', '2026-10-15T00:00:00')).toBe('2026-10-15T00:00:00');
		expect(foldMidnightEnd('2026-10-15T10:00:00', '2026-10-15T14:00:00')).toBe('2026-10-15T14:00:00');
		expect(foldMidnightEnd('2026-10-15T10:00:00', '2026-10-16T10:00:00')).toBe('2026-10-16T10:00:00');
	});

	it('preserves the instant (folded form equals the midnight instant)', () => {
		const folded = foldMidnightEnd('2026-10-15T18:00:00', '2026-10-16T00:00:00');
		expect(new Date(folded).getTime()).toBe(new Date('2026-10-16T00:00:00').getTime());
		expect(formatDuration('2026-10-15T18:00:00', folded)).toBe('6h');
	});
});

describe('isMidnightEnd', () => {
	it('detects the folded form only', () => {
		expect(isMidnightEnd('2026-10-15T24:00:00')).toBe(true);
		expect(isMidnightEnd('2026-10-16T00:00:00')).toBe(false);
		expect(isMidnightEnd('2026-10-15T14:00:00')).toBe(false);
	});
});

describe('formatBookingEndFr', () => {
	it('renders folded ends as same-day 24:00', () => {
		expect(formatBookingEndFr('2026-10-15T24:00:00')).toBe('15 oct., 24:00');
		expect(formatBookingEndFr('2026-10-15T24:00:00', 'long')).toBe('jeudi 15 octobre, 24h00');
	});

	it('renders other ends like the standard formatters', () => {
		expect(formatBookingEndFr('2026-10-16T00:00:00')).toBe('16 oct., 00:00');
		expect(formatBookingEndFr('2026-10-15T14:00:00', 'long')).toBe('jeudi 15 octobre, 14h00');
	});
});

describe('formatBookingRangeFr', () => {
	it('renders a folded midnight end as the same day, never ranging', () => {
		const title = formatBookingRangeFr('2026-10-17T10:00:00', '2026-10-17T24:00:00');
		expect(title).toContain('17 oct.');
		expect(title).not.toContain('→');
	});

	it('renders a plain midnight end as the prior day, never ranging', () => {
		const title = formatBookingRangeFr('2026-10-17T22:00:00', '2026-10-18T00:00:00');
		expect(title).toContain('17 oct.');
		expect(title).not.toContain('→');
	});

	it('ranges genuine multi-day bookings', () => {
		expect(formatBookingRangeFr('2026-10-17T10:00:00', '2026-10-19T10:00:00')).toBe('17 → 19 oct.');
		expect(formatBookingRangeFr('2026-10-30T10:00:00', '2026-11-02T10:00:00')).toBe('30 oct. → 2 nov.');
	});

	it('renders a multi-day folded end on its own date, not the next', () => {
		const title = formatBookingRangeFr('2026-10-17T18:00:00', '2026-10-18T24:00:00');
		expect(title).toBe('17 → 18 oct.');
	});

	it('renders single days with the weekday', () => {
		expect(formatBookingRangeFr('2026-10-17T10:00:00', '2026-10-17T16:00:00')).toContain('sam.');
	});
});

describe('dateKey', () => {
	it('returns the calendar-day part of an ISO datetime', () => {
		expect(dateKey('2026-10-17T14:00:00')).toBe('2026-10-17');
		expect(dateKey('2026-10-17T24:00:00')).toBe('2026-10-17');
	});
});

describe('dayBounds', () => {
	it('returns the bookable bounds of a calendar day', () => {
		expect(dayBounds('2026-10-17')).toEqual({
			start: '2026-10-17T00:00:00',
			end: '2026-10-17T24:00:00'
		});
	});
});

describe('noonDate', () => {
	it('anchors at local noon (DST-immune day iteration)', () => {
		const d = noonDate('2026-10-25');
		expect(d.getFullYear()).toBe(2026);
		expect(d.getMonth()).toBe(9);
		expect(d.getDate()).toBe(25);
		expect(d.getHours()).toBe(12);
	});
});

describe('isoDateKey', () => {
	it('returns the UTC calendar-day part of a Date', () => {
		expect(isoDateKey(new Date(Date.UTC(2026, 9, 17, 12)))).toBe('2026-10-17');
	});
});

describe('timeKey', () => {
	it('returns the time part of an ISO datetime', () => {
		expect(timeKey('2026-10-17T14:00:00')).toBe('14:00:00');
		expect(timeKey('2026-10-17T24:00:00')).toBe('24:00:00');
	});
});

describe('toISOLocal', () => {
	it('formats a Date as a local ISO datetime', () => {
		expect(toISOLocal(new Date(2026, 9, 17, 9, 5))).toBe('2026-10-17T09:05:00');
		expect(toISOLocal(new Date(2026, 9, 17, 0, 0))).toBe('2026-10-17T00:00:00');
	});
});

describe('formatCountdownDuration', () => {
	it('phrases minutes below one hour', () => {
		expect(formatCountdownDuration(25 * 60_000)).toBe('25min');
		expect(formatCountdownDuration(0)).toBe('0min');
	});

	it('phrases hours with padded minutes below 48h', () => {
		expect(formatCountdownDuration(3 * 3_600_000 + 12 * 60_000)).toBe('3h12');
		expect(formatCountdownDuration(47 * 3_600_000)).toBe('47h00');
	});

	it('phrases days at and above 48h', () => {
		expect(formatCountdownDuration(48 * 3_600_000)).toBe('2j');
		expect(formatCountdownDuration(50 * 3_600_000)).toBe('2j');
	});
});

describe('parseFrDateInput', () => {
	it('rejects impossible calendar dates', () => {
		expect(parseFrDateInput('29/02/2025')).toBeNull();
		expect(parseFrDateInput('31 avr 2026')).toBeNull();
		expect(parseFrDateInput('32/01/2026')).toBeNull();
	});

	it('accepts Feb 29 on leap years', () => {
		expect(parseFrDateInput('29/02/2024')).toBe('2024-02-29');
	});
});
