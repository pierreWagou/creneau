import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { flat } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		throw redirect(302, '/calendar');
	}

	// Get list of active flats (for the flat number selector)
	const flats = await db
		.select({ number: flat.number })
		.from(flat)
		.where(eq(flat.isActive, true))
		.all();

	return { flats: flats.map((f) => f.number) };
};
