import { redirect } from '@sveltejs/kit';
import { getBookingsByFlat } from '$lib/server/bookings';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.flat) {
		throw redirect(302, '/login');
	}
	const bookings = await getBookingsByFlat(locals.flat.number);
	return { bookings };
};
