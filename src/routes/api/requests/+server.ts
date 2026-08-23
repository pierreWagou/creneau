import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { FLAT_NUMBER_REGEX, formatSpotNumber, SPOT_NUMBER_REGEX } from '$lib/constants';
import { validateEmails, validatePhones } from '$lib/server/contacts';
import { db } from '$lib/server/db';
import { flat, request, requestEmail, requestPhone, requestSpot } from '$lib/server/db/schema';
import { checkRateLimit, rateLimitErrorMessage, recordFailedAttempt, resetAttempts } from '$lib/server/rate-limit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request: req }) => {
	try {
		const { flatNumber, spotNumbers, requesterName, emails, phones } = await req.json();

		if (!flatNumber || !Array.isArray(spotNumbers) || spotNumbers.length === 0) {
			return json({ error: "Numéro d'appartement et au moins une place de parking requise" }, { status: 400 });
		}

		const trimmedFlat = flatNumber.trim().toUpperCase();

		if (!FLAT_NUMBER_REGEX.test(trimmedFlat)) {
			return json({ error: "Format d'appartement invalide (ex. A01, B12)" }, { status: 400 });
		}

		const trimmedSpots = [
			...new Set(spotNumbers.map((s: unknown) => formatSpotNumber(String(s).trim())).filter((s) => s.length > 0))
		];

		if (trimmedSpots.length === 0) {
			return json({ error: 'Aucun numéro de place de parking valide' }, { status: 400 });
		}

		for (const s of trimmedSpots) {
			if (!SPOT_NUMBER_REGEX.test(s)) {
				return json({ error: `Format de place de parking invalide : "${s}" (ex. 01, 36)` }, { status: 400 });
			}
		}

		// Rate limit by flat number
		const rateLimitKey = `request:${trimmedFlat}`;
		const { allowed, retryAfterMs } = checkRateLimit(rateLimitKey);
		if (!allowed) {
			return json({ error: rateLimitErrorMessage(retryAfterMs || 0) }, { status: 429 });
		}

		// Check flat doesn't already exist (any status)
		const existingFlat = await db.select().from(flat).where(eq(flat.number, trimmedFlat)).get();
		if (existingFlat) {
			recordFailedAttempt(rateLimitKey);
			return json({ error: 'Cet appartement existe déjà dans le système' }, { status: 409 });
		}

		// Success — reset rate limit
		resetAttempts(rateLimitKey);

		const validatedEmails = validateEmails(emails);
		if (typeof validatedEmails === 'string') {
			return json({ error: validatedEmails }, { status: 400 });
		}

		const validatedPhones = validatePhones(phones);
		if (typeof validatedPhones === 'string') {
			return json({ error: validatedPhones }, { status: 400 });
		}

		// Create request row (no flat created)
		const result = await db
			.insert(request)
			.values({
				flatNumber: trimmedFlat,
				requesterName: requesterName?.trim() || null
			})
			.returning()
			.get();

		// Insert contacts into request tables
		if (validatedEmails.length > 0) {
			await db.insert(requestEmail).values(validatedEmails.map((email) => ({ requestId: result.id, email })));
		}
		if (validatedPhones.length > 0) {
			await db.insert(requestPhone).values(validatedPhones.map((phone) => ({ requestId: result.id, phone })));
		}

		// Store requested spots
		if (trimmedSpots.length > 0) {
			await db.insert(requestSpot).values(trimmedSpots.map((spotNumber) => ({ requestId: result.id, spotNumber })));
		}

		return json({ request: result }, { status: 201 });
	} catch (e) {
		if (e instanceof SyntaxError) {
			return json({ error: 'Requête invalide' }, { status: 400 });
		}
		console.error('[POST /api/requests]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};
