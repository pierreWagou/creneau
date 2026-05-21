import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { createSession, setSessionCookie, verifyPin } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { flat } from '$lib/server/db/schema';
import { checkRateLimit, recordFailedAttempt, resetAttempts } from '$lib/server/rate-limit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const { flatNumber, pin } = await request.json();

		if (!flatNumber || !pin) {
			return json({ error: 'Champs obligatoires manquants' }, { status: 400 });
		}

		// Rate limiting
		const { allowed, retryAfterMs } = checkRateLimit(flatNumber);
		if (!allowed) {
			const minutes = Math.ceil((retryAfterMs || 0) / 60000);
			return json(
				{ error: `Trop de tentatives. Réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.` },
				{ status: 429 }
			);
		}

		const existingFlat = await db.select().from(flat).where(eq(flat.number, flatNumber)).get();

		if (!existingFlat?.isActive || !existingFlat.pinHash) {
			recordFailedAttempt(flatNumber);
			return json({ error: "Numéro d'appartement ou PIN invalide" }, { status: 401 });
		}

		const valid = await verifyPin(pin, existingFlat.pinHash);
		if (!valid) {
			recordFailedAttempt(flatNumber);
			return json({ error: "Numéro d'appartement ou PIN invalide" }, { status: 401 });
		}

		// Success — reset rate limit
		resetAttempts(flatNumber);

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
