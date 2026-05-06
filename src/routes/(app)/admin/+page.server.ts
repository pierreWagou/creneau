import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { flat, spot } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user?.isAdmin) {
		throw redirect(302, '/calendar');
	}

	const flats = await db
		.select({
			id: flat.id,
			number: flat.number,
			activationCode: flat.activationCode,
			displayName: flat.displayName,
			isAdmin: flat.isAdmin,
			isActive: flat.isActive,
			activatedAt: flat.activatedAt
		})
		.from(flat)
		.all();
	const spots = await db.select().from(spot).all();

	return { flats, spots };
};
