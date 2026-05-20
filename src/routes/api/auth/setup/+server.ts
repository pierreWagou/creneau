import { json } from '@sveltejs/kit';
import { PIN_MAX_LENGTH, PIN_MIN_LENGTH } from '$lib/constants';
import { createSession, hashPin, setSessionCookie } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { flat } from '$lib/server/db/schema';
import { consumeSetupToken, validateSetupToken } from '$lib/server/setup-token';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const { flatNumber, displayName, pin, token } = await request.json();

		// Validate setup token
		if (!token || !validateSetupToken(token)) {
			return json({ error: 'Token de configuration invalide ou expiré' }, { status: 403 });
		}

		// Ensure no flats exist (first-time setup only)
		const existingFlats = await db.select().from(flat).all();
		if (existingFlats.length > 0) {
			return json({ error: "L'application est déjà configurée" }, { status: 409 });
		}

		// Validate input
		if (!flatNumber || !pin) {
			return json({ error: 'Champs obligatoires manquants' }, { status: 400 });
		}

		if (pin.length < PIN_MIN_LENGTH || pin.length > PIN_MAX_LENGTH) {
			return json({ error: `Le PIN doit contenir ${PIN_MIN_LENGTH} à ${PIN_MAX_LENGTH} chiffres` }, { status: 400 });
		}

		if (!/^\d+$/.test(pin)) {
			return json({ error: 'Le PIN ne doit contenir que des chiffres' }, { status: 400 });
		}

		// Create admin flat (already active, no activation code)
		const pinHash = await hashPin(pin);
		const result = await db
			.insert(flat)
			.values({
				number: flatNumber.trim(),
				displayName: displayName?.trim() || null,
				pinHash,
				isAdmin: true,
				isActive: true,
				activatedAt: new Date().toISOString()
			})
			.returning()
			.get();

		// Consume the setup token (single use)
		consumeSetupToken();

		// Create session and set cookie
		const sessionId = await createSession(result.id);
		setSessionCookie(cookies, sessionId);

		return json({
			success: true,
			flat: {
				number: result.number,
				displayName: result.displayName,
				isAdmin: result.isAdmin
			}
		});
	} catch {
		return json({ error: 'Requête invalide' }, { status: 400 });
	}
};
