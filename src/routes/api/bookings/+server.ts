import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createBooking, getBookingsInRange } from '$lib/server/bookings';
import { sseManager } from '$lib/server/sse';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		return json({ error: 'Non autorisé' }, { status: 401 });
	}

	const from = url.searchParams.get('from');
	const to = url.searchParams.get('to');
	const spotId = url.searchParams.get('spotId');

	if (!from || !to) {
		return json({ error: 'Paramètres from/to requis' }, { status: 400 });
	}

	const parsedSpotId = spotId ? parseInt(spotId) : undefined;
	if (spotId && (parsedSpotId === undefined || isNaN(parsedSpotId))) {
		return json({ error: 'Paramètre spotId invalide' }, { status: 400 });
	}

	const bookings = await getBookingsInRange(from, to, parsedSpotId);
	return json({ bookings });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Non autorisé' }, { status: 401 });
	}

	try {
		const { spotId, startTime, endTime, note } = await request.json();

		if (!spotId || !startTime || !endTime) {
			return json({ error: 'Champs requis manquants' }, { status: 400 });
		}

		const result = await createBooking({
			spotId,
			flatId: locals.user.id,
			startTime,
			endTime,
			note: note || null
		});

		if (!result.success) {
			return json({ error: result.error }, { status: 409 });
		}

		sseManager.broadcast('booking_created', result.booking);
		return json({ booking: result.booking }, { status: 201 });
	} catch {
		return json({ error: 'Requête invalide' }, { status: 400 });
	}
};
