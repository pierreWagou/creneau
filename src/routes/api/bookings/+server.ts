import { json } from '@sveltejs/kit';
import { createBooking } from '$lib/server/bookings';
import { sseManager } from '$lib/server/sse';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.flat) {
		return json({ error: 'Non autorisé' }, { status: 401 });
	}

	try {
		const { spotId, startTime, endTime, note } = await request.json();

		if (!spotId || !startTime || !endTime) {
			return json({ error: 'Champs requis manquants' }, { status: 400 });
		}

		const result = await createBooking({
			spotId,
			flatId: locals.flat.id,
			startTime,
			endTime,
			note: note || null
		});

		if (!result.success) {
			return json({ error: result.error }, { status: 409 });
		}

		sseManager.broadcast('booking_created', result.booking);
		return json({ booking: result.booking }, { status: 201 });
	} catch (e) {
		console.error('[POST /api/bookings]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};
