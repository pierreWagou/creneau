import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { formatSpotNumber } from '$lib/constants';
import { db } from '$lib/server/db';
import { requestSpot, spot } from '$lib/server/db/schema';
import { requireAdmin } from '$lib/server/guards';
import { errorJson, handleHandlerError } from '$lib/server/handler';
import { assertNoStrand } from '$lib/server/rebind';
import { shareSpot, shelveSpot } from '$lib/server/spot-state';
import type { RequestHandler } from './$types';

/**
 * PATCH — Update a spot's description or status (admin only)
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const guard = requireAdmin(locals);
	if (guard) return guard;

	const spotNumber = formatSpotNumber((params.number ?? '').trim());

	try {
		const { description, status } = await request.json();

		// Siding moves between pool and limbo (bound spots accepted, strand-checked)
		if (status !== undefined) {
			if (status !== 'shared' && status !== 'unassigned') {
				return errorJson('Statut invalide (partagée ou non affectée)', 400);
			}
			let updated = status === 'shared' ? await shareSpot(spotNumber) : await shelveSpot(spotNumber);
			// A description sent alongside the move is applied too (never silently dropped)
			if (description !== undefined) {
				updated = await db
					.update(spot)
					.set({ description: description?.trim() || null })
					.where(eq(spot.number, spotNumber))
					.returning()
					.get();
			}
			return json({ spot: updated });
		}

		const existing = await db.select().from(spot).where(eq(spot.number, spotNumber)).get();
		if (!existing) {
			return errorJson('Place de parking introuvable', 404);
		}

		const updated = await db
			.update(spot)
			.set({ description: description?.trim() || null })
			.where(eq(spot.number, spotNumber))
			.returning()
			.get();

		return json({ spot: updated });
	} catch (e) {
		return handleHandlerError('PATCH /api/spots/:number', e);
	}
};

/**
 * DELETE — Delete a spot (admin only)
 * Cascades to all bookings for this spot (FK cascade on delete).
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const guard = requireAdmin(locals);
	if (guard) return guard;

	const spotNumber = formatSpotNumber((params.number ?? '').trim());

	try {
		const existing = await db.select().from(spot).where(eq(spot.number, spotNumber)).get();
		if (!existing) {
			return errorJson('Place de parking introuvable', 404);
		}

		// Refuse to leave the holder lot with 0 spots
		if (existing.flatNumber) {
			const strandBlock = await assertNoStrand(db, spotNumber, existing.flatNumber);
			if (strandBlock) return strandBlock;
		}

		// request_spot.spotNumber is plain text by design (requests may name
		// spots that don't exist yet), so dangling rows are cleaned explicitly.
		await db.delete(requestSpot).where(eq(requestSpot.spotNumber, spotNumber));
		await db.delete(spot).where(eq(spot.number, spotNumber));

		return json({ success: true });
	} catch (e) {
		return handleHandlerError('DELETE /api/spots/:number', e);
	}
};
