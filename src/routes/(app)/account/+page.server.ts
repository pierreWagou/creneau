import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { flat, booking } from '$lib/server/db/schema';
import { eq, and, gt } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	const sessionFlat = locals.flat!;

	// Fetch full flat info
	const flatInfo = await db.select().from(flat).where(eq(flat.id, sessionFlat.id)).get();

	// Count total bookings
	const allBookings = await db.select({ id: booking.id }).from(booking).where(eq(booking.flatId, sessionFlat.id)).all();

	// Count upcoming bookings (endTime > now)
	const now = new Date().toISOString();
	const upcomingBookings = await db
		.select({ id: booking.id })
		.from(booking)
		.where(and(eq(booking.flatId, sessionFlat.id), gt(booking.endTime, now)))
		.all();

	return {
		flat: {
			number: flatInfo!.number,
			displayName: flatInfo!.displayName,
			isAdmin: flatInfo!.isAdmin,
			activatedAt: flatInfo!.activatedAt
		},
		stats: {
			totalBookings: allBookings.length,
			upcomingBookings: upcomingBookings.length
		}
	};
};
