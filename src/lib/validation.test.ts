import { describe, expect, it } from 'vitest';
import { isValidEmail, isValidPhone, toWhatsAppNumber } from './validation';

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

describe('toWhatsAppNumber', () => {
	it('maps French national format to international digits', () => {
		expect(toWhatsAppNumber('0612345678')).toBe('33612345678');
		expect(toWhatsAppNumber('06 12 34 56 78')).toBe('33612345678');
		expect(toWhatsAppNumber('06-12-34-56-78')).toBe('33612345678');
		expect(toWhatsAppNumber('(06) 12 34 56 78')).toBe('33612345678');
	});

	it('passes international digit strings through', () => {
		expect(toWhatsAppNumber('+33612345678')).toBe('33612345678');
		expect(toWhatsAppNumber('+33 6 12 34 56 78')).toBe('33612345678');
		expect(toWhatsAppNumber('33612345678')).toBe('33612345678');
		expect(toWhatsAppNumber('+14155552671')).toBe('14155552671');
	});

	it('returns null when no country can be determined', () => {
		expect(toWhatsAppNumber('')).toBeNull();
		expect(toWhatsAppNumber('6123456')).toBeNull();
		expect(toWhatsAppNumber('01234567890123456')).toBeNull();
	});
});
