import { json } from '@sveltejs/kit';
import { generateActivationCode } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { flat } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.flat?.isAdmin) {
		return json({ error: 'Accès interdit' }, { status: 403 });
	}

	const flats = await db
		.select({
			id: flat.id,
			number: flat.number,
			displayName: flat.displayName,
			activationCode: flat.activationCode,
			isAdmin: flat.isAdmin,
			isActive: flat.isActive,
			activatedAt: flat.activatedAt
		})
		.from(flat)
		.all();

	return json({ flats });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.flat?.isAdmin) {
		return json({ error: 'Accès interdit' }, { status: 403 });
	}

	try {
		const { number } = await request.json();

		if (!number) {
			return json({ error: "Numéro d'appartement requis" }, { status: 400 });
		}

		const activationCode = generateActivationCode();

		const result = await db.insert(flat).values({ number, activationCode }).returning().get();

		return json({ flat: result }, { status: 201 });
	} catch (e) {
		console.error('[POST /api/admin/flats]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};
