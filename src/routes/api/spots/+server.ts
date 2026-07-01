import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { spot } from '$lib/server/db/schema';
import { requireAdmin } from '$lib/server/guards';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const guard = requireAdmin(locals);
	if (guard) return guard;

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
		if (e instanceof SyntaxError) {
			return json({ error: 'Requête invalide' }, { status: 400 });
		}
		console.error('[POST /api/spots]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};
