import { json } from '@sveltejs/kit';
import { desc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { flatRequest } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.flat) {
		return json({ error: 'Non autorisé' }, { status: 401 });
	}
	if (!locals.flat.isAdmin) {
		return json({ error: 'Accès interdit' }, { status: 403 });
	}

	try {
		const requests = await db.select().from(flatRequest).orderBy(desc(flatRequest.createdAt)).all();

		return json({ requests });
	} catch (e) {
		console.error('[GET /api/admin/requests]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};
