import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { FLAT_NUMBER_REGEX, formatSpotNumber, SPOT_NUMBER_REGEX } from '$lib/constants';
import { setFlatEmails, setFlatPhones, validateEmails, validatePhones } from '$lib/server/contacts';
import { db } from '$lib/server/db';
import { flat, spot } from '$lib/server/db/schema';
import { requireAdmin } from '$lib/server/guards';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const guard = requireAdmin(locals);
	if (guard) return guard;

	try {
		const flats = await db
			.select({
				number: flat.number,
				status: flat.status,
				displayName: flat.displayName,
				activationCode: flat.activationCode,
				activationCodeExpiresAt: flat.activationCodeExpiresAt,
				isAdmin: flat.isAdmin,
				activatedAt: flat.activatedAt,
				createdAt: flat.createdAt
			})
			.from(flat)
			.all();

		return json({ flats });
	} catch (e) {
		console.error('[GET /api/admin/flats]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const guard = requireAdmin(locals);
	if (guard) return guard;

	try {
		const { number, spotNumbers, emails, phones, force: forceBody } = await request.json();
		const force = forceBody === true;

		if (!number) {
			return json({ error: "Numéro d'appartement requis" }, { status: 400 });
		}

		const flatNumber = number.trim().toUpperCase();
		if (!FLAT_NUMBER_REGEX.test(flatNumber)) {
			return json({ error: "Format d'appartement invalide (ex. A01, B12)" }, { status: 400 });
		}

		// Check flat doesn't already exist
		const existingFlat = await db.select().from(flat).where(eq(flat.number, flatNumber)).get();
		if (existingFlat) {
			return json({ error: 'Cet appartement existe déjà' }, { status: 409 });
		}

		const validatedEmails = validateEmails(emails);
		if (typeof validatedEmails === 'string') {
			return json({ error: validatedEmails }, { status: 400 });
		}

		const validatedPhones = validatePhones(phones);
		if (typeof validatedPhones === 'string') {
			return json({ error: validatedPhones }, { status: 400 });
		}

		const trimmedSpots = Array.isArray(spotNumbers)
			? [...new Set(spotNumbers.map((s: unknown) => formatSpotNumber(String(s).trim())).filter((s) => s.length > 0))]
			: [];

		if (trimmedSpots.length === 0) {
			return json({ error: 'Au moins une place de parking requise' }, { status: 400 });
		}

		for (const s of trimmedSpots) {
			if (!SPOT_NUMBER_REGEX.test(s)) {
				return json({ error: `Format de place de parking invalide : "${s}" (ex. 01, 36)` }, { status: 400 });
			}
		}

		// Detect conflicts: spots already bound to other flats
		const conflicts: { spotNumber: string; currentFlat: string }[] = [];
		for (const spotNum of trimmedSpots) {
			const existingSpot = await db.select().from(spot).where(eq(spot.number, spotNum)).get();
			if (existingSpot?.flatNumber && existingSpot.flatNumber !== flatNumber) {
				conflicts.push({ spotNumber: spotNum, currentFlat: existingSpot.flatNumber });
			}
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

		// Create flat in "inactive" state
		const result = await db.insert(flat).values({ number: flatNumber, status: 'inactive' }).returning().get();

		// Insert emails and phones
		await Promise.all([setFlatEmails(db, flatNumber, validatedEmails), setFlatPhones(db, flatNumber, validatedPhones)]);

		// Create/bind spots
		for (const spotNum of trimmedSpots) {
			const existingSpot = await db.select().from(spot).where(eq(spot.number, spotNum)).get();
			if (existingSpot) {
				await db.update(spot).set({ flatNumber }).where(eq(spot.number, spotNum));
			} else {
				await db.insert(spot).values({ number: spotNum, flatNumber });
			}
		}

		return json({ flat: result }, { status: 201 });
	} catch (e) {
		if (e instanceof SyntaxError) {
			return json({ error: 'Requête invalide' }, { status: 400 });
		}
		console.error('[POST /api/admin/flats]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};
