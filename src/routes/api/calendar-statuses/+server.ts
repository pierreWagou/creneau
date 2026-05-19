import { json } from '@sveltejs/kit';
import { getCalendarStatuses } from '$lib/server/availability';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.flat) {
		return json({ error: 'Non autorisé' }, { status: 401 });
	}

	const from = url.searchParams.get('from');
	const to = url.searchParams.get('to');
	const spotId = url.searchParams.get('spotId');

	if (!from || !to) {
		return json({ error: 'Paramètres from/to requis' }, { status: 400 });
	}

	const parsedSpotId = spotId ? parseInt(spotId, 10) : undefined;
	if (spotId && (parsedSpotId === undefined || Number.isNaN(parsedSpotId))) {
		return json({ error: 'Paramètre spotId invalide' }, { status: 400 });
	}

	try {
		const statuses = await getCalendarStatuses(from, to, parsedSpotId);
		return json({ statuses });
	} catch (e) {
		console.error('[GET /api/calendar-statuses]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};
