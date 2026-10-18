import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { request } from '$lib/server/db/schema';
import { requireAdmin } from '$lib/server/guards';
import { handleHandlerError } from '$lib/server/handler';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const guard = requireAdmin(locals);
	if (guard) return guard;

	try {
		const requests = await db.select().from(request).where(eq(request.status, 'pending')).all();

		return json({ requests });
	} catch (e) {
		return handleHandlerError('GET /api/admin/requests', e);
	}
};
