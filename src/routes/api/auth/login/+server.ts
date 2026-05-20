import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { createSession, setSessionCookie, verifyPin } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { flat } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const { flatNumber, pin } = await request.json();

		if (!flatNumber || !pin) {
			return json({ error: 'Champs obligatoires manquants' }, { status: 400 });
		}

		const existingFlat = await db.select().from(flat).where(eq(flat.number, flatNumber)).get();

		if (!existingFlat?.isActive || !existingFlat.pinHash) {
			return json({ error: "Numéro d'appartement ou PIN invalide" }, { status: 401 });
		}

		const valid = await verifyPin(pin, existingFlat.pinHash);
		if (!valid) {
			return json({ error: "Numéro d'appartement ou PIN invalide" }, { status: 401 });
		}

		const sessionId = await createSession(existingFlat.number);
		setSessionCookie(cookies, sessionId);

		return json({
			success: true,
			flat: {
				number: existingFlat.number,
				displayName: existingFlat.displayName,
				isAdmin: existingFlat.isAdmin
			}
		});
	} catch (e) {
		if (e instanceof SyntaxError) {
			return json({ error: 'Requête invalide' }, { status: 400 });
		}
		console.error('[POST /api/auth/login]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};
