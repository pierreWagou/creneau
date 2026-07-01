import { json } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import { createBooking } from '$lib/server/bookings';
import { db } from '$lib/server/db';
import { spot } from '$lib/server/db/schema';
import { sseManager } from '$lib/server/sse';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.flat) {
		return json({ error: 'Non autorisé' }, { status: 401 });
	}

	try {
		const { spotNumber, startTime, endTime, note } = await request.json();

		if (!spotNumber || !startTime || !endTime) {
			return json({ error: 'Champs obligatoires manquants' }, { status: 400 });
		}

		// Validate spot is shared (not bound to any flat)
		const targetSpot = await db
			.select()
			.from(spot)
			.where(and(eq(spot.number, spotNumber.trim()), isNull(spot.flatNumber)))
			.get();

		if (!targetSpot) {
			return json({ error: "Cette place n'est pas disponible pour réservation" }, { status: 400 });
		}

		const result = await createBooking({
			spotNumber: spotNumber.trim(),
			flatNumber: locals.flat.number,
			startTime,
			endTime,
			note: note || null
		});

		if (!result.success) {
			return json({ error: result.error }, { status: result.status });
		}

		sseManager.broadcast('booking_created', result.booking);
		return json({ booking: result.booking }, { status: 201 });
	} catch (e) {
		if (e instanceof SyntaxError) {
			return json({ error: 'Requête invalide' }, { status: 400 });
		}
		console.error('[POST /api/bookings]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};
