import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { FLAT_NUMBER_REGEX } from '$lib/constants';
import { createSession, hashPin, setSessionCookie, validatePin } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { flat } from '$lib/server/db/schema';
import { checkRateLimit, rateLimitErrorMessage, recordFailedAttempt, resetAttempts } from '$lib/server/rate-limit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const { flatNumber, activationCode, displayName, pin } = await request.json();

		if (!flatNumber || !activationCode || !pin) {
			return json({ error: 'Champs obligatoires manquants' }, { status: 400 });
		}

		const normalizedFlat = flatNumber.trim().toUpperCase();
		if (!FLAT_NUMBER_REGEX.test(normalizedFlat)) {
			return json({ error: "Format d'appartement invalide (ex. A01, B12)" }, { status: 400 });
		}

		// Rate limiting
		const { allowed, retryAfterMs } = checkRateLimit(`activate:${normalizedFlat}`);
		if (!allowed) {
			return json({ error: rateLimitErrorMessage(retryAfterMs || 0) }, { status: 429 });
		}

		const pinError = validatePin(pin);
		if (pinError) {
			return json({ error: pinError }, { status: 400 });
		}

		const existingFlat = await db.select().from(flat).where(eq(flat.number, normalizedFlat)).get();

		if (!existingFlat || existingFlat.activationCode !== activationCode) {
			recordFailedAttempt(`activate:${normalizedFlat}`);
			return json({ error: "Numéro d'appartement ou code d'activation invalide" }, { status: 401 });
		}

		if (existingFlat.status === 'active') {
			return json({ error: 'Cet appartement a déjà été activé' }, { status: 409 });
		}

		// Check activation code expiry
		if (existingFlat.activationCodeExpiresAt) {
			const expiresAt = new Date(existingFlat.activationCodeExpiresAt).getTime();
			if (Date.now() > expiresAt) {
				return json({ error: "Code d'activation expiré. Contactez votre administrateur." }, { status: 410 });
			}
		}

		// Success — reset rate limit
		resetAttempts(`activate:${normalizedFlat}`);

		const pinHash = await hashPin(pin);
		await db
			.update(flat)
			.set({
				status: 'active',
				displayName: displayName || null,
				pinHash,
				activatedAt: new Date().toISOString(),
				activationCode: null,
				activationCodeExpiresAt: null
			})
			.where(eq(flat.number, existingFlat.number));

		const sessionId = await createSession(existingFlat.number);
		setSessionCookie(cookies, sessionId);

		return json({
			success: true,
			flat: {
				number: existingFlat.number,
				displayName: displayName || null,
				isAdmin: existingFlat.isAdmin
			}
		});
	} catch (e) {
		if (e instanceof SyntaxError) {
			return json({ error: 'Requête invalide' }, { status: 400 });
		}
		console.error('[POST /api/auth/activate]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};
