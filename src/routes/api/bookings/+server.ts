import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createBooking } from '$lib/server/bookings';
import { sseManager } from '$lib/server/sse';

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
