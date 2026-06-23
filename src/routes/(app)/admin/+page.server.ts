import { redirect } from '@sveltejs/kit';
import { asc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { flat, spot } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.flat?.isAdmin) {
		throw redirect(302, '/calendar');
	}

	const flats = await db
		.select({
			number: flat.number,
			activationCode: flat.activationCode,
			activationCodeExpiresAt: flat.activationCodeExpiresAt,
			displayName: flat.displayName,
			isAdmin: flat.isAdmin,
			isActive: flat.isActive,
			activatedAt: flat.activatedAt
		})
		.from(flat)
		.orderBy(asc(flat.number))
		.all();
	const spots = await db.select().from(spot).all();

	return { flats, spots };
};
