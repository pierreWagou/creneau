import { describe, expect, it, vi } from 'vitest';
import { RATE_LIMIT_MAX_ATTEMPTS } from '../constants';
import { validateEmails, validatePhones } from './contacts';
import {
	handleHandlerError,
	parseNumericId,
	parseOptionalNumericQuery,
	requireRateLimit,
	validateContactInputs
} from './handler';
import { recordFailedAttempt, resetAttempts } from './rate-limit';

describe('handleHandlerError', () => {
	it('maps SyntaxError to 400 Requête invalide', async () => {
		const res = handleHandlerError('POST /api/x', new SyntaxError('bad json'));
		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: 'Requête invalide' });
	});

	it('unwraps domain errors carrying a numeric statusCode', async () => {
		const err = Object.assign(new Error('Place attribuée'), { statusCode: 409 });
		const res = handleHandlerError('PATCH /api/spots/:number', err);
		expect(res.status).toBe(409);
		expect(await res.json()).toEqual({ error: 'Place attribuée' });
	});

	it('logs unexpected failures with the tag and answers 500', async () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const err = new Error('boom');
		const res = handleHandlerError('POST /api/spots/moves', err);
		expect(res.status).toBe(500);
		expect(await res.json()).toEqual({ error: 'Erreur interne' });
		expect(spy).toHaveBeenCalledWith('[POST /api/spots/moves]', err);
		spy.mockRestore();
	});
});

describe('validateContactInputs', () => {
	it('accepts valid lists', () => {
		expect(validateContactInputs(['a@b.co'], ['+33612345678'])).toEqual({
			emails: ['a@b.co'],
			phones: ['+33612345678']
		});
	});

	it('checks emails before phones', () => {
		const res = validateContactInputs(['not-an-email'], ['not-a-phone']);
		expect(res).not.toBeNull();
		expect((res as Response).status).toBe(400);
	});
});

describe('requireRateLimit', () => {
	it('allows fresh keys and locks out after max attempts', () => {
		const key = `handler-test-${Date.now()}`;
		expect(requireRateLimit(key)).toBeNull();
		for (let i = 0; i < RATE_LIMIT_MAX_ATTEMPTS; i++) recordFailedAttempt(key);
		const locked = requireRateLimit(key);
		expect(locked).not.toBeNull();
		expect(locked!.status).toBe(429);
		resetAttempts(key);
		expect(requireRateLimit(key)).toBeNull();
	});
});

describe('per-key contact validators (partial-update shape)', () => {
	it('validateEmails rejects non-arrays with a French message', () => {
		expect(validateEmails(undefined)).toBe('Les emails doivent être un tableau');
	});

	it('validatePhones rejects non-arrays with a French message', () => {
		expect(validatePhones(undefined)).toBe('Les téléphones doivent être un tableau');
	});
});

describe('parseNumericId', () => {
	it('parses strict digit ids', () => {
		expect(parseNumericId({ id: '12' }, 'réservation')).toBe(12);
		expect(parseNumericId({ id: '007' }, 'réservation')).toBe(7);
	});

	it('400s non-digit ids instead of leaking to a misleading 404', async () => {
		for (const id of [undefined, '', '3.5', '-1', '0x10', '12a', ' 12']) {
			const res = parseNumericId({ id }, 'réservation');
			expect(res).toBeInstanceOf(Response);
			expect((res as Response).status).toBe(400);
			expect(await (res as Response).json()).toEqual({ error: 'Identifiant de réservation invalide' });
		}
	});
});

describe('parseOptionalNumericQuery', () => {
	it('passes absence through as NaN (no exclusion downstream)', () => {
		expect(parseOptionalNumericQuery(null, 'exclude')).toBeNaN();
	});

	it('parses strict digit values', () => {
		expect(parseOptionalNumericQuery('12', 'exclude')).toBe(12);
	});

	it('400s garbage instead of silently disabling the filter', async () => {
		for (const value of ['abc', '3.5', '', '0x10']) {
			const res = parseOptionalNumericQuery(value, 'exclude');
			expect(res).toBeInstanceOf(Response);
			expect((res as Response).status).toBe(400);
			expect(await (res as Response).json()).toEqual({ error: 'Paramètre exclude invalide' });
		}
	});
});
