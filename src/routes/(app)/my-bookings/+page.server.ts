import { getBookingsByFlat } from '$lib/server/bookings';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const bookings = await getBookingsByFlat(locals.flat!.number);
	return { bookings };
};
