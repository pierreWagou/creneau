import { json } from '@sveltejs/kit';
import { cancelBooking, updateBooking } from '$lib/server/bookings';
import { sseManager } from '$lib/server/sse';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.flat) {
		return json({ error: 'Non autorisé' }, { status: 401 });
	}

	const bookingId = Number(params.id);
	if (Number.isNaN(bookingId)) {
		return json({ error: 'Identifiant de réservation invalide' }, { status: 400 });
	}

	try {
		const { startTime, endTime } = await request.json();

		if (!startTime || !endTime) {
			return json({ error: 'Champs startTime et endTime requis' }, { status: 400 });
		}

		const result = await updateBooking(bookingId, locals.flat.number, { startTime, endTime });

		if (!result.success) {
			return json({ error: result.error }, { status: result.status });
		}

		sseManager.broadcast('booking_updated', result.booking);
		return json({ booking: result.booking });
	} catch (e) {
		if (e instanceof SyntaxError) {
			return json({ error: 'Requête invalide' }, { status: 400 });
		}
		console.error('[PATCH /api/bookings/:id]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.flat) {
		return json({ error: 'Non autorisé' }, { status: 401 });
	}

	const bookingId = Number(params.id);
	if (Number.isNaN(bookingId)) {
		return json({ error: 'Identifiant de réservation invalide' }, { status: 400 });
	}

	try {
		const result = await cancelBooking(bookingId, locals.flat.number, locals.flat.isAdmin);

		if (!result.success) {
			return json({ error: result.error }, { status: result.status });
		}

		sseManager.broadcast('booking_cancelled', { id: bookingId });
		return json({ success: true });
	} catch (e) {
		console.error('[DELETE /api/bookings/:id]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};
