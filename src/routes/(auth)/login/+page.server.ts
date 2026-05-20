import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { flat } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.flat) {
		throw redirect(302, '/calendar');
	}

	// If no flats exist, redirect to setup wizard
	const existingFlats = await db.select().from(flat).all();
	if (existingFlats.length === 0) {
		throw redirect(302, '/setup');
	}

	return {};
};
