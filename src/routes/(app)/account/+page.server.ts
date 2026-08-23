import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getFlatEmails, getFlatPhones } from '$lib/server/contacts';
import { db } from '$lib/server/db';
import { flat, spot } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const sessionFlat = locals.flat;
	if (!sessionFlat) throw redirect(302, '/login');

	const flatInfo = await db.select().from(flat).where(eq(flat.number, sessionFlat.number)).get();
	if (!flatInfo) throw redirect(302, '/login');
	const spots = await db.select().from(spot).where(eq(spot.flatNumber, sessionFlat.number)).all();

	const [emails, phones] = await Promise.all([
		getFlatEmails(db, sessionFlat.number),
		getFlatPhones(db, sessionFlat.number)
	]);

	return {
		flat: {
			number: flatInfo.number,
			displayName: flatInfo.displayName,
			isAdmin: flatInfo.isAdmin,
			activatedAt: flatInfo.activatedAt,
			emails,
			phones
		},
		spots
	};
};
