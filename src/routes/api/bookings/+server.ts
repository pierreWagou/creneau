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
	const slotId = url.searchParams.get('slotId');

	if (!from || !to) {
		return json({ error: 'Missing from/to date parameters' }, { status: 400 });
	}

	const bookings = await getBookingsInRange(from, to, slotId ? parseInt(slotId) : undefined);
	return json({ bookings });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Non autorisé' }, { status: 401 });
	}

	const { slotId, startTime, endTime, label, note } = await request.json();

	if (!slotId || !startTime || !endTime) {
		return json({ error: 'Champs requis manquants' }, { status: 400 });
	}

	const result = await createBooking({
		slotId,
		flatId: locals.user.id,
		startTime,
		endTime,
		label: label || null,
		note: note || null
	});

	if (!result.success) {
		return json({ error: result.error }, { status: 409 });
	}

	// Broadcast to all connected clients
	sseManager.broadcast('booking_created', result.booking);

	return json({ booking: result.booking }, { status: 201 });
};
