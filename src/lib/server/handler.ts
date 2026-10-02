import { json } from '@sveltejs/kit';
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
 * anything else → logged with `tag` + 500.
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
		return json({ error: 'Requête invalide' }, { status: 400 });
	}
	console.error(`[${tag}]`, e);
	return json({ error: 'Erreur interne' }, { status: 500 });
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
		return json({ error: validatedEmails }, { status: 400 });
	}

	const validatedPhones = validatePhones(phones);
	if (typeof validatedPhones === 'string') {
		return json({ error: validatedPhones }, { status: 400 });
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
		return json({ error: rateLimitErrorMessage(retryAfterMs || 0) }, { status: 429 });
	}
	return null;
}
