import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { formatSpotNumber, SPOT_NUMBER_REGEX } from '$lib/constants';
import { db } from '$lib/server/db';
import { spot } from '$lib/server/db/schema';
import { requireAdmin } from '$lib/server/guards';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const guard = requireAdmin(locals);
	if (guard) return guard;

	try {
		const { number, description } = await request.json();

		if (!number) {
			return json({ error: 'Numéro de la place de parking requis' }, { status: 400 });
		}

		const spotNumber = formatSpotNumber(number.trim());
		if (!SPOT_NUMBER_REGEX.test(spotNumber)) {
			return json({ error: 'Format de place de parking invalide (ex. 01, 36)' }, { status: 400 });
		}

		// Check spot doesn't already exist
		const existingSpot = await db.select().from(spot).where(eq(spot.number, spotNumber)).get();
		if (existingSpot) {
			return json({ error: 'Cette place de parking existe déjà' }, { status: 409 });
		}

		const result = await db
			.insert(spot)
			.values({ number: spotNumber, description: description || null })
			.returning()
			.get();

		return json({ spot: result }, { status: 201 });
	} catch (e) {
		if (e instanceof SyntaxError) {
			return json({ error: 'Requête invalide' }, { status: 400 });
		}
		console.error('[POST /api/spots]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};
