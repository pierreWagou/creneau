import { json } from '@sveltejs/kit';
import { MAX_FLAT_BULK_SIZE } from '$lib/constants';
import { db } from '$lib/server/db';
import { flat } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.flat) {
		return json({ error: 'Non autorisé' }, { status: 401 });
	}
	if (!locals.flat.isAdmin) {
		return json({ error: 'Accès interdit' }, { status: 403 });
	}

	try {
		const { flats } = await request.json();

		if (!Array.isArray(flats) || flats.length === 0) {
			return json({ error: 'Liste des appartements requise' }, { status: 400 });
		}

		if (flats.length > MAX_FLAT_BULK_SIZE) {
			return json({ error: `Maximum ${MAX_FLAT_BULK_SIZE} appartements par lot` }, { status: 400 });
		}

		// Deduplicate and clean input
		const numbers = [...new Set(flats.map((f: unknown) => String(f).trim()).filter((f) => f.length > 0))];

		if (numbers.length === 0) {
			return json({ error: 'Aucun numéro valide fourni' }, { status: 400 });
		}

		let created = 0;
		const skipped: string[] = [];

		for (const number of numbers) {
			try {
				await db.insert(flat).values({ number });
				created++;
			} catch {
				// Unique constraint violation — flat already exists
				skipped.push(number);
			}
		}

		return json({ created, skipped }, { status: 201 });
	} catch (e) {
		if (e instanceof SyntaxError) {
			return json({ error: 'Requête invalide' }, { status: 400 });
		}
		console.error('[POST /api/admin/flats/bulk]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};
