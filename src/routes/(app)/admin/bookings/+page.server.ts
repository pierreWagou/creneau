import { redirect } from '@sveltejs/kit';
import { getAllBookings } from '$lib/server/bookings';
import { db } from '$lib/server/db';
import { spot } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.flat?.isAdmin) {
		throw redirect(302, '/calendar');
	}

	const bookings = await getAllBookings();
	// Lightweight directory for ticket chip lifecycle colors
	const spots = await db
		.select({ number: spot.number, status: spot.status, flatNumber: spot.flatNumber })
		.from(spot)
		.all();
	return { bookings, spots };
};
