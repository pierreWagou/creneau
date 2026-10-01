import { json } from '@sveltejs/kit';
import { and, eq, notInArray } from 'drizzle-orm';
import { formatSpotNumber, SPOT_NUMBER_REGEX } from '$lib/constants';
import { hashPin, validatePin } from '$lib/server/auth';
import {
	getFlatEmails,
	getFlatPhones,
	setFlatEmails,
	setFlatPhones,
	validateEmails,
	validatePhones
} from '$lib/server/contacts';
import { db } from '$lib/server/db';
import { flat, spot } from '$lib/server/db/schema';
import { requireAdmin } from '$lib/server/guards';
import { bindSpotsToFlat, detectConflicts, detectStrands, strandErrorMessage } from '$lib/server/rebind';
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

		if ('pin' in updates) {
			const pinError = validatePin(String(updates.pin ?? ''));
			if (pinError) return json({ error: pinError }, { status: 400 });
			allowedFields.pinHash = await hashPin(String(updates.pin));
		}

		// Handle email updates
		if ('emails' in updates) {
			const validatedEmails = validateEmails(updates.emails);
			if (typeof validatedEmails === 'string') {
				return json({ error: validatedEmails }, { status: 400 });
			}
			await setFlatEmails(db, flatNumber, validatedEmails);
		}

		// Handle phone updates
		if ('phones' in updates) {
			const validatedPhones = validatePhones(updates.phones);
			if (typeof validatedPhones === 'string') {
				return json({ error: validatedPhones }, { status: 400 });
			}
			await setFlatPhones(db, flatNumber, validatedPhones);
		}

		// Handle spot re-binding
		if ('spotNumbers' in updates) {
			const spotNumbers: string[] = Array.isArray(updates.spotNumbers) ? updates.spotNumbers : [];
			const trimmedSpots = [...new Set(spotNumbers.map((s) => formatSpotNumber(s.trim())).filter((s) => s.length > 0))];
			const force = updates.force === true;

			if (trimmedSpots.length === 0) {
				return json({ error: 'Un lot doit avoir au moins une place de parking' }, { status: 400 });
			}

			for (const s of trimmedSpots) {
				if (!SPOT_NUMBER_REGEX.test(s)) {
					return json({ error: `Format de place de parking invalide : "${s}" (ex. 01, 36)` }, { status: 400 });
				}
			}

			// Verify flat exists
			const existingFlat = await db.select().from(flat).where(eq(flat.number, flatNumber)).get();
			if (!existingFlat) {
				return json({ error: 'Lot introuvable' }, { status: 404 });
			}

			// Check for conflicts before doing anything
			const conflicts = await detectConflicts(db, trimmedSpots, flatNumber);
			if (conflicts.length > 0 && !force) {
				return json({ error: 'Conflit de place de parking', conflicts }, { status: 409 });
			}
			// Force: refuse to strand any source flat with 0 spots
			if (force) {
				const strands = await detectStrands(db, conflicts);
				if (strands.length > 0) {
					return json({ error: strandErrorMessage(strands[0]) }, { status: 409 });
				}
			}

			// Unbind removed spots + bind all, atomically
			await db.transaction(async (tx) => {
				await tx
					.update(spot)
					.set({ flatNumber: null, status: 'shared' })
					.where(and(eq(spot.flatNumber, flatNumber), notInArray(spot.number, trimmedSpots)));
				await bindSpotsToFlat(tx, trimmedSpots, flatNumber);
			});
		}

		if (Object.keys(allowedFields).length > 0) {
			await db.update(flat).set(allowedFields).where(eq(flat.number, flatNumber));
		}

		const updated = await db.select().from(flat).where(eq(flat.number, flatNumber)).get();
		const [emails, phones] = await Promise.all([getFlatEmails(db, flatNumber), getFlatPhones(db, flatNumber)]);

		return json({ flat: { ...updated, emails, phones } });
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
		return json({ error: 'Impossible de supprimer votre propre lot' }, { status: 400 });
	}

	try {
		// Freed spots land shared (preserves the pre-status implicit landing),
		// atomically with the delete so no stale assigned status survives the FK set-null.
		await db.transaction(async (tx) => {
			await tx.update(spot).set({ flatNumber: null, status: 'shared' }).where(eq(spot.flatNumber, flatNumber));
			await tx.delete(flat).where(eq(flat.number, flatNumber));
		});
		return json({ success: true });
	} catch (e) {
		console.error('[DELETE /api/admin/flats/:number]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};
