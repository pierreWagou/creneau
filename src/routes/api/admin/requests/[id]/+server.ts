import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { formatSpotNumber, SPOT_NUMBER_REGEX } from '$lib/constants';
import { validateEmails, validatePhones } from '$lib/server/contacts';
import { db } from '$lib/server/db';
import { flat, flatEmail, flatPhone, request, requestEmail, requestPhone, requestSpot } from '$lib/server/db/schema';
import { requireAdmin } from '$lib/server/guards';
import { bindSpotsToFlat, detectConflicts, guardRebind } from '$lib/server/rebind';
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
			return json({ error: `Le lot ${existing.flatNumber} existe déjà` }, { status: 409 });
		}

		// Read requested spots
		const requestedSpots = await db.select().from(requestSpot).where(eq(requestSpot.requestId, requestId)).all();

		// Detect conflicts: requested spots currently bound to other flats
		const conflicts = await detectConflicts(
			db,
			requestedSpots.map((r) => r.spotNumber),
			existing.flatNumber
		);

		// Check for force flag
		let force = false;
		try {
			const body = await req.json();
			force = body?.force === true;
		} catch {
			// No body or invalid JSON
		}

		const refused = await guardRebind(db, conflicts, force);
		if (refused) return refused;

		// Read contacts from request tables
		const reqEmails = await db.select().from(requestEmail).where(eq(requestEmail.requestId, requestId)).all();
		const reqPhones = await db.select().from(requestPhone).where(eq(requestPhone.requestId, requestId)).all();

		// All writes in one transaction: flat + contacts + binds + mark-approved succeed or fail together
		await db.transaction(async (tx) => {
			// Create the flat
			await tx.insert(flat).values({
				number: existing.flatNumber,
				status: 'inactive',
				displayName: existing.requesterName
			});

			// Move contacts to flat tables
			if (reqEmails.length > 0) {
				await tx.insert(flatEmail).values(reqEmails.map((r) => ({ flatNumber: existing.flatNumber, email: r.email })));
			}
			if (reqPhones.length > 0) {
				await tx.insert(flatPhone).values(reqPhones.map((r) => ({ flatNumber: existing.flatNumber, phone: r.phone })));
			}

			// Bind spots
			await bindSpotsToFlat(
				tx,
				requestedSpots.map((row) => row.spotNumber),
				existing.flatNumber
			);

			// Mark request as approved (keeps record for audit)
			await tx
				.update(request)
				.set({
					status: 'approved',
					reviewedAt: new Date().toISOString(),
					reviewedBy: locals.flat!.number
				})
				.where(eq(request.id, requestId));
		});

		return json({ message: 'Demande approuvée' });
	} catch (e) {
		console.error('[POST /api/admin/requests/:id]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ params, request: req, locals }) => {
	const guard = requireAdmin(locals);
	if (guard) return guard;

	const requestId = Number(params.id);
	if (Number.isNaN(requestId)) {
		return json({ error: 'ID invalide' }, { status: 400 });
	}

	let updates: Record<string, unknown>;
	try {
		updates = await req.json();
	} catch {
		return json({ error: 'Requête invalide' }, { status: 400 });
	}

	try {
		const existing = await db.select().from(request).where(eq(request.id, requestId)).get();

		if (!existing) {
			return json({ error: 'Demande introuvable' }, { status: 404 });
		}

		if (existing.status !== 'pending') {
			return json({ error: 'Cette demande a déjà été traitée' }, { status: 409 });
		}

		if ('requesterName' in updates) {
			await db
				.update(request)
				.set({ requesterName: String(updates.requesterName ?? '').trim() || null })
				.where(eq(request.id, requestId));
		}

		if ('emails' in updates) {
			const validatedEmails = validateEmails(updates.emails);
			if (typeof validatedEmails === 'string') {
				return json({ error: validatedEmails }, { status: 400 });
			}
			await db.delete(requestEmail).where(eq(requestEmail.requestId, requestId));
			if (validatedEmails.length > 0) {
				await db.insert(requestEmail).values(validatedEmails.map((email) => ({ requestId, email })));
			}
		}

		if ('phones' in updates) {
			const validatedPhones = validatePhones(updates.phones);
			if (typeof validatedPhones === 'string') {
				return json({ error: validatedPhones }, { status: 400 });
			}
			await db.delete(requestPhone).where(eq(requestPhone.requestId, requestId));
			if (validatedPhones.length > 0) {
				await db.insert(requestPhone).values(validatedPhones.map((phone) => ({ requestId, phone })));
			}
		}

		if ('spotNumbers' in updates) {
			const spotNumbers: string[] = Array.isArray(updates.spotNumbers) ? updates.spotNumbers : [];
			const trimmedSpots = [
				...new Set(spotNumbers.map((s) => formatSpotNumber(String(s).trim())).filter((s) => s.length > 0))
			];

			if (trimmedSpots.length === 0) {
				return json({ error: 'Une demande doit avoir au moins une place de parking' }, { status: 400 });
			}

			for (const s of trimmedSpots) {
				if (!SPOT_NUMBER_REGEX.test(s)) {
					return json({ error: `Format de place de parking invalide : "${s}" (ex. 01, 36)` }, { status: 400 });
				}
			}

			await db.delete(requestSpot).where(eq(requestSpot.requestId, requestId));
			await db.insert(requestSpot).values(trimmedSpots.map((spotNumber) => ({ requestId, spotNumber })));
		}

		const updated = await db.select().from(request).where(eq(request.id, requestId)).get();
		const emailRows = await db.select().from(requestEmail).where(eq(requestEmail.requestId, requestId)).all();
		const phoneRows = await db.select().from(requestPhone).where(eq(requestPhone.requestId, requestId)).all();
		const spotRows = await db.select().from(requestSpot).where(eq(requestSpot.requestId, requestId)).all();

		return json({
			request: {
				...updated,
				emails: emailRows.map((r) => r.email),
				phones: phoneRows.map((r) => r.phone),
				requestedSpots: spotRows.map((r) => r.spotNumber)
			}
		});
	} catch (e) {
		console.error('[PUT /api/admin/requests/:id]', e);
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
