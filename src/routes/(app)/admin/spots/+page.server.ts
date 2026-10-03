import { redirect } from '@sveltejs/kit';
import { count } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { flat, spot } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.flat?.isAdmin) {
		throw redirect(302, '/calendar');
	}

	// Load spots
	const spots = await db.select().from(spot).all();

	const [{ total: grandTotal }] = await db.select({ total: count() }).from(flat).all();

	// Lightweight full list for cross-page lookups (swap targets, spot owners)
	const allFlatBrief = await db
		.select({ number: flat.number, displayName: flat.displayName })
		.from(flat)
		.orderBy(flat.number)
		.all();
	const ownerNames: Record<string, string | null> = Object.fromEntries(
		allFlatBrief.map((f) => [f.number, f.displayName])
	);

	return {
		spots,
		ownerNames,
		flatOptions: allFlatBrief,
		grandTotal
	};
};
