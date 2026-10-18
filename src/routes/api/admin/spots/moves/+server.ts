import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { flat, spot } from '$lib/server/db/schema';
import { requireAdmin } from '$lib/server/guards';
import { errorJson, handleHandlerError } from '$lib/server/handler';
import { type BatchMove, buildStrandErrorMessage, normalizeSpotNumbers, validateBatchMoves } from '$lib/server/rebind';
import type { RequestHandler } from './$types';

/**
 * POST — Atomically rebind a batch of spots across flats, pool, and limbo (admin only).
 *
 * Unlike the single-target endpoints, every move is validated against the *final*
 * holdings inside one transaction: an A↔B swap is legal even though each leg taken
 * alone looks like a conflict. Stranding any flat at 0 spots is always refused.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const guard = requireAdmin(locals);
	if (guard) return guard;

	try {
		const { moves } = (await request.json()) as { moves: BatchMove[] };

		if (!Array.isArray(moves) || moves.length === 0) {
			return errorJson('Au moins un déplacement est requis', 400);
		}

		const numbers = normalizeSpotNumbers(
			moves
				.filter((move): move is BatchMove => typeof move === 'object' && move !== null)
				.map((move) => move.spotNumber)
		);
		if (numbers.length === 0) {
			return errorJson('Au moins un numéro de place de parking valide est requis', 400);
		}
		// Load the whole table, not just the moved spots: final-holdings
		// strand detection must see the spots holders keep, not only the
		// ones leaving (a building holds dozens of spots — trivial scan).
		const current = await db.select().from(spot).all();
		const flats = await db.select({ number: flat.number }).from(flat).all();

		const validated = validateBatchMoves(
			current,
			flats.map((f) => f.number),
			moves
		);
		if ('error' in validated) {
			return errorJson(validated.error, validated.status);
		}
		if (validated.stranded.length > 0) {
			return errorJson(buildStrandErrorMessage(validated.stranded[0]), 409);
		}
		if (validated.writes.length === 0) {
			return json({ updated: 0 });
		}

		await db.transaction(async (tx) => {
			for (const write of validated.writes) {
				await tx
					.update(spot)
					.set({ flatNumber: write.flatNumber, status: write.status })
					.where(eq(spot.number, write.spotNumber));
			}
		});

		return json({ updated: validated.writes.length });
	} catch (e) {
		return handleHandlerError('POST /api/admin/spots/moves', e);
	}
};
