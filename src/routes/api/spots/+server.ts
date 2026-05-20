import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { spot } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

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
		const { number, description } = await request.json();

		if (!number) {
			return json({ error: 'Numéro de la place requis' }, { status: 400 });
		}

		const result = await db
			.insert(spot)
			.values({ number: number.trim(), description: description || null })
			.returning()
			.get();

		return json({ spot: result }, { status: 201 });
	} catch (e) {
		console.error('[POST /api/spots]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};
