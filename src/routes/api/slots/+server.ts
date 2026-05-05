import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { slot } from '$lib/server/db/schema';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Non autorisé' }, { status: 401 });
	}

	const slots = await db.select().from(slot).all();
	return json({ slots });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user?.isAdmin) {
		return json({ error: 'Accès interdit' }, { status: 403 });
	}

	const { name, description } = await request.json();

	if (!name) {
		return json({ error: 'Slot name is required' }, { status: 400 });
	}

	const result = await db
		.insert(slot)
		.values({ name, description: description || null })
		.returning()
		.get();

	return json({ slot: result }, { status: 201 });
};
