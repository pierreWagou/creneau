import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { FLAT_NUMBER_REGEX } from '$lib/constants';
import { createSession, hashPin, setSessionCookie, validatePin } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { flat } from '$lib/server/db/schema';
import { consumeFlatInvite, FlatTransitionError, reapExpiredInvitations } from '$lib/server/flat-state';
import { handleHandlerError, requireRateLimit } from '$lib/server/handler';
import { recordFailedAttempt, resetAttempts } from '$lib/server/rate-limit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const { flatNumber, activationCode, displayName, pin } = await request.json();

		if (!flatNumber || !activationCode || !pin) {
			return json({ error: 'Champs obligatoires manquants' }, { status: 400 });
		}

		const normalizedFlat = flatNumber.trim().toUpperCase();
		if (!FLAT_NUMBER_REGEX.test(normalizedFlat)) {
			return json({ error: 'Format de lot invalide (ex. A01, B12)' }, { status: 400 });
		}

		// Rate limiting
		const limited = requireRateLimit(`activate:${normalizedFlat}`);
		if (limited) return limited;

		const pinError = validatePin(pin);
		if (pinError) {
			return json({ error: pinError }, { status: 400 });
		}

		const existingFlat = await db.select().from(flat).where(eq(flat.number, normalizedFlat)).get();

		if (!existingFlat || existingFlat.activationCode !== activationCode) {
			recordFailedAttempt(`activate:${normalizedFlat}`);
			return json({ error: "Numéro de lot ou code d'activation invalide" }, { status: 401 });
		}

		if (existingFlat.status === 'active') {
			return json({ error: 'Ce lot a déjà été activé' }, { status: 409 });
		}

		// consume requires pending — guards against revoked/codeless rows slipping past code-match
		if (existingFlat.status !== 'pending') {
			recordFailedAttempt(`activate:${normalizedFlat}`);
			return json({ error: "Ce lien d'invitation n'est plus valide" }, { status: 409 });
		}

		// Check activation code expiry — a dead invitation reaps its flat back to inactive
		if (existingFlat.activationCodeExpiresAt) {
			const expiresAt = new Date(existingFlat.activationCodeExpiresAt).getTime();
			if (Date.now() > expiresAt) {
				await reapExpiredInvitations();
				return json({ error: "Code d'activation expiré. Contactez votre administrateur." }, { status: 410 });
			}
		}

		// Success — reset rate limit
		resetAttempts(`activate:${normalizedFlat}`);

		const pinHash = await hashPin(pin);
		try {
			await consumeFlatInvite(existingFlat.number, {
				displayName: displayName || null,
				pinHash
			});
		} catch (e) {
			if (e instanceof FlatTransitionError) {
				return json({ error: e.message }, { status: e.statusCode });
			}
			throw e;
		}

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
		return handleHandlerError('POST /api/auth/activate', e);
	}
};
