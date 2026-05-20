import { json } from '@sveltejs/kit';
import { buildSpotTimeline } from '$lib/server/availability';
import { getBookingsInRange } from '$lib/server/bookings';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.flat) {
		return json({ error: 'Non autorisé' }, { status: 401 });
	}

	const from = url.searchParams.get('from');
	const to = url.searchParams.get('to');
	const spot = url.searchParams.get('spot');

	if (!from || !to || !spot) {
		return json({ error: 'Paramètres from/to/spot requis' }, { status: 400 });
	}

	try {
		const bookings = await getBookingsInRange(from, to, spot);
		const timeline = buildSpotTimeline(bookings, from, to);
		return json(timeline);
	} catch (e) {
		console.error('[GET /api/timeline]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};
