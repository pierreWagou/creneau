import { json } from '@sveltejs/kit';
import { desc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { flatRequest } from '$lib/server/db/schema';
import { requireAdmin } from '$lib/server/guards';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const guard = requireAdmin(locals);
	if (guard) return guard;

	try {
		const requests = await db.select().from(flatRequest).orderBy(desc(flatRequest.createdAt)).all();

		return json({ requests });
	} catch (e) {
		console.error('[GET /api/admin/requests]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};
