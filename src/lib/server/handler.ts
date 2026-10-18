import { json } from '@sveltejs/kit';
import { FLAT_NUMBER_REGEX } from '$lib/constants';
import { normalizeFlatNumber } from '$lib/validation';
import { validateEmails, validatePhones } from './contacts';
import { checkRateLimit, rateLimitErrorMessage } from './rate-limit';

/**
 * Request-handling glue shared by the API route handlers.
 *
 * These compose {@link Response}s; domain logic (validation rules, rate-limit
 * policy) stays in `contacts.ts` / `rate-limit.ts`.
 */

/**
 * Standard error envelope for a failed handler body: malformed JSON → 400,
 * domain errors carrying a numeric `statusCode` (e.g. `SpotTransitionError`,
 * `FlatTransitionError`) → that status, anything else → logged with `tag` + 500.
 *
 * `tag` is the log prefix used verbatim in `console.error`, e.g.
 * `'POST /api/spots'` prints `[POST /api/spots]`.
 *
 * Use from the `catch` of a handler's `try` (the `try` earns its keep around
 * `request.json()`), so every endpoint answers malformed bodies the same way:
 *
 * ```ts
 * } catch (e) {
 *   return handleHandlerError('POST /api/spots', e);
 * }
 * ```
 */
export function handleHandlerError(tag: string, e: unknown): Response {
	if (e instanceof SyntaxError) {
		return errorJson('Requête invalide', 400);
	}
	if (typeof e === 'object' && e !== null && typeof (e as { statusCode?: unknown }).statusCode === 'number') {
		const { message, statusCode } = e as { message: string; statusCode: number };
		return errorJson(message, statusCode);
	}
	console.error(`[${tag}]`, e);
	return errorJson('Erreur interne', 500);
}

/**
 * Standard error envelope: every API error answers `{ error }` with a status.
 * Use instead of hand-writing `json({ error }, { status })` so the shape
 * can't drift between endpoints.
 */
export function errorJson(message: string, status: number): Response {
	return json({ error: message }, { status });
}

/**
 * Strict digits for integer params (`3.5`, `-1`, `''`, `0x10` all fail).
 */
const STRICT_DIGITS = /^\d+$/;

/**
 * Parse an integer `:id` route param (`bookings/:id`, `requests/:id`).
 * Strict digits only (`3.5`, `-1`, `''`, `0x10` all 400) — `Number()` coercion
 * used to let those through to a misleading 404.
 * Returns the id, or the 400 response when it isn't numeric — mirrors the
 * `requireAuth` / `requireAdmin` guard convention (`instanceof Response`).
 */
export function parseNumericId(params: { id?: string }, resource: string): number | Response {
	const raw = params.id ?? '';
	if (!STRICT_DIGITS.test(raw)) {
		return errorJson(`Identifiant de ${resource} invalide`, 400);
	}
	return Number(raw);
}

/**
 * Parse an optional numeric query param (`exclude=<bookingId>`).
 * Garbage answers 400 instead of silently disabling the filter; absent
 * answers NaN (preserves the "no exclusion" default downstream).
 */
export function parseOptionalNumericQuery(value: string | null, name: string): number | Response {
	if (value === null) return NaN;
	if (!STRICT_DIGITS.test(value)) {
		return errorJson(`Paramètre ${name} invalide`, 400);
	}
	return Number(value);
}

/**
 * Normalize + format-check a raw flat/lot number in one call.
 * Returns the normalized number, or the 400 response to answer with —
 * mirrors the `requireAuth` / `requireAdmin` guard convention (`instanceof Response`).
 */
export function parseFlatNumber(raw: unknown): string | Response {
	const normalized = normalizeFlatNumber(String(raw ?? ''));
	if (!FLAT_NUMBER_REGEX.test(normalized)) {
		return errorJson('Format de lot invalide (ex. A01, B12)', 400);
	}
	return normalized;
}

/**
 * Validate both contact lists of a create-style body in one call.
 *
 * Returns the 400 response for the first offender, or the normalized lists.
 * Emails are checked before phones to keep error precedence stable.
 *
 * Partial updates must NOT use this: they validate each list on its own
 * (`validateEmails` / `validatePhones`) and persist it independently.
 */
export function validateContactInputs(
	emails: unknown,
	phones: unknown
): Response | { emails: string[]; phones: string[] } {
	const validatedEmails = validateEmails(emails);
	if (typeof validatedEmails === 'string') {
		return errorJson(validatedEmails, 400);
	}

	const validatedPhones = validatePhones(phones);
	if (typeof validatedPhones === 'string') {
		return errorJson(validatedPhones, 400);
	}

	return { emails: validatedEmails, phones: validatedPhones };
}

/**
 * Return the 429 lockout response when `key` is rate-limited, else null.
 * Mirrors the `requireAuth` / `requireAdmin` guard convention; the caller
 * keeps the `recordFailedAttempt` / `resetAttempts` policy calls in place,
 * since which failures count and when to reset differ per endpoint.
 */
export function requireRateLimit(key: string): Response | null {
	const { allowed, retryAfterMs } = checkRateLimit(key);
	if (!allowed) {
		return errorJson(rateLimitErrorMessage(retryAfterMs || 0), 429);
	}
	return null;
}
