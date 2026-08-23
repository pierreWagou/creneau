import { describe, expect, it } from 'vitest';
import { validateEmails, validatePhones } from './contacts';

describe('validateEmails', () => {
	it('returns trimmed deduplicated emails on success', () => {
		expect(validateEmails(['a@test.com', 'b@test.com'])).toEqual(['a@test.com', 'b@test.com']);
	});

	it('deduplicates exact matches after trim', () => {
		expect(validateEmails([' A@test.com ', 'A@test.com'])).toEqual(['A@test.com']);
	});

	it('filters out empty strings', () => {
		expect(validateEmails(['a@test.com', '', '  '])).toEqual(['a@test.com']);
	});

	it('rejects non-array input', () => {
		expect(validateEmails('not an array')).toBe('Les emails doivent être un tableau');
	});

	it('rejects when all emails are empty', () => {
		expect(validateEmails(['', '  '])).toBe('Au moins un email requis');
	});

	it('rejects when too many emails', () => {
		const emails = Array.from({ length: 6 }, (_, i) => `${i}@test.com`);
		expect(validateEmails(emails)).toBe('Maximum 5 emails autorisés');
	});

	it('rejects invalid email format', () => {
		expect(validateEmails(['not-an-email'])).toContain('Email invalide');
	});

	it('accepts exactly MAX_CONTACTS_PER_TYPE emails', () => {
		const emails = Array.from({ length: 5 }, (_, i) => `${i}@test.com`);
		expect(validateEmails(emails)).toEqual(emails);
	});
});

describe('validatePhones', () => {
	it('returns formatted deduplicated phones on success', () => {
		expect(validatePhones(['+33612345678'])).toEqual(['+33612345678']);
	});

	it('formats national numbers to E.164', () => {
		expect(validatePhones(['0612345678'])).toEqual(['+33612345678']);
	});

	it('deduplicates after formatting', () => {
		expect(validatePhones(['06 12 34 56 78', '+33 6 12 34 56 78'])).toEqual(['+33612345678']);
	});

	it('rejects non-array input', () => {
		expect(validatePhones('not an array')).toBe('Les téléphones doivent être un tableau');
	});

	it('rejects when all phones are empty', () => {
		expect(validatePhones(['', '  '])).toBe('Au moins un téléphone requis');
	});

	it('rejects when too many phones', () => {
		const phones = Array.from({ length: 6 }, (_, i) => `+3361234560${i}`);
		expect(validatePhones(phones)).toBe('Maximum 5 téléphones autorisés');
	});

	it('filters empty strings before counting', () => {
		const phones = ['+33612345678', '', '  ', '+33698765432'];
		expect(validatePhones(phones)).toEqual(['+33612345678', '+33698765432']);
	});
});
