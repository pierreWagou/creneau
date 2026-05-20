import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { flat } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.flat) {
		return json({ error: 'Non autorisé' }, { status: 401 });
	}
	if (!locals.flat.isAdmin) {
		return json({ error: 'Accès interdit' }, { status: 403 });
	}

	const flatNumber = params.number;

	try {
		const updates = await request.json();
		const allowedFields: Record<string, unknown> = {};

		if ('isAdmin' in updates) allowedFields.isAdmin = updates.isAdmin;

		if (Object.keys(allowedFields).length === 0) {
			return json({ error: 'Aucun champ valide à mettre à jour' }, { status: 400 });
		}

		await db.update(flat).set(allowedFields).where(eq(flat.number, flatNumber));

		const updated = await db.select().from(flat).where(eq(flat.number, flatNumber)).get();
		return json({ flat: updated });
	} catch (e) {
		console.error('[PATCH /api/admin/flats/:number]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.flat) {
		return json({ error: 'Non autorisé' }, { status: 401 });
	}
	if (!locals.flat.isAdmin) {
		return json({ error: 'Accès interdit' }, { status: 403 });
	}

	const flatNumber = params.number;

	if (flatNumber === locals.flat.number) {
		return json({ error: 'Impossible de supprimer votre propre appartement' }, { status: 400 });
	}

	try {
		await db.delete(flat).where(eq(flat.number, flatNumber));
		return json({ success: true });
	} catch (e) {
		console.error('[DELETE /api/admin/flats/:number]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};
