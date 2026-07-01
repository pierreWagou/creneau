import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { flat, flatRequest, spot } from '$lib/server/db/schema';
import { requireAdmin } from '$lib/server/guards';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals }) => {
	const guard = requireAdmin(locals);
	if (guard) return guard;

	const requestId = Number(params.id);
	if (Number.isNaN(requestId)) {
		return json({ error: 'ID invalide' }, { status: 400 });
	}

	try {
		const existing = await db.select().from(flatRequest).where(eq(flatRequest.id, requestId)).get();

		if (!existing) {
			return json({ error: 'Demande introuvable' }, { status: 404 });
		}

		if (existing.status !== 'pending') {
			return json({ error: 'Cette demande a déjà été traitée' }, { status: 409 });
		}

		const spotNumbers = existing.spotNumbers;

		// Create flat
		const newFlat = await db
			.insert(flat)
			.values({
				number: existing.flatNumber,
				displayName: existing.requesterName || null
			})
			.returning()
			.get();

		// Create/bind spots
		for (const spotNum of spotNumbers) {
			const existingSpot = await db.select().from(spot).where(eq(spot.number, spotNum)).get();
			if (existingSpot) {
				await db.update(spot).set({ flatNumber: existing.flatNumber }).where(eq(spot.number, spotNum));
			} else {
				await db.insert(spot).values({ number: spotNum, flatNumber: existing.flatNumber });
			}
		}

		// Mark request as approved
		await db
			.update(flatRequest)
			.set({
				status: 'approved',
				reviewedAt: new Date().toISOString(),
				reviewedBy: locals.flat!.number
			})
			.where(eq(flatRequest.id, requestId));

		return json({
			flat: newFlat,
			spotsCreated: spotNumbers
		});
	} catch (e) {
		console.error('[POST /api/admin/requests/:id/approve]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async ({ params, locals }) => {
	const guard = requireAdmin(locals);
	if (guard) return guard;

	const requestId = Number(params.id);
	if (Number.isNaN(requestId)) {
		return json({ error: 'ID invalide' }, { status: 400 });
	}

	try {
		const existing = await db.select().from(flatRequest).where(eq(flatRequest.id, requestId)).get();

		if (!existing) {
			return json({ error: 'Demande introuvable' }, { status: 404 });
		}

		if (existing.status !== 'pending') {
			return json({ error: 'Cette demande a déjà été traitée' }, { status: 409 });
		}

		await db
			.update(flatRequest)
			.set({
				status: 'rejected',
				reviewedAt: new Date().toISOString(),
				reviewedBy: locals.flat!.number
			})
			.where(eq(flatRequest.id, requestId));

		return json({ success: true });
	} catch (e) {
		console.error('[PATCH /api/admin/requests/:id/reject]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};
