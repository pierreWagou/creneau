import { json } from '@sveltejs/kit';
import { getCalendarStatuses } from '$lib/server/availability';
import { requireAuth } from '$lib/server/guards';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const guard = requireAuth(locals);
	if (guard) return guard;

	const from = url.searchParams.get('from');
	const to = url.searchParams.get('to');
	const spot = url.searchParams.get('spot');

	if (!from || !to) {
		return json({ error: 'Paramètres from/to requis' }, { status: 400 });
	}

	try {
		const statuses = await getCalendarStatuses(from, to, spot || undefined);
		return json({ statuses });
	} catch (e) {
		console.error('[GET /api/calendar-statuses]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};
