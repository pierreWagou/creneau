import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { flat, session } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

/**
 * POST — Reset an active flat (Actif → Inactif)
 * Clears PIN, activation code, sessions. Requires confirmation.
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.flat) {
		return json({ error: 'Non autorisé' }, { status: 401 });
	}
	if (!locals.flat.isAdmin) {
		return json({ error: 'Accès interdit' }, { status: 403 });
	}

	const flatNumber = params.number;

	// Prevent admin from resetting their own account
	if (flatNumber === locals.flat.number) {
		return json({ error: 'Impossible de réinitialiser votre propre compte' }, { status: 400 });
	}

	try {
		const { confirm } = await request.json();
		if (!confirm) {
			return json({ error: 'Confirmation requise' }, { status: 400 });
		}
	} catch {
		return json({ error: 'Confirmation requise' }, { status: 400 });
	}

	const existing = await db.select().from(flat).where(eq(flat.number, flatNumber)).get();
	if (!existing) {
		return json({ error: 'Appartement introuvable' }, { status: 404 });
	}

	if (!existing.isActive) {
		return json({ error: "Cet appartement n'est pas actif" }, { status: 400 });
	}

	// Reset to Inactif state
	await db
		.update(flat)
		.set({
			isActive: false,
			pinHash: null,
			activationCode: null,
			activationCodeExpiresAt: null,
			displayName: null,
			activatedAt: null
		})
		.where(eq(flat.number, flatNumber));

	// Delete all sessions for this flat
	await db.delete(session).where(eq(session.flatNumber, flatNumber));

	const updated = await db.select().from(flat).where(eq(flat.number, flatNumber)).get();
	return json({ flat: updated });
};
