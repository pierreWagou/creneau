import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAvailableSlots } from '$lib/server/availability';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		return json({ error: 'Non autorisé' }, { status: 401 });
	}

	const from = url.searchParams.get('from');
	const to = url.searchParams.get('to');
	const spotId = url.searchParams.get('spotId');

	if (!from || !to || !spotId) {
		return json({ error: 'Paramètres from/to/spotId requis' }, { status: 400 });
	}

	const parsedSpotId = parseInt(spotId);
	if (isNaN(parsedSpotId)) {
		return json({ error: 'Paramètre spotId invalide' }, { status: 400 });
	}

	const slots = await getAvailableSlots(from, to, parsedSpotId);
	return json({ slots });
};
