import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { spot } from '$lib/server/db/schema';
import { requireAdmin } from '$lib/server/guards';
import { errorJson, handleHandlerError } from '$lib/server/handler';
import { assertNoStrand } from '$lib/server/rebind';
import { canTransition } from '$lib/server/spot-state';
import type { RequestHandler } from './$types';

/**
 * POST — Swap a shared spot with a flat-bound spot (admin only).
 *
 * Body: { spotNumber: string, flatNumber: string, targetSpotNumber: string }
 *
 * - spotNumber:        the shared spot to assign (flatNumber IS NULL)
 * - flatNumber:        the target flat
 * - targetSpotNumber:  the flat's spot to unbind (lands limbo)
 *
 * If the flat has no bound spots, the shared spot is simply assigned (no unbind).
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const guard = requireAdmin(locals);
	if (guard) return guard;

	try {
		const { spotNumber, flatNumber, targetSpotNumber } = await request.json();

		if (!spotNumber || !flatNumber) {
			return errorJson('Paramètres manquants', 400);
		}

		// Validate the shared spot exists and is actually shared
		const sharedSpot = await db.select().from(spot).where(eq(spot.number, spotNumber)).get();
		if (!sharedSpot) {
			return errorJson('Place de parking introuvable', 404);
		}
		if (sharedSpot.flatNumber !== null) {
			return errorJson("Cette place de parking n'est pas partagée", 400);
		}

		// If a target spot is specified, validate it belongs to the flat
		if (targetSpotNumber) {
			const targetSpot = await db.select().from(spot).where(eq(spot.number, targetSpotNumber)).get();
			if (!targetSpot) {
				return errorJson('Place de parking cible introuvable', 404);
			}
			if (targetSpot.flatNumber !== flatNumber) {
				return errorJson("Cette place de parking n'est pas assignée à ce lot", 400);
			}
			// Transition guard: target goes assigned → unassigned (LIMBO)
			if (!canTransition(targetSpot.status, 'limbo', { hasFlat: true })) {
				return errorJson('Place de parking cible introuvable', 404);
			}
			// Strand guard: swapping away the flat's last spot is refused (409),
			// like every other detach path — a swap must never strand a lot at 0 spots.
			const stranded = await assertNoStrand(db, targetSpotNumber, flatNumber);
			if (stranded) return stranded;

			// Atomic swap: unbind target (lands limbo), bind shared
			await db.transaction(async (tx) => {
				await tx.update(spot).set({ flatNumber: null, status: 'unassigned' }).where(eq(spot.number, targetSpotNumber));
				await tx.update(spot).set({ flatNumber, status: 'assigned' }).where(eq(spot.number, spotNumber));
			});
		} else {
			// No target spot — just bind the shared spot
			await db.update(spot).set({ flatNumber, status: 'assigned' }).where(eq(spot.number, spotNumber));
		}

		return json({ success: true });
	} catch (e) {
		return handleHandlerError('POST /api/admin/spots/swap', e);
	}
};
