import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { flat, spot } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const sessionFlat = locals.flat;
	if (!sessionFlat) throw redirect(302, '/login');

	const flatInfo = await db.select().from(flat).where(eq(flat.number, sessionFlat.number)).get();
	if (!flatInfo) throw redirect(302, '/login');
	const spots = await db.select().from(spot).where(eq(spot.flatNumber, sessionFlat.number)).all();

	return {
		flat: {
			number: flatInfo.number,
			displayName: flatInfo.displayName,
			isAdmin: flatInfo.isAdmin,
			activatedAt: flatInfo.activatedAt
		},
		spots
	};
};
