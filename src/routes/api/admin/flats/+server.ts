import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { FLAT_NUMBER_REGEX, SPOT_NUMBER_REGEX } from '$lib/constants';
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
				displayName: flat.displayName,
				activationCode: flat.activationCode,
				activationCodeExpiresAt: flat.activationCodeExpiresAt,
				isAdmin: flat.isAdmin,
				isActive: flat.isActive,
				activatedAt: flat.activatedAt
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
		const { number, spotNumbers } = await request.json();

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

		const trimmedSpots = Array.isArray(spotNumbers)
			? [...new Set(spotNumbers.map((s: unknown) => String(s).trim()).filter((s) => s.length > 0))]
			: [];

		if (trimmedSpots.length === 0) {
			return json({ error: 'Au moins une place requise' }, { status: 400 });
		}

		for (const s of trimmedSpots) {
			if (!SPOT_NUMBER_REGEX.test(s)) {
				return json({ error: `Format de place invalide : "${s}" (ex. 01, 36)` }, { status: 400 });
			}
		}

		// Check spots don't already exist
		for (const spotNum of trimmedSpots) {
			const existingSpot = await db.select().from(spot).where(eq(spot.number, spotNum)).get();
			if (existingSpot) {
				return json({ error: `La place ${spotNum} existe déjà` }, { status: 409 });
			}
		}

		// Create flat in "Inactif" state
		const result = await db.insert(flat).values({ number: flatNumber }).returning().get();

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
