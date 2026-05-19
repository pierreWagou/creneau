import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { spot } from '$lib/server/db/schema';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.flat) {
		return json({ error: 'Non autorisé' }, { status: 401 });
	}

	const spots = await db.select().from(spot).all();
	return json({ spots });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.flat?.isAdmin) {
		return json({ error: 'Accès interdit' }, { status: 403 });
	}

	try {
		const { name, description } = await request.json();

		if (!name) {
			return json({ error: 'Nom de la place requis' }, { status: 400 });
		}

		const result = await db
			.insert(spot)
			.values({ name, description: description || null })
			.returning()
			.get();

		return json({ spot: result }, { status: 201 });
	} catch {
		return json({ error: 'Requête invalide' }, { status: 400 });
	}
};
