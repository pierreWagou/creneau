import { redirect } from '@sveltejs/kit';
import { asc, desc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { flat, flatRequest, spot } from '$lib/server/db/schema';
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
	const requests = await db.select().from(flatRequest).orderBy(desc(flatRequest.createdAt)).all();

	return { flats, spots, requests };
};
