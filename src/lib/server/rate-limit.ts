import { MS_PER_MINUTE, RATE_LIMIT_LOCKOUT_MS, RATE_LIMIT_MAX_ATTEMPTS } from '$lib/constants';

interface RateLimitRecord {
	count: number;
	lockedUntil: number;
}

const attempts = new Map<string, RateLimitRecord>();

/**
 * Check if a key is rate-limited.
 * Returns { allowed: true } if the request can proceed,
 * or { allowed: false, retryAfterMs } if the key is locked out.
 */
export function checkRateLimit(key: string): { allowed: boolean; retryAfterMs?: number } {
	const record = attempts.get(key);
	if (!record) return { allowed: true };

	// Lockout expired — reset
	if (record.lockedUntil > 0 && record.lockedUntil <= Date.now()) {
		attempts.delete(key);
		return { allowed: true };
	}

	// Currently locked out
	if (record.lockedUntil > Date.now()) {
		return { allowed: false, retryAfterMs: record.lockedUntil - Date.now() };
	}

	return { allowed: true };
}

/**
 * Record a failed attempt for a key.
 * After RATE_LIMIT_MAX_ATTEMPTS failures, the key is locked out for RATE_LIMIT_LOCKOUT_MS.
 */
export function recordFailedAttempt(key: string): void {
	const record = attempts.get(key) || { count: 0, lockedUntil: 0 };
	record.count++;
	if (record.count >= RATE_LIMIT_MAX_ATTEMPTS) {
		record.lockedUntil = Date.now() + RATE_LIMIT_LOCKOUT_MS;
	}
	attempts.set(key, record);
}

/**
 * Reset attempts for a key (called on successful auth).
 */
export function resetAttempts(key: string): void {
	attempts.delete(key);
}

/**
 * Build the French rate-limit error message for a lockout response.
 */
export function rateLimitErrorMessage(retryAfterMs: number): string {
	const minutes = Math.ceil(retryAfterMs / MS_PER_MINUTE);
	return `Trop de tentatives. Réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.`;
}
