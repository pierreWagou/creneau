import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { spot } from '$lib/server/db/schema';
import { getCalendarStatuses } from '$lib/server/availability';
import { startOfMonth, endOfMonth, addMonths, format } from 'date-fns';

export const load: PageServerLoad = async ({ url }) => {
	const prefilledDate = url.searchParams.get('date') || '';
	const prefilledEndDate = url.searchParams.get('endDate') || '';
	const prefilledStartHour = url.searchParams.get('startHour') || '';
	const prefilledEndHour = url.searchParams.get('endHour') || '';
	const prefilledSpotId = url.searchParams.get('spotId');
	const spots = await db.select().from(spot).all();

	// Load calendar statuses for 3 months (for cell coloring)
	const now = new Date();
	const from = format(startOfMonth(now), 'yyyy-MM-dd');
	const to = format(endOfMonth(addMonths(now, 2)), 'yyyy-MM-dd');

	const targetSpotId = prefilledSpotId ? parseInt(prefilledSpotId) : spots[0]?.id;
	const calendarStatuses = await getCalendarStatuses(from, to, targetSpotId);

	return {
		prefilledDate,
		prefilledEndDate,
		prefilledStartHour: prefilledStartHour ? parseInt(prefilledStartHour) : null,
		prefilledEndHour: prefilledEndHour ? parseInt(prefilledEndHour) : null,
		spots,
		calendarStatuses,
		initialSpotId: targetSpotId
	};
};
