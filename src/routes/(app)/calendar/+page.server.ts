import { addWeeks, endOfWeek, format, startOfWeek } from 'date-fns';
import { getBookingsInRange } from '$lib/server/bookings';
import { db } from '$lib/server/db';
import { spot } from '$lib/server/db/schema';
import { DAY_END, DAY_START } from '$lib/types';
import { padH } from '$lib/utils/time';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const now = new Date();
	// Show current week + next 3 weeks by default
	const from = format(startOfWeek(now, { weekStartsOn: 1 }), `yyyy-MM-dd'T'${padH(DAY_START)}:00:00`);
	const to = format(endOfWeek(addWeeks(now, 3), { weekStartsOn: 1 }), `yyyy-MM-dd'T'${padH(DAY_END)}:00:00`);

	const bookings = await getBookingsInRange(from, to);
	const spots = await db.select().from(spot).all();

	return { bookings, spots };
};
