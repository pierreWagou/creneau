import { json } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import { buildSpotTimeline } from '$lib/server/availability';
import { getBookingsInRange } from '$lib/server/bookings';
import { db } from '$lib/server/db';
import { spot } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.flat) {
		return json({ error: 'Non autorisé' }, { status: 401 });
	}

	const from = url.searchParams.get('from');
	const to = url.searchParams.get('to');
	const spotNumber = url.searchParams.get('spot');

	if (!from || !to || !spotNumber) {
		return json({ error: 'Paramètres from/to/spot requis' }, { status: 400 });
	}

	// Validate spot is shared (not bound to any flat)
	const targetSpot = await db
		.select()
		.from(spot)
		.where(and(eq(spot.number, spotNumber), isNull(spot.flatNumber)))
		.get();

	if (!targetSpot) {
		return json({ error: 'Place introuvable' }, { status: 404 });
	}

	try {
		const bookings = await getBookingsInRange(from, to, spotNumber);
		const timeline = buildSpotTimeline(bookings, from, to);
		return json(timeline);
	} catch (e) {
		console.error('[GET /api/timeline]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};
