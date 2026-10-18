import { json } from '@sveltejs/kit';
import { and, eq, notInArray } from 'drizzle-orm';
import { hashPin, validatePin } from '$lib/server/auth';
import {
	getFlatEmails,
	getFlatPhones,
	replaceValidatedContacts,
	setFlatEmails,
	setFlatPhones,
	validateEmails,
	validatePhones
} from '$lib/server/contacts';
import { db } from '$lib/server/db';
import { flat, spot } from '$lib/server/db/schema';
import { requireAdmin } from '$lib/server/guards';
import { errorJson, handleHandlerError } from '$lib/server/handler';
import { mailFlag, sendLotDeletedEmail, sendWithMailFlag } from '$lib/server/mail';
import { bindSpotsToFlat, detectConflicts, guardRebind, parseSpotListInput } from '$lib/server/rebind';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const guard = requireAdmin(locals);
	if (guard) return guard;

	const flatNumber = params.number;

	try {
		const updates = await request.json();

		// Existence up front: every branch below (contacts, spots, fields)
		// assumes the flat row, and must 404 instead of writing orphans.
		const existingFlat = await db.select().from(flat).where(eq(flat.number, flatNumber)).get();
		if (!existingFlat) {
			return errorJson('Lot introuvable', 404);
		}

		const allowedFields: Record<string, unknown> = {};

		if ('isAdmin' in updates) allowedFields.isAdmin = updates.isAdmin;
		if ('displayName' in updates) allowedFields.displayName = updates.displayName?.trim() || null;

		if ('pin' in updates) {
			const pinError = validatePin(String(updates.pin ?? ''));
			if (pinError) return errorJson(pinError, 400);
			allowedFields.pinHash = await hashPin(String(updates.pin));
		}

		// Handle email updates
		if ('emails' in updates) {
			const emailError = await replaceValidatedContacts(updates.emails, validateEmails, (values) =>
				setFlatEmails(db, flatNumber, values)
			);
			if (emailError) return errorJson(emailError, 400);
		}

		// Handle phone updates
		if ('phones' in updates) {
			const phoneError = await replaceValidatedContacts(updates.phones, validatePhones, (values) =>
				setFlatPhones(db, flatNumber, values)
			);
			if (phoneError) return errorJson(phoneError, 400);
		}

		// Handle spot re-binding
		if ('spotNumbers' in updates) {
			const parsedSpots = parseSpotListInput(updates.spotNumbers, 'Un lot doit avoir au moins une place de parking');
			if (parsedSpots instanceof Response) return parsedSpots;
			const trimmedSpots = parsedSpots;
			const force = updates.force === true;

			// Check for conflicts before doing anything
			const conflicts = await detectConflicts(db, trimmedSpots, flatNumber);

			const refused = await guardRebind(db, conflicts, force);
			if (refused) return refused;

			// Unbind removed spots + bind all, atomically
			await db.transaction(async (tx) => {
				await tx
					.update(spot)
					.set({ flatNumber: null, status: 'unassigned' })
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
		return handleHandlerError('PATCH /api/admin/flats/:number', e);
	}
};

export const DELETE: RequestHandler = async ({ params, locals, url }) => {
	const guard = requireAdmin(locals);
	if (guard) return guard;

	const flatNumber = params.number;

	if (flatNumber === locals.flat!.number) {
		return errorJson('Impossible de supprimer votre propre lot', 400);
	}

	try {
		// Recipients must be read before the delete: contacts
		// cascade on flat delete and the flat row disappears with them.
		const recipients = await getFlatEmails(db, flatNumber);
		// Freed spots land limbo (preserves the pre-status implicit landing),
		// atomically with the delete so no stale assigned status survives the FK set-null.
		await db.transaction(async (tx) => {
			await tx.update(spot).set({ flatNumber: null, status: 'unassigned' }).where(eq(spot.flatNumber, flatNumber));
			await tx.delete(flat).where(eq(flat.number, flatNumber));
		});

		// Courtesy notice to the former residents (never fails the delete).
		const { mailFailed } = await sendWithMailFlag(
			'DELETE /api/admin/flats/:number',
			() => sendLotDeletedEmail(recipients, flatNumber, url.origin),
			`lot ${flatNumber}`
		);
		return json({ success: true, ...mailFlag(mailFailed) });
	} catch (e) {
		return handleHandlerError('DELETE /api/admin/flats/:number', e);
	}
};
