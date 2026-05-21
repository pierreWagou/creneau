import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { flat } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const sessionFlat = locals.flat!;

	const flatInfo = await db.select().from(flat).where(eq(flat.number, sessionFlat.number)).get();

	return {
		flat: {
			number: flatInfo!.number,
			displayName: flatInfo!.displayName,
			isAdmin: flatInfo!.isAdmin,
			activatedAt: flatInfo!.activatedAt
		}
	};
};
