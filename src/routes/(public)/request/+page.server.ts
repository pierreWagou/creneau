import { db } from '$lib/server/db';
import { spot } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const rows = await db.select({ number: spot.number, status: spot.status, flatNumber: spot.flatNumber }).from(spot);
	return { spots: rows };
};
