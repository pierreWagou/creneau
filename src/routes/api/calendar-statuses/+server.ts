import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCalendarStatuses } from '$lib/server/availability';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		return json({ error: 'Non autorisé' }, { status: 401 });
	}

	const from = url.searchParams.get('from');
	const to = url.searchParams.get('to');
	const slotId = url.searchParams.get('slotId');

	if (!from || !to) {
		return json({ error: 'Paramètres from/to requis' }, { status: 400 });
	}

	const statuses = await getCalendarStatuses(from, to, slotId ? parseInt(slotId) : undefined);
	return json({ statuses });
};
