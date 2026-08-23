import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	flat,
	flatEmail,
	flatPhone,
	request,
	requestEmail,
	requestPhone,
	requestSpot,
	spot
} from '$lib/server/db/schema';
import { requireAdmin } from '$lib/server/guards';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request: req, locals }) => {
	const guard = requireAdmin(locals);
	if (guard) return guard;

	const requestId = Number(params.id);
	if (Number.isNaN(requestId)) {
		return json({ error: 'ID invalide' }, { status: 400 });
	}

	try {
		const existing = await db.select().from(request).where(eq(request.id, requestId)).get();

		if (!existing) {
			return json({ error: 'Demande introuvable' }, { status: 404 });
		}

		if (existing.status !== 'pending') {
			return json({ error: 'Cette demande a déjà été traitée' }, { status: 409 });
		}

		// Check flat doesn't already exist
		const existingFlat = await db.select().from(flat).where(eq(flat.number, existing.flatNumber)).get();
		if (existingFlat) {
			return json({ error: `L'appartement ${existing.flatNumber} existe déjà` }, { status: 409 });
		}

		// Read requested spots
		const requestedSpots = await db.select().from(requestSpot).where(eq(requestSpot.requestId, requestId)).all();

		// Detect conflicts: requested spots currently bound to other flats
		const conflicts: { spotNumber: string; currentFlat: string }[] = [];
		for (const row of requestedSpots) {
			const existingSpot = await db.select().from(spot).where(eq(spot.number, row.spotNumber)).get();
			if (existingSpot?.flatNumber && existingSpot.flatNumber !== existing.flatNumber) {
				conflicts.push({ spotNumber: row.spotNumber, currentFlat: existingSpot.flatNumber });
			}
		}

		// Check for force flag
		let force = false;
		try {
			const body = await req.json();
			force = body?.force === true;
		} catch {
			// No body or invalid JSON
		}

		if (conflicts.length > 0 && !force) {
			return json({ error: 'Conflit de place de parking', conflicts }, { status: 409 });
		}

		// Force: check that reassignment won't leave any source flat with 0 spots
		if (force) {
			for (const conflict of conflicts) {
				const sourceFlatSpots = await db.select().from(spot).where(eq(spot.flatNumber, conflict.currentFlat)).all();
				if (sourceFlatSpots.length <= 1) {
					return json(
						{
							error: `Impossible de réaffecter la place de parking ${conflict.spotNumber} — l'appartement ${conflict.currentFlat} n'aurait plus de place de parking`
						},
						{ status: 409 }
					);
				}
			}
		}

		// Read contacts from request tables
		const reqEmails = await db.select().from(requestEmail).where(eq(requestEmail.requestId, requestId)).all();
		const reqPhones = await db.select().from(requestPhone).where(eq(requestPhone.requestId, requestId)).all();

		// Create the flat
		await db.insert(flat).values({
			number: existing.flatNumber,
			status: 'inactive',
			displayName: existing.requesterName
		});

		// Move contacts to flat tables
		if (reqEmails.length > 0) {
			await db.insert(flatEmail).values(reqEmails.map((r) => ({ flatNumber: existing.flatNumber, email: r.email })));
		}
		if (reqPhones.length > 0) {
			await db.insert(flatPhone).values(reqPhones.map((r) => ({ flatNumber: existing.flatNumber, phone: r.phone })));
		}

		// Bind spots
		for (const row of requestedSpots) {
			const existingSpot = await db.select().from(spot).where(eq(spot.number, row.spotNumber)).get();
			if (existingSpot) {
				await db.update(spot).set({ flatNumber: existing.flatNumber }).where(eq(spot.number, row.spotNumber));
			} else {
				await db.insert(spot).values({ number: row.spotNumber, flatNumber: existing.flatNumber });
			}
		}

		// Mark request as approved (keeps record for audit)
		await db
			.update(request)
			.set({
				status: 'approved',
				reviewedAt: new Date().toISOString(),
				reviewedBy: locals.flat!.number
			})
			.where(eq(request.id, requestId));

		return json({ message: 'Demande approuvée' });
	} catch (e) {
		console.error('[POST /api/admin/requests/:id]', e);
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
		const existing = await db.select().from(request).where(eq(request.id, requestId)).get();

		if (!existing) {
			return json({ error: 'Demande introuvable' }, { status: 404 });
		}

		if (existing.status !== 'pending') {
			return json({ error: 'Cette demande a déjà été traitée' }, { status: 409 });
		}

		// Mark as rejected
		await db
			.update(request)
			.set({
				status: 'rejected',
				reviewedAt: new Date().toISOString(),
				reviewedBy: locals.flat!.number
			})
			.where(eq(request.id, requestId));

		return json({ success: true });
	} catch (e) {
		console.error('[PATCH /api/admin/requests/:id]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};
