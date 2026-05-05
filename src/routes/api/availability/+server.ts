import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAvailableSlots } from '$lib/server/availability';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		return json({ error: 'Non autorisé' }, { status: 401 });
	}

	const from = url.searchParams.get('from');
	const to = url.searchParams.get('to');
	const slotId = url.searchParams.get('slotId');

	if (!from || !to || !slotId) {
		return json({ error: 'Paramètres from/to/slotId requis' }, { status: 400 });
	}

	const slots = await getAvailableSlots(from, to, parseInt(slotId));
	return json({ slots });
};
