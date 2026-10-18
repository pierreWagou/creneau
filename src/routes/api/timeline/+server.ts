import { json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { buildSpotTimeline, excludeBookingFromTimeline, validateRangeWindow } from '$lib/server/availability';
import { getBookingsInRange } from '$lib/server/bookings';
import { db } from '$lib/server/db';
import { spot } from '$lib/server/db/schema';
import { requireAuth } from '$lib/server/guards';
import { errorJson, handleHandlerError, parseOptionalNumericQuery } from '$lib/server/handler';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const guard = requireAuth(locals);
	if (guard) return guard;

	const from = url.searchParams.get('from');
	const to = url.searchParams.get('to');
	const spotNumber = url.searchParams.get('spot');
	const excludeParam = url.searchParams.get('exclude');
	const parsedExclude = parseOptionalNumericQuery(excludeParam, 'exclude');
	if (parsedExclude instanceof Response) return parsedExclude;
	const excludeId = parsedExclude;

	if (!from || !to || !spotNumber) {
		return errorJson('Paramètres from/to/spot requis', 400);
	}

	const rangeError = validateRangeWindow(from, to);
	if (rangeError) {
		return errorJson(rangeError, 400);
	}

	try {
		// Validate spot is shared (not bound to any flat)
		const targetSpot = await db
			.select()
			.from(spot)
			.where(and(eq(spot.number, spotNumber), eq(spot.status, 'shared')))
			.get();

		if (!targetSpot) {
			return errorJson('Place de parking introuvable', 404);
		}

		const bookings = await getBookingsInRange(from, to, spotNumber);
		// Edit mode: the booking being moved must not block its own slot.
		// Owner-or-admin — admins may edit any booking, so the param ghosts
		// their target too; anyone else can only hide their own booking.
		const visible = excludeBookingFromTimeline(bookings, excludeId, locals.flat?.number, locals.flat?.isAdmin);
		const timeline = buildSpotTimeline(visible, from, to);
		return json(timeline);
	} catch (e) {
		return handleHandlerError('GET /api/timeline', e);
	}
};
