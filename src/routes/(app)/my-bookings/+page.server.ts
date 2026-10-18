import { redirect } from '@sveltejs/kit';
import { getBookingsByFlat } from '$lib/server/bookings';
import { db } from '$lib/server/db';
import { spot } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.flat) throw redirect(302, '/login');
	const bookings = await getBookingsByFlat(locals.flat.number);
	// Lightweight directory for ticket chip lifecycle colors
	const spots = await db
		.select({ number: spot.number, status: spot.status, flatNumber: spot.flatNumber })
		.from(spot)
		.all();
	return { bookings, spots };
};
