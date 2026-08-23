import { json } from '@sveltejs/kit';
import { FLAT_NUMBER_REGEX } from '$lib/constants';
import { createSession, hashPin, setSessionCookie, validatePin } from '$lib/server/auth';
import { setFlatEmails, setFlatPhones, validateEmails, validatePhones } from '$lib/server/contacts';
import { db } from '$lib/server/db';
import { flat } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		// Ensure no flats exist (first-time setup only)
		const existingFlats = await db.select().from(flat).all();
		if (existingFlats.length > 0) {
			return json({ error: "L'application est déjà configurée" }, { status: 409 });
		}

		const { flatNumber, displayName, pin, emails, phones } = await request.json();

		// Validate input
		if (!flatNumber || !pin) {
			return json({ error: 'Champs obligatoires manquants' }, { status: 400 });
		}

		const normalizedFlat = flatNumber.trim().toUpperCase();
		if (!FLAT_NUMBER_REGEX.test(normalizedFlat)) {
			return json({ error: "Format d'appartement invalide (ex. A01, B12)" }, { status: 400 });
		}

		const pinError = validatePin(pin);
		if (pinError) {
			return json({ error: pinError }, { status: 400 });
		}

		const validatedEmails = validateEmails(emails);
		if (typeof validatedEmails === 'string') {
			return json({ error: validatedEmails }, { status: 400 });
		}

		const validatedPhones = validatePhones(phones);
		if (typeof validatedPhones === 'string') {
			return json({ error: validatedPhones }, { status: 400 });
		}

		// Create admin flat (already active, no activation code)
		const pinHash = await hashPin(pin);
		const result = await db
			.insert(flat)
			.values({
				number: normalizedFlat,
				status: 'active',
				displayName: displayName?.trim() || null,
				pinHash,
				isAdmin: true,
				activatedAt: new Date().toISOString()
			})
			.returning()
			.get();

		// Insert emails and phones
		await Promise.all([
			setFlatEmails(db, normalizedFlat, validatedEmails),
			setFlatPhones(db, normalizedFlat, validatedPhones)
		]);

		// Create session and set cookie
		const sessionId = await createSession(result.number);
		setSessionCookie(cookies, sessionId);

		return json({
			success: true,
			flat: {
				number: result.number,
				displayName: result.displayName,
				isAdmin: result.isAdmin
			}
		});
	} catch (e) {
		if (e instanceof SyntaxError) {
			return json({ error: 'Requête invalide' }, { status: 400 });
		}
		console.error('[POST /api/auth/setup]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};
