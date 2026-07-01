import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { flat, flatRequest, spot } from '$lib/server/db/schema';
import { checkRateLimit, rateLimitErrorMessage, recordFailedAttempt, resetAttempts } from '$lib/server/rate-limit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { flatNumber, spotNumbers, requesterName } = await request.json();

		if (!flatNumber || !Array.isArray(spotNumbers) || spotNumbers.length === 0) {
			return json({ error: "Numéro d'appartement et au moins une place requis" }, { status: 400 });
		}

		const trimmedFlat = flatNumber.trim();
		const trimmedSpots = [...new Set(spotNumbers.map((s: unknown) => String(s).trim()).filter((s) => s.length > 0))];

		if (trimmedSpots.length === 0) {
			return json({ error: 'Aucun numéro de place valide' }, { status: 400 });
		}

		// Rate limit by flat number
		const rateLimitKey = `request:${trimmedFlat}`;
		const { allowed, retryAfterMs } = checkRateLimit(rateLimitKey);
		if (!allowed) {
			return json({ error: rateLimitErrorMessage(retryAfterMs || 0) }, { status: 429 });
		}

		// Check flat doesn't already exist
		const existingFlat = await db.select().from(flat).where(eq(flat.number, trimmedFlat)).get();
		if (existingFlat) {
			recordFailedAttempt(rateLimitKey);
			return json({ error: 'Cet appartement existe déjà dans le système' }, { status: 409 });
		}

		// Check no pending request for same flat
		const pendingRequest = await db.select().from(flatRequest).where(eq(flatRequest.flatNumber, trimmedFlat)).get();
		if (pendingRequest && pendingRequest.status === 'pending') {
			recordFailedAttempt(rateLimitKey);
			return json({ error: 'Une demande est déjà en cours pour cet appartement' }, { status: 409 });
		}

		// Check all spots are available (don't exist or exist but unbound)
		for (const spotNum of trimmedSpots) {
			const existingSpot = await db.select().from(spot).where(eq(spot.number, spotNum)).get();
			if (existingSpot?.flatNumber) {
				recordFailedAttempt(rateLimitKey);
				return json({ error: `La place ${spotNum} est déjà attribuée à un autre appartement` }, { status: 409 });
			}
		}

		// Success — reset rate limit
		resetAttempts(rateLimitKey);

		const result = await db
			.insert(flatRequest)
			.values({
				flatNumber: trimmedFlat,
				spotNumbers: trimmedSpots,
				requesterName: requesterName?.trim() || null
			})
			.returning()
			.get();

		return json({ request: result }, { status: 201 });
	} catch (e) {
		if (e instanceof SyntaxError) {
			return json({ error: 'Requête invalide' }, { status: 400 });
		}
		console.error('[POST /api/requests]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};
