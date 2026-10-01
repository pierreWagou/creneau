import { describe, expect, it } from 'vitest';
import { isValidEmail, isValidPhone } from './validation';

describe('isValidEmail', () => {
	it('accepts standard addresses', () => {
		expect(isValidEmail('dupont@email.com')).toBe(true);
		expect(isValidEmail('jean.dupont+tag@example.co.uk')).toBe(true);
	});

	it('rejects malformed addresses', () => {
		expect(isValidEmail('')).toBe(false);
		expect(isValidEmail('dupont')).toBe(false);
		expect(isValidEmail('dupont@')).toBe(false);
		expect(isValidEmail('dupont@email')).toBe(false);
		expect(isValidEmail('dupont @email.com')).toBe(false);
	});
});

describe('isValidPhone', () => {
	it('accepts digits, spaces, dashes, plus and parentheses', () => {
		expect(isValidPhone('+33612345678')).toBe(true);
		expect(isValidPhone('+33 6 12 34 56 78')).toBe(true);
		expect(isValidPhone('06-12-34-56-78')).toBe(true);
		expect(isValidPhone('(06) 12 34 56 78')).toBe(true);
	});

	it('rejects letters and other characters', () => {
		expect(isValidPhone('')).toBe(false);
		expect(isValidPhone('06AB123456')).toBe(false);
		expect(isValidPhone('+33 6.12.34.56.78')).toBe(false);
	});
});
