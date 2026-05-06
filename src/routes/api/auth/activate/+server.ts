import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { flat } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { hashPin, createSession, SESSION_COOKIE_NAME, SESSION_MAX_AGE, PIN_MIN_LENGTH, PIN_MAX_LENGTH } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const { flatNumber, activationCode, displayName, pin } = await request.json();

		if (!flatNumber || !activationCode || !pin) {
			return json({ error: 'Champs obligatoires manquants' }, { status: 400 });
		}

		if (pin.length < PIN_MIN_LENGTH || pin.length > PIN_MAX_LENGTH) {
			return json({ error: `Le PIN doit contenir ${PIN_MIN_LENGTH} à ${PIN_MAX_LENGTH} chiffres` }, { status: 400 });
		}

		const existingFlat = await db
			.select()
			.from(flat)
			.where(and(eq(flat.number, flatNumber), eq(flat.activationCode, activationCode)))
			.get();

		if (!existingFlat) {
			return json({ error: "Numéro d'appartement ou code d'activation invalide" }, { status: 401 });
		}

		if (existingFlat.isActive) {
			return json({ error: 'Cet appartement a déjà été activé' }, { status: 409 });
		}

		const pinHash = await hashPin(pin);
		await db
			.update(flat)
			.set({
				displayName: displayName || null,
				pinHash,
				isActive: true,
				activatedAt: new Date().toISOString()
			})
			.where(eq(flat.id, existingFlat.id));

		const sessionId = await createSession(existingFlat.id);

		cookies.set(SESSION_COOKIE_NAME, sessionId, {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			maxAge: SESSION_MAX_AGE
		});

		return json({
			success: true,
			flat: {
				number: existingFlat.number,
				displayName: displayName || null,
				isAdmin: existingFlat.isAdmin
			}
		});
	} catch {
		return json({ error: 'Requête invalide' }, { status: 400 });
	}
};
