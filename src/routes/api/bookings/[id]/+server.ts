import { json } from '@sveltejs/kit';
import { cancelBooking } from '$lib/server/bookings';
import { sseManager } from '$lib/server/sse';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.flat) {
		return json({ error: 'Non autorisé' }, { status: 401 });
	}

	const bookingId = parseInt(params.id, 10);
	if (Number.isNaN(bookingId)) {
		return json({ error: 'Identifiant de réservation invalide' }, { status: 400 });
	}

	try {
		const result = await cancelBooking(bookingId, locals.flat.number, locals.flat.isAdmin);

		if (!result.success) {
			return json({ error: result.error }, { status: result.status ?? 400 });
		}

		sseManager.broadcast('booking_cancelled', { id: bookingId });
		return json({ success: true });
	} catch (e) {
		console.error('[DELETE /api/bookings/:id]', e);
		return json({ error: "Erreur lors de l'annulation" }, { status: 500 });
	}
};
