import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cancelBooking } from '$lib/server/bookings';
import { sseManager } from '$lib/server/sse';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ error: 'Non autorisé' }, { status: 401 });
	}

	const bookingId = parseInt(params.id);
	if (isNaN(bookingId)) {
		return json({ error: 'Identifiant de réservation invalide' }, { status: 400 });
	}

	const result = await cancelBooking(bookingId, locals.user.id, locals.user.isAdmin);

	if (!result.success) {
		return json({ error: result.error }, { status: result.status ?? 400 });
	}

	// Broadcast cancellation
	sseManager.broadcast('booking_cancelled', { id: bookingId });

	return json({ success: true });
};
