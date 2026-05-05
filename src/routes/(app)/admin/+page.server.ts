import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { flat, slot } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user?.isAdmin) {
		throw redirect(302, '/calendar');
	}

	const flats = await db.select().from(flat).all();
	const slots = await db.select().from(slot).all();

	return { flats, slots };
};
