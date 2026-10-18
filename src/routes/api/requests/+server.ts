import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { flat, request, requestEmail, requestPhone, requestSpot, spot } from '$lib/server/db/schema';
import {
	errorJson,
	handleHandlerError,
	parseFlatNumber,
	requireRateLimit,
	validateContactInputs
} from '$lib/server/handler';
import { recordFailedAttempt, resetAttempts } from '$lib/server/rate-limit';
import { parseSpotListInput } from '$lib/server/rebind';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request: req }) => {
	try {
		const { flatNumber, spotNumbers, requesterName, emails, phones } = await req.json();

		if (!flatNumber || !Array.isArray(spotNumbers) || spotNumbers.length === 0) {
			return errorJson('Numéro de lot et au moins une place de parking requise', 400);
		}

		const trimmedFlat = parseFlatNumber(flatNumber);
		if (trimmedFlat instanceof Response) return trimmedFlat;

		const parsedSpots = parseSpotListInput(spotNumbers, 'Aucun numéro de place de parking valide');
		if (parsedSpots instanceof Response) return parsedSpots;
		const trimmedSpots = parsedSpots;

		// Refuse unknown spots — the building's spots are created by admins first
		for (const s of trimmedSpots) {
			const known = await db.select().from(spot).where(eq(spot.number, s)).get();
			if (!known) {
				return errorJson(`Place « ${s} » inexistante`, 400);
			}
		}

		// Rate limit by flat number
		const rateLimitKey = `request:${trimmedFlat}`;
		const limited = requireRateLimit(rateLimitKey);
		if (limited) return limited;

		// Check flat doesn't already exist (any status)
		const existingFlat = await db.select().from(flat).where(eq(flat.number, trimmedFlat)).get();
		if (existingFlat) {
			recordFailedAttempt(rateLimitKey);
			return errorJson('Ce lot existe déjà dans le système', 409);
		}

		// Success — reset rate limit
		resetAttempts(rateLimitKey);

		const validated = validateContactInputs(emails, phones);
		if (validated instanceof Response) return validated;
		const { emails: validatedEmails, phones: validatedPhones } = validated;

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
		return handleHandlerError('POST /api/requests', e);
	}
};
