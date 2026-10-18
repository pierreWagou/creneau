import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { flat, session } from '$lib/server/db/schema';
import { requireAdmin } from '$lib/server/guards';
import { errorJson, handleHandlerError } from '$lib/server/handler';
import type { RequestHandler } from './$types';

/**
 * POST — Reset an active flat (active → inactive)
 * Clears PIN, activation code, sessions. Requires confirmation.
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const guard = requireAdmin(locals);
	if (guard) return guard;

	const flatNumber = params.number;

	// Prevent admin from resetting their own account
	if (flatNumber === locals.flat!.number) {
		return errorJson('Impossible de réinitialiser votre propre lot', 400);
	}

	try {
		const { confirm } = await request.json();
		if (!confirm) {
			return errorJson('Confirmation requise', 400);
		}

		const existing = await db.select().from(flat).where(eq(flat.number, flatNumber)).get();
		if (!existing) {
			return errorJson('Lot introuvable', 404);
		}

		if (existing.status !== 'active') {
			return errorJson("Ce lot n'est pas actif", 400);
		}

		// Reset to inactive state
		await db
			.update(flat)
			.set({
				status: 'inactive',
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
	} catch (e) {
		return handleHandlerError('POST /api/admin/flats/:number/reset', e);
	}
};
