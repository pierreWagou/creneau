import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RATE_LIMIT_LOCKOUT_MS, RATE_LIMIT_MAX_ATTEMPTS } from '$lib/constants';
import { checkRateLimit, rateLimitErrorMessage, recordFailedAttempt, resetAttempts } from './rate-limit';

// Fresh key per test: the limiter keeps module-level state on purpose
// (in-memory, per process) and exposes no bulk reset.
let key: string;

beforeEach(() => {
	key = `test-${Math.random()}`;
	vi.useFakeTimers();
});

afterEach(() => {
	resetAttempts(key);
	vi.useRealTimers();
});

describe('checkRateLimit', () => {
	it('allows an unknown key', () => {
		expect(checkRateLimit(key)).toEqual({ allowed: true });
	});

	it('keeps allowing below the attempt threshold', () => {
		for (let i = 0; i < RATE_LIMIT_MAX_ATTEMPTS - 1; i++) recordFailedAttempt(key);
		expect(checkRateLimit(key)).toEqual({ allowed: true });
	});

	it('locks out at the attempt threshold with a retry delay', () => {
		for (let i = 0; i < RATE_LIMIT_MAX_ATTEMPTS; i++) recordFailedAttempt(key);

		const result = checkRateLimit(key);
		expect(result.allowed).toBe(false);
		expect(result.retryAfterMs).toBeGreaterThan(0);
		expect(result.retryAfterMs).toBeLessThanOrEqual(RATE_LIMIT_LOCKOUT_MS);
	});

	it('stays locked out through the window', () => {
		for (let i = 0; i < RATE_LIMIT_MAX_ATTEMPTS; i++) recordFailedAttempt(key);

		vi.advanceTimersByTime(RATE_LIMIT_LOCKOUT_MS - 1);
		expect(checkRateLimit(key).allowed).toBe(false);
	});

	it('releases and resets once the window elapses', () => {
		for (let i = 0; i < RATE_LIMIT_MAX_ATTEMPTS; i++) recordFailedAttempt(key);

		vi.advanceTimersByTime(RATE_LIMIT_LOCKOUT_MS + 1);
		expect(checkRateLimit(key)).toEqual({ allowed: true });

		// Expiry also clears the counter: one failure must not instantly relock
		recordFailedAttempt(key);
		expect(checkRateLimit(key).allowed).toBe(true);
	});
});

describe('resetAttempts', () => {
	it('clears accumulated failures', () => {
		for (let i = 0; i < RATE_LIMIT_MAX_ATTEMPTS - 1; i++) recordFailedAttempt(key);
		resetAttempts(key);

		for (let i = 0; i < RATE_LIMIT_MAX_ATTEMPTS - 1; i++) recordFailedAttempt(key);
		expect(checkRateLimit(key).allowed).toBe(true);
	});
});

describe('rateLimitErrorMessage', () => {
	it('uses the singular for up to one minute', () => {
		expect(rateLimitErrorMessage(1)).toBe('Trop de tentatives. Réessayez dans 1 minute.');
	});

	it('rounds up and pluralizes past a minute', () => {
		expect(rateLimitErrorMessage(61_000)).toBe('Trop de tentatives. Réessayez dans 2 minutes.');
		expect(rateLimitErrorMessage(RATE_LIMIT_LOCKOUT_MS)).toBe('Trop de tentatives. Réessayez dans 15 minutes.');
	});
});
