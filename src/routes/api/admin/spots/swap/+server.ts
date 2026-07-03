import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { spot } from '$lib/server/db/schema';
import { requireAdmin } from '$lib/server/guards';
import type { RequestHandler } from './$types';

/**
 * POST — Swap a shared spot with a flat-bound spot (admin only).
 *
 * Body: { spotNumber: string, flatNumber: string, targetSpotNumber: string }
 *
 * - spotNumber:        the shared spot to assign (flatNumber IS NULL)
 * - flatNumber:        the target flat
 * - targetSpotNumber:  the flat's spot to unbind (becomes shared)
 *
 * If the flat has no bound spots, the shared spot is simply assigned (no unbind).
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const guard = requireAdmin(locals);
	if (guard) return guard;

	try {
		const { spotNumber, flatNumber, targetSpotNumber } = await request.json();

		if (!spotNumber || !flatNumber) {
			return json({ error: 'Paramètres manquants' }, { status: 400 });
		}

		// Validate the shared spot exists and is actually shared
		const sharedSpot = await db.select().from(spot).where(eq(spot.number, spotNumber)).get();
		if (!sharedSpot) {
			return json({ error: 'Place introuvable' }, { status: 404 });
		}
		if (sharedSpot.flatNumber !== null) {
			return json({ error: "Cette place n'est pas partagée" }, { status: 400 });
		}

		// If a target spot is specified, validate it belongs to the flat
		if (targetSpotNumber) {
			const targetSpot = await db.select().from(spot).where(eq(spot.number, targetSpotNumber)).get();
			if (!targetSpot) {
				return json({ error: 'Place cible introuvable' }, { status: 404 });
			}
			if (targetSpot.flatNumber !== flatNumber) {
				return json({ error: "Cette place n'est pas assignée à cet appartement" }, { status: 400 });
			}

			// Atomic swap: unbind target, bind shared
			await db.transaction(async (tx) => {
				await tx.update(spot).set({ flatNumber: null }).where(eq(spot.number, targetSpotNumber));
				await tx.update(spot).set({ flatNumber }).where(eq(spot.number, spotNumber));
			});
		} else {
			// No target spot — just bind the shared spot
			await db.update(spot).set({ flatNumber }).where(eq(spot.number, spotNumber));
		}

		return json({ success: true });
	} catch (e) {
		if (e instanceof SyntaxError) {
			return json({ error: 'Requête invalide' }, { status: 400 });
		}
		console.error('[POST /api/admin/spots/swap]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};
