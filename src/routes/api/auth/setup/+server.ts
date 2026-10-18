import { json } from '@sveltejs/kit';
import { createSession, hashPin, setSessionCookie, validatePin } from '$lib/server/auth';
import { setFlatEmails, setFlatPhones } from '$lib/server/contacts';
import { db } from '$lib/server/db';
import { flat } from '$lib/server/db/schema';
import { errorJson, handleHandlerError, parseFlatNumber, validateContactInputs } from '$lib/server/handler';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		// Ensure no flats exist (first-time setup only)
		const existingFlats = await db.select().from(flat).all();
		if (existingFlats.length > 0) {
			return errorJson("L'application est déjà configurée", 409);
		}

		const { flatNumber, displayName, pin, emails, phones } = await request.json();

		// Validate input
		if (!flatNumber || !pin) {
			return errorJson('Champs obligatoires manquants', 400);
		}

		const normalizedFlat = parseFlatNumber(flatNumber);
		if (normalizedFlat instanceof Response) return normalizedFlat;

		const pinError = validatePin(pin);
		if (pinError) {
			return errorJson(pinError, 400);
		}

		const validated = validateContactInputs(emails, phones);
		if (validated instanceof Response) return validated;
		const { emails: validatedEmails, phones: validatedPhones } = validated;

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
		return handleHandlerError('POST /api/auth/setup', e);
	}
};
