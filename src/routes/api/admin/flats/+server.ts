import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { setFlatEmails, setFlatPhones } from '$lib/server/contacts';
import { db } from '$lib/server/db';
import { flat } from '$lib/server/db/schema';
import { requireAdmin } from '$lib/server/guards';
import { errorJson, handleHandlerError, parseFlatNumber, validateContactInputs } from '$lib/server/handler';
import { bindSpotsToFlat, detectConflicts, guardRebind, parseSpotListInput } from '$lib/server/rebind';
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
		return handleHandlerError('GET /api/admin/flats', e);
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const guard = requireAdmin(locals);
	if (guard) return guard;

	try {
		const { number, displayName, spotNumbers, emails, phones, force: forceBody } = await request.json();
		const force = forceBody === true;

		if (!number) {
			return errorJson('Numéro de lot requis', 400);
		}

		const flatNumber = parseFlatNumber(number);
		if (flatNumber instanceof Response) return flatNumber;

		// Check flat doesn't already exist
		const existingFlat = await db.select().from(flat).where(eq(flat.number, flatNumber)).get();
		if (existingFlat) {
			return errorJson('Ce lot existe déjà', 409);
		}

		const validated = validateContactInputs(emails, phones);
		if (validated instanceof Response) return validated;
		const { emails: validatedEmails, phones: validatedPhones } = validated;

		const parsedSpots = parseSpotListInput(spotNumbers, 'Au moins une place de parking requise');
		if (parsedSpots instanceof Response) return parsedSpots;
		const trimmedSpots = parsedSpots;

		// Detect conflicts: spots already bound to other flats
		const conflicts = await detectConflicts(db, trimmedSpots, flatNumber);

		const refused = await guardRebind(db, conflicts, force);
		if (refused) return refused;

		// All writes in one transaction: flat + contacts + spot binds succeed or fail together
		const displayNameTrimmed = String(displayName ?? '').trim() || null;
		const result = await db.transaction(async (tx) => {
			// Create flat in "inactive" state
			const created = await tx
				.insert(flat)
				.values({ number: flatNumber, status: 'inactive', displayName: displayNameTrimmed })
				.returning()
				.get();

			// Insert emails and phones (sequenced: single tx connection)
			await setFlatEmails(tx, flatNumber, validatedEmails);
			await setFlatPhones(tx, flatNumber, validatedPhones);

			// Create/bind spots
			await bindSpotsToFlat(tx, trimmedSpots, flatNumber);

			return created;
		});

		return json({ flat: { ...result, emails: validatedEmails, phones: validatedPhones } }, { status: 201 });
	} catch (e) {
		return handleHandlerError('POST /api/admin/flats', e);
	}
};
