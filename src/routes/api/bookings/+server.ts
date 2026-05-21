import { json } from '@sveltejs/kit';
import { createBooking } from '$lib/server/bookings';
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
