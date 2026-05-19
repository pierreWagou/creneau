import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { flat } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { verifyPin, createSession, setSessionCookie } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const { flatNumber, pin } = await request.json();

		if (!flatNumber || !pin) {
			return json({ error: 'Champs obligatoires manquants' }, { status: 400 });
		}

		const existingFlat = await db
			.select()
			.from(flat)
			.where(eq(flat.number, flatNumber))
			.get();

		if (!existingFlat || !existingFlat.isActive || !existingFlat.pinHash) {
			return json({ error: "Numéro d'appartement ou PIN invalide" }, { status: 401 });
		}

		const valid = await verifyPin(pin, existingFlat.pinHash);
		if (!valid) {
			return json({ error: "Numéro d'appartement ou PIN invalide" }, { status: 401 });
		}

		const sessionId = await createSession(existingFlat.id);
		setSessionCookie(cookies, sessionId);

		return json({
			success: true,
			flat: {
				number: existingFlat.number,
				displayName: existingFlat.displayName,
				isAdmin: existingFlat.isAdmin
			}
		});
	} catch {
		return json({ error: 'Requête invalide' }, { status: 400 });
	}
};
