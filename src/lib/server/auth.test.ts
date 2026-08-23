import { describe, expect, it } from 'vitest';
import { validatePin } from './auth';

describe('validatePin', () => {
	it('returns null for valid PIN', () => {
		expect(validatePin('1234')).toBeNull();
	});

	it('returns null for 6-digit PIN', () => {
		expect(validatePin('123456')).toBeNull();
	});

	it('rejects PIN shorter than 4 digits', () => {
		expect(validatePin('123')).toContain('4 à 6');
	});

	it('rejects PIN longer than 6 digits', () => {
		expect(validatePin('1234567')).toContain('4 à 6');
	});

	it('rejects non-numeric PIN', () => {
		expect(validatePin('abcd')).toContain('chiffres');
	});

	it('rejects PIN with mixed digits and letters', () => {
		expect(validatePin('12ab')).toContain('chiffres');
	});

	it('rejects empty string', () => {
		expect(validatePin('')).toContain('4 à 6');
	});
});
