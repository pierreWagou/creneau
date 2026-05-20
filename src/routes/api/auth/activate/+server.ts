import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { createSession, hashPin, PIN_MAX_LENGTH, PIN_MIN_LENGTH, setSessionCookie } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { flat } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const { flatNumber, activationCode, displayName, pin } = await request.json();

		if (!flatNumber || !activationCode || !pin) {
			return json({ error: 'Champs obligatoires manquants' }, { status: 400 });
		}

		if (pin.length < PIN_MIN_LENGTH || pin.length > PIN_MAX_LENGTH) {
			return json({ error: `Le PIN doit contenir ${PIN_MIN_LENGTH} à ${PIN_MAX_LENGTH} chiffres` }, { status: 400 });
		}

		if (!/^\d+$/.test(pin)) {
			return json({ error: 'Le PIN ne doit contenir que des chiffres' }, { status: 400 });
		}

		const existingFlat = await db.select().from(flat).where(eq(flat.number, flatNumber)).get();

		if (!existingFlat || existingFlat.activationCode !== activationCode) {
			return json({ error: "Numéro d'appartement ou code d'activation invalide" }, { status: 401 });
		}

		if (existingFlat.isActive) {
			return json({ error: 'Cet appartement a déjà été activé' }, { status: 409 });
		}

		// Check activation code expiry
		if (existingFlat.activationCodeExpiresAt) {
			const expiresAt = new Date(existingFlat.activationCodeExpiresAt).getTime();
			if (Date.now() > expiresAt) {
				return json({ error: "Code d'activation expiré. Contactez votre administrateur." }, { status: 410 });
			}
		}

		const pinHash = await hashPin(pin);
		await db
			.update(flat)
			.set({
				displayName: displayName || null,
				pinHash,
				isActive: true,
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
