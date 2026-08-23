import { json } from '@sveltejs/kit';
import { and, eq, notInArray } from 'drizzle-orm';
import { formatSpotNumber, SPOT_NUMBER_REGEX } from '$lib/constants';
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
				return json({ error: 'Un appartement doit avoir au moins une place de parking' }, { status: 400 });
			}

			for (const s of trimmedSpots) {
				if (!SPOT_NUMBER_REGEX.test(s)) {
					return json({ error: `Format de place de parking invalide : "${s}" (ex. 01, 36)` }, { status: 400 });
				}
			}

			// Verify flat exists
			const existingFlat = await db.select().from(flat).where(eq(flat.number, flatNumber)).get();
			if (!existingFlat) {
				return json({ error: 'Appartement introuvable' }, { status: 404 });
			}

			// Check for conflicts before doing anything
			if (!force) {
				const conflicts: { spotNumber: string; currentFlat: string }[] = [];
				for (const spotNum of trimmedSpots) {
					const existingSpot = await db.select().from(spot).where(eq(spot.number, spotNum)).get();
					if (existingSpot?.flatNumber && existingSpot.flatNumber !== flatNumber) {
						conflicts.push({ spotNumber: spotNum, currentFlat: existingSpot.flatNumber });
					}
				}
				if (conflicts.length > 0) {
					return json({ error: 'Conflit de place de parking', conflicts }, { status: 409 });
				}
			} else {
				// Force: check that reassignment won't leave any source flat with 0 spots
				for (const spotNum of trimmedSpots) {
					const existingSpot = await db.select().from(spot).where(eq(spot.number, spotNum)).get();
					if (existingSpot?.flatNumber && existingSpot.flatNumber !== flatNumber) {
						const sourceFlatSpots = await db
							.select()
							.from(spot)
							.where(eq(spot.flatNumber, existingSpot.flatNumber))
							.all();
						if (sourceFlatSpots.length <= 1) {
							return json(
								{
									error: `Impossible de réaffecter la place de parking ${spotNum} — l'appartement ${existingSpot.flatNumber} n'aurait plus de place de parking`
								},
								{ status: 409 }
							);
						}
					}
				}
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
