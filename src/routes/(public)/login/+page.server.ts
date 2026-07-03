import { redirect } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { flat } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.flat) {
		throw redirect(302, '/calendar');
	}

	// If no flats exist, redirect to setup wizard
	const existingFlats = await db.select({ number: flat.number }).from(flat).all();
	if (existingFlats.length === 0) {
		throw redirect(302, '/setup');
	}

	try {
		const activeFlats = await db
			.select({ number: flat.number, displayName: flat.displayName })
			.from(flat)
			.where(eq(flat.isActive, true))
			.orderBy(asc(flat.number))
			.all();

		return { flats: activeFlats };
	} catch {
		// DB error fetching active flats — fall back to empty list (combobox degrades to text input)
		return { flats: [] };
	}
};
