import { addWeeks, endOfWeek, format, startOfWeek } from 'date-fns';
import { isNull } from 'drizzle-orm';
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

	// Only load shared spots (not bound to any flat)
	const spots = await db.select().from(spot).where(isNull(spot.flatNumber)).all();

	// Load bookings for shared spots only
	const sharedSpotNumbers = spots.map((s) => s.number);
	const allBookings = await getBookingsInRange(from, to);
	const bookings = allBookings.filter((b) => sharedSpotNumbers.includes(b.spotNumber));

	return { bookings, spots };
};
