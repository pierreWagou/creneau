import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCalendarStatuses } from '$lib/server/availability';

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

	const statuses = await getCalendarStatuses(from, to, parsedSpotId);
	return json({ statuses });
};
