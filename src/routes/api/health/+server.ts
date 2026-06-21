import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		await db.run(sql`SELECT 1`);
		return json({ status: 'ok' });
	} catch {
		return json({ error: 'Service unavailable' }, { status: 503 });
	}
};
