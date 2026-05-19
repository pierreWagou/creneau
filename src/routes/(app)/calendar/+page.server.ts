import type { PageServerLoad } from './$types';
import { getBookingsInRange } from '$lib/server/bookings';
import { db } from '$lib/server/db';
import { spot } from '$lib/server/db/schema';
import { startOfWeek, endOfWeek, addWeeks, format } from 'date-fns';

export const load: PageServerLoad = async () => {
	const now = new Date();
	// Show current week + next 3 weeks by default
	const from = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd'T'00:00:00");
	const to = format(endOfWeek(addWeeks(now, 3), { weekStartsOn: 1 }), "yyyy-MM-dd'T'23:59:59");

	const bookings = await getBookingsInRange(from, to);
	const spots = await db.select().from(spot).all();

	return { bookings, spots, from, to };
};
