import type { PageServerLoad } from './$types';
import { getBookingsByFlat } from '$lib/server/bookings';

export const load: PageServerLoad = async ({ locals }) => {
	const bookings = await getBookingsByFlat(locals.flat!.id);
	return { bookings };
};
