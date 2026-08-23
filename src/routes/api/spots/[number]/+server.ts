import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { spot } from '$lib/server/db/schema';
import { requireAdmin } from '$lib/server/guards';
import type { RequestHandler } from './$types';

/**
 * PATCH — Update a spot's description (admin only)
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const guard = requireAdmin(locals);
	if (guard) return guard;

	const spotNumber = params.number;

	try {
		const { description } = await request.json();

		const existing = await db.select().from(spot).where(eq(spot.number, spotNumber)).get();
		if (!existing) {
			return json({ error: 'Place de parking introuvable' }, { status: 404 });
		}

		const updated = await db
			.update(spot)
			.set({ description: description?.trim() || null })
			.where(eq(spot.number, spotNumber))
			.returning()
			.get();

		return json({ spot: updated });
	} catch (e) {
		if (e instanceof SyntaxError) {
			return json({ error: 'Requête invalide' }, { status: 400 });
		}
		console.error('[PATCH /api/spots/:number]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};

/**
 * DELETE — Delete a spot (admin only)
 * Cascades to all bookings for this spot (FK cascade on delete).
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const guard = requireAdmin(locals);
	if (guard) return guard;

	const spotNumber = params.number;

	try {
		const existing = await db.select().from(spot).where(eq(spot.number, spotNumber)).get();
		if (!existing) {
			return json({ error: 'Place de parking introuvable' }, { status: 404 });
		}

		await db.delete(spot).where(eq(spot.number, spotNumber));

		return json({ success: true });
	} catch (e) {
		console.error('[DELETE /api/spots/:number]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};
