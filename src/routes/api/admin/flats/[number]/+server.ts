import { json } from '@sveltejs/kit';
import { and, eq, notInArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { flat, spot } from '$lib/server/db/schema';
import { requireAdmin } from '$lib/server/guards';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const guard = requireAdmin(locals);
	if (guard) return guard;

	const flatNumber = params.number;

	try {
		const updates = await request.json();
		const allowedFields: Record<string, unknown> = {};

		if ('isAdmin' in updates) allowedFields.isAdmin = updates.isAdmin;
		if ('displayName' in updates) allowedFields.displayName = updates.displayName?.trim() || null;

		// Handle spot re-binding
		if ('spotNumbers' in updates) {
			const spotNumbers: string[] = Array.isArray(updates.spotNumbers) ? updates.spotNumbers : [];
			const trimmedSpots = [...new Set(spotNumbers.map((s) => s.trim()).filter((s) => s.length > 0))];

			if (trimmedSpots.length === 0) {
				return json({ error: 'Un appartement doit avoir au moins une place' }, { status: 400 });
			}

			// Verify flat exists
			const existingFlat = await db.select().from(flat).where(eq(flat.number, flatNumber)).get();
			if (!existingFlat) {
				return json({ error: 'Appartement introuvable' }, { status: 404 });
			}

			// Unbind spots no longer in the list
			await db
				.update(spot)
				.set({ flatNumber: null })
				.where(and(eq(spot.flatNumber, flatNumber), notInArray(spot.number, trimmedSpots)));

			// Bind new/existing spots
			for (const spotNum of trimmedSpots) {
				const existingSpot = await db.select().from(spot).where(eq(spot.number, spotNum)).get();
				if (existingSpot) {
					await db.update(spot).set({ flatNumber }).where(eq(spot.number, spotNum));
				} else {
					await db.insert(spot).values({ number: spotNum, flatNumber });
				}
			}
		}

		if (Object.keys(allowedFields).length > 0) {
			await db.update(flat).set(allowedFields).where(eq(flat.number, flatNumber));
		}

		const updated = await db.select().from(flat).where(eq(flat.number, flatNumber)).get();
		return json({ flat: updated });
	} catch (e) {
		if (e instanceof SyntaxError) {
			return json({ error: 'Requête invalide' }, { status: 400 });
		}
		console.error('[PATCH /api/admin/flats/:number]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const guard = requireAdmin(locals);
	if (guard) return guard;

	const flatNumber = params.number;

	if (flatNumber === locals.flat!.number) {
		return json({ error: 'Impossible de supprimer votre propre appartement' }, { status: 400 });
	}

	try {
		await db.delete(flat).where(eq(flat.number, flatNumber));
		return json({ success: true });
	} catch (e) {
		console.error('[DELETE /api/admin/flats/:number]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};
