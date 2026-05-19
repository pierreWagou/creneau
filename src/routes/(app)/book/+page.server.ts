import { addMonths, endOfMonth, format, startOfMonth } from 'date-fns';
import { CALENDAR_LOOKAHEAD_MONTHS } from '$lib/constants';
import { getCalendarStatuses } from '$lib/server/availability';
import { db } from '$lib/server/db';
import { spot } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const prefilledDate = url.searchParams.get('date') || '';
	const prefilledEndDate = url.searchParams.get('endDate') || '';
	const prefilledStartHour = url.searchParams.get('startHour') || '';
	const prefilledEndHour = url.searchParams.get('endHour') || '';
	const prefilledSpotId = url.searchParams.get('spotId');
	const spots = await db.select().from(spot).all();

	// Load calendar statuses for the lookahead period (for cell coloring)
	const now = new Date();
	const from = format(startOfMonth(now), 'yyyy-MM-dd');
	const to = format(endOfMonth(addMonths(now, CALENDAR_LOOKAHEAD_MONTHS - 1)), 'yyyy-MM-dd');

	const targetSpotId = prefilledSpotId ? parseInt(prefilledSpotId, 10) : spots[0]?.id;
	const calendarStatuses = await getCalendarStatuses(from, to, targetSpotId);

	return {
		prefilledDate,
		prefilledEndDate,
		prefilledStartHour: prefilledStartHour ? parseInt(prefilledStartHour, 10) : null,
		prefilledEndHour: prefilledEndHour ? parseInt(prefilledEndHour, 10) : null,
		spots,
		calendarStatuses,
		initialSpotId: targetSpotId
	};
};
