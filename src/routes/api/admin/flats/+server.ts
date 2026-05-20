import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { flat } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.flat) {
		return json({ error: 'Non autorisé' }, { status: 401 });
	}
	if (!locals.flat.isAdmin) {
		return json({ error: 'Accès interdit' }, { status: 403 });
	}

	try {
		const flats = await db
			.select({
				number: flat.number,
				displayName: flat.displayName,
				activationCode: flat.activationCode,
				activationCodeExpiresAt: flat.activationCodeExpiresAt,
				isAdmin: flat.isAdmin,
				isActive: flat.isActive,
				activatedAt: flat.activatedAt
			})
			.from(flat)
			.all();

		return json({ flats });
	} catch (e) {
		console.error('[GET /api/admin/flats]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.flat) {
		return json({ error: 'Non autorisé' }, { status: 401 });
	}
	if (!locals.flat.isAdmin) {
		return json({ error: 'Accès interdit' }, { status: 403 });
	}

	try {
		const { number } = await request.json();

		if (!number) {
			return json({ error: "Numéro d'appartement requis" }, { status: 400 });
		}

		// Create flat in "Inactif" state — no activation code yet
		const result = await db.insert(flat).values({ number: number.trim() }).returning().get();

		return json({ flat: result }, { status: 201 });
	} catch (e) {
		console.error('[POST /api/admin/flats]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};
