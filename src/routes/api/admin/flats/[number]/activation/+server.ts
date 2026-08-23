import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { ACTIVATION_CODE_TTL_MS } from '$lib/constants';
import { generateActivationCode } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { flat } from '$lib/server/db/schema';
import { requireAdmin } from '$lib/server/guards';
import type { RequestHandler } from './$types';

/**
 * POST — Generate an activation code (inactive → pending activation)
 */
export const POST: RequestHandler = async ({ params, locals }) => {
	const guard = requireAdmin(locals);
	if (guard) return guard;

	const flatNumber = params.number;

	try {
		const existing = await db.select().from(flat).where(eq(flat.number, flatNumber)).get();
		if (!existing) {
			return json({ error: 'Appartement introuvable' }, { status: 404 });
		}

		if (existing.status === 'active') {
			return json({ error: 'Cet appartement est déjà activé' }, { status: 409 });
		}

		const activationCode = generateActivationCode();
		const expiresAt = new Date(Date.now() + ACTIVATION_CODE_TTL_MS).toISOString();

		await db
			.update(flat)
			.set({ activationCode, activationCodeExpiresAt: expiresAt })
			.where(eq(flat.number, flatNumber));

		const updated = await db.select().from(flat).where(eq(flat.number, flatNumber)).get();
		return json({ flat: updated });
	} catch (e) {
		console.error('[POST /api/admin/flats/:number/activation]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};

/**
 * DELETE — Revoke an activation code (pending activation → inactive)
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const guard = requireAdmin(locals);
	if (guard) return guard;

	const flatNumber = params.number;

	try {
		const existing = await db.select().from(flat).where(eq(flat.number, flatNumber)).get();
		if (!existing) {
			return json({ error: 'Appartement introuvable' }, { status: 404 });
		}

		if (existing.status === 'active') {
			return json({ error: 'Cet appartement est déjà activé' }, { status: 409 });
		}

		if (!existing.activationCode) {
			return json({ error: "Aucun code d'activation à révoquer" }, { status: 400 });
		}

		await db
			.update(flat)
			.set({ activationCode: null, activationCodeExpiresAt: null })
			.where(eq(flat.number, flatNumber));

		const updated = await db.select().from(flat).where(eq(flat.number, flatNumber)).get();
		return json({ flat: updated });
	} catch (e) {
		console.error('[DELETE /api/admin/flats/:number/activation]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};
