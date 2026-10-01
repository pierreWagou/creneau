import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { spot } from '$lib/server/db/schema';
import { requireAdmin } from '$lib/server/guards';
import { detectStrands, strandErrorMessage } from '$lib/server/rebind';
import type { RequestHandler } from './$types';

/**
 * PATCH — Update a spot's description (admin only)
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const guard = requireAdmin(locals);
	if (guard) return guard;

	const spotNumber = params.number;

	try {
		const { description, status } = await request.json();

		const existing = await db.select().from(spot).where(eq(spot.number, spotNumber)).get();
		if (!existing) {
			return json({ error: 'Place de parking introuvable' }, { status: 404 });
		}

		// Siding moves between pool and limbo (bound spots route through lot flows instead)
		if (status !== undefined) {
			if (status !== 'shared' && status !== 'unassigned') {
				return json({ error: 'Statut invalide (partagée ou en attente)' }, { status: 400 });
			}
			if (existing.flatNumber) {
				return json({ error: 'Place attribuée — utilisez les flux de lot' }, { status: 409 });
			}
			const updated = await db.update(spot).set({ status }).where(eq(spot.number, spotNumber)).returning().get();

			return json({ spot: updated });
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

		// Refuse to leave the holder lot with 0 spots
		if (existing.flatNumber) {
			const strands = await detectStrands(db, [{ spotNumber, currentFlat: existing.flatNumber }]);
			if (strands.length > 0) {
				return json({ error: strandErrorMessage(strands[0]) }, { status: 409 });
			}
		}

		await db.delete(spot).where(eq(spot.number, spotNumber));

		return json({ success: true });
	} catch (e) {
		console.error('[DELETE /api/spots/:number]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};
