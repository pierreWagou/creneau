import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { formatSpotNumber, SPOT_NUMBER_REGEX } from '$lib/constants';
import { db } from '$lib/server/db';
import { spot } from '$lib/server/db/schema';
import { requireAdmin } from '$lib/server/guards';
import { errorJson, handleHandlerError } from '$lib/server/handler';
import { guardRebind } from '$lib/server/rebind';
import { canTransition } from '$lib/server/spot-state';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const guard = requireAdmin(locals);
	if (guard) return guard;

	try {
		const { number, description, force } = await request.json();

		if (!number) {
			return errorJson('Numéro de la place de parking requis', 400);
		}

		const spotNumber = formatSpotNumber(number.trim());
		if (!SPOT_NUMBER_REGEX.test(spotNumber)) {
			return errorJson('Format de place de parking invalide (ex. 01, 36)', 400);
		}

		// Check spot doesn't already exist
		const existingSpot = await db.select().from(spot).where(eq(spot.number, spotNumber)).get();
		if (existingSpot) {
			// Unbound spot: pure duplicate, nothing to reassign
			if (!existingSpot.flatNumber) {
				return errorJson('Cette place de parking existe déjà', 409);
			}
			// Bound spot: route through the conflict dialog unless forced
			// (shared 409 contract carries the `conflicts` array for the client)
			const refused = await guardRebind(db, [{ spotNumber, currentFlat: existingSpot.flatNumber }], force === true);
			if (refused) return refused;
			// Transition guard: assigned → unassigned (LIMBO — freed spots wait
			// in limbo for explicit routing, they don't join the bookable pool)
			if (!canTransition(existingSpot.status, 'limbo', { hasFlat: true })) {
				return errorJson('Transition de place de parking invalide', 409);
			}
			const unbound = await db
				.update(spot)
				.set({ flatNumber: null, status: 'unassigned', description: description || existingSpot.description })
				.where(eq(spot.number, spotNumber))
				.returning()
				.get();
			// 200 (not 201): the spot already existed, it was only unbound
			return json({ spot: unbound }, { status: 200 });
		}

		const result = await db
			.insert(spot)
			.values({ number: spotNumber, description: description || null, status: 'unassigned' })
			.returning()
			.get();

		return json({ spot: result }, { status: 201 });
	} catch (e) {
		return handleHandlerError('POST /api/spots', e);
	}
};
