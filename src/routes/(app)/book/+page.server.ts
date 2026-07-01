import { addMonths, endOfMonth, format, startOfMonth } from 'date-fns';
import { isNull } from 'drizzle-orm';
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
	const prefilledSpot = url.searchParams.get('spot');

	// Only load shared spots (not bound to any flat)
	const spots = await db.select().from(spot).where(isNull(spot.flatNumber)).all();

	// Load calendar statuses for the lookahead period (for cell coloring)
	const now = new Date();
	const from = format(startOfMonth(now), 'yyyy-MM-dd');
	const to = format(endOfMonth(addMonths(now, CALENDAR_LOOKAHEAD_MONTHS - 1)), 'yyyy-MM-dd');

	const targetSpot = prefilledSpot || spots[0]?.number;
	const calendarStatuses = await getCalendarStatuses(from, to, targetSpot);

	return {
		prefilledDate,
		prefilledEndDate,
		prefilledStartHour: prefilledStartHour ? parseInt(prefilledStartHour, 10) : null,
		prefilledEndHour: prefilledEndHour ? parseInt(prefilledEndHour, 10) : null,
		spots,
		calendarStatuses,
		initialSpot: targetSpot
	};
};
