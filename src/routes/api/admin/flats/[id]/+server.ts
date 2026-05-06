import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { flat } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { generateActivationCode } from '$lib/server/auth';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user?.isAdmin) {
		return json({ error: 'Accès interdit' }, { status: 403 });
	}

	const flatId = parseInt(params.id);
	if (isNaN(flatId)) {
		return json({ error: 'Identifiant invalide' }, { status: 400 });
	}

	try {
		const updates = await request.json();
		const allowedFields: Record<string, unknown> = {};

		if ('isAdmin' in updates) allowedFields.isAdmin = updates.isAdmin;
		if ('regenerateCode' in updates && updates.regenerateCode) {
			allowedFields.activationCode = generateActivationCode();
			allowedFields.isActive = false;
			allowedFields.pinHash = null;
			allowedFields.displayName = null;
			allowedFields.activatedAt = null;
		}

		if (Object.keys(allowedFields).length === 0) {
			return json({ error: 'Aucun champ valide à mettre à jour' }, { status: 400 });
		}

		await db.update(flat).set(allowedFields).where(eq(flat.id, flatId));

		const updated = await db.select().from(flat).where(eq(flat.id, flatId)).get();
		return json({ flat: updated });
	} catch {
		return json({ error: 'Requête invalide' }, { status: 400 });
	}
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user?.isAdmin) {
		return json({ error: 'Accès interdit' }, { status: 403 });
	}

	const flatId = parseInt(params.id);
	if (isNaN(flatId)) {
		return json({ error: 'Identifiant invalide' }, { status: 400 });
	}

	if (flatId === locals.user.id) {
		return json({ error: 'Impossible de supprimer votre propre appartement' }, { status: 400 });
	}

	await db.delete(flat).where(eq(flat.id, flatId));
	return json({ success: true });
};
