import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { errorJson } from '$lib/server/handler';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		await db.run(sql`SELECT 1`);
		return json({ status: 'ok' });
	} catch (e) {
		console.error('[health] database unreachable:', e);
		return errorJson('Service indisponible', 503);
	}
};
