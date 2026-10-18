import { json } from '@sveltejs/kit';
import { getCalendarStatuses, validateRangeWindow } from '$lib/server/availability';
import { requireAuth } from '$lib/server/guards';
import { errorJson, handleHandlerError, parseOptionalNumericQuery } from '$lib/server/handler';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const guard = requireAuth(locals);
	if (guard) return guard;

	const from = url.searchParams.get('from');
	const to = url.searchParams.get('to');
	const spot = url.searchParams.get('spot');
	const excludeParam = url.searchParams.get('exclude');
	const parsedExclude = parseOptionalNumericQuery(excludeParam, 'exclude');
	if (parsedExclude instanceof Response) return parsedExclude;
	const excludeId = parsedExclude;

	if (!from || !to) {
		return errorJson('Paramètres from/to requis', 400);
	}

	const rangeError = validateRangeWindow(from, to);
	if (rangeError) {
		return errorJson(rangeError, 400);
	}

	try {
		// Edit mode: the booking being moved must not paint its own day.
		// Owner-or-admin — admins may edit any booking, so the param ghosts
		// their target too; anyone else can only hide their own booking.
		const statuses = await getCalendarStatuses(
			from,
			to,
			spot || undefined,
			excludeId,
			locals.flat?.number,
			locals.flat?.isAdmin
		);
		return json({ statuses });
	} catch (e) {
		return handleHandlerError('GET /api/calendar-statuses', e);
	}
};
