import { describe, expect, it } from 'vitest';
import { displayPhone, formatPhone } from './phone';

describe('formatPhone', () => {
	it('converts national format to E.164', () => {
		expect(formatPhone('0612345678')).toBe('+33612345678');
	});

	it('converts international dialling prefix to +', () => {
		expect(formatPhone('0033612345678')).toBe('+33612345678');
	});

	it('keeps already international format', () => {
		expect(formatPhone('+33612345678')).toBe('+33612345678');
	});

	it('strips spaces and dashes', () => {
		expect(formatPhone('06 12 34 56 78')).toBe('+33612345678');
		expect(formatPhone('06-12-34-56-78')).toBe('+33612345678');
	});

	it('handles parentheses in input', () => {
		expect(formatPhone('(06) 12 34 56 78')).toBe('+33612345678');
	});
});

describe('displayPhone', () => {
	it('formats French E.164 number', () => {
		expect(displayPhone('+33612345678')).toBe('+33 6 12 34 56 78');
	});

	it('formats non-French number with 2-char grouping', () => {
		// countryCode = first 3 chars (+14), rest grouped in pairs
		expect(displayPhone('+14155552671')).toBe('+14 15 55 52 67 1');
	});

	it('returns raw string if too short', () => {
		expect(displayPhone('+1')).toBe('+1');
	});

	it('returns raw string if no + prefix', () => {
		expect(displayPhone('33612345678')).toBe('33612345678');
	});
});
