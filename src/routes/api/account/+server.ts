import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { DISPLAY_NAME_MAX_LENGTH } from '$lib/constants';
import { hashPin, validatePin, verifyPin } from '$lib/server/auth';
import {
	getFlatEmails,
	getFlatPhones,
	setFlatEmails,
	setFlatPhones,
	validateEmails,
	validatePhones
} from '$lib/server/contacts';
import { db } from '$lib/server/db';
import { flat } from '$lib/server/db/schema';
import { requireAuth } from '$lib/server/guards';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ request, locals }) => {
	const guard = requireAuth(locals);
	if (guard) return guard;

	try {
		const body = await request.json();
		const allowedFields: Record<string, unknown> = {};

		if ('displayName' in body) {
			const name = body.displayName?.trim() || null;
			if (name && name.length > DISPLAY_NAME_MAX_LENGTH) {
				return json({ error: `Le nom ne doit pas dépasser ${DISPLAY_NAME_MAX_LENGTH} caractères` }, { status: 400 });
			}
			allowedFields.displayName = name;
		}

		// Handle email updates
		if ('emails' in body) {
			const validatedEmails = validateEmails(body.emails);
			if (typeof validatedEmails === 'string') {
				return json({ error: validatedEmails }, { status: 400 });
			}
			await setFlatEmails(db, locals.flat!.number, validatedEmails);
		}

		// Handle phone updates
		if ('phones' in body) {
			const validatedPhones = validatePhones(body.phones);
			if (typeof validatedPhones === 'string') {
				return json({ error: validatedPhones }, { status: 400 });
			}
			await setFlatPhones(db, locals.flat!.number, validatedPhones);
		}

		if (Object.keys(allowedFields).length > 0) {
			await db.update(flat).set(allowedFields).where(eq(flat.number, locals.flat!.number));
		}

		const updated = await db.select().from(flat).where(eq(flat.number, locals.flat!.number)).get();
		const [emails, phones] = await Promise.all([
			getFlatEmails(db, locals.flat!.number),
			getFlatPhones(db, locals.flat!.number)
		]);

		return json({
			flat: {
				...updated,
				emails,
				phones
			}
		});
	} catch (e) {
		if (e instanceof SyntaxError) {
			return json({ error: 'Requête invalide' }, { status: 400 });
		}
		console.error('[PATCH /api/account]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const guard = requireAuth(locals);
	if (guard) return guard;

	try {
		const { currentPin, newPin } = await request.json();

		if (!currentPin || !newPin) {
			return json({ error: 'Champs obligatoires manquants' }, { status: 400 });
		}

		const pinError = validatePin(newPin);
		if (pinError) {
			return json({ error: pinError }, { status: 400 });
		}

		// Verify current PIN
		const existing = await db.select().from(flat).where(eq(flat.number, locals.flat!.number)).get();
		if (!existing?.pinHash) {
			return json({ error: 'Aucun PIN configuré' }, { status: 400 });
		}

		const valid = await verifyPin(currentPin, existing.pinHash);
		if (!valid) {
			return json({ error: 'PIN actuel incorrect' }, { status: 401 });
		}

		// Update PIN
		const pinHash = await hashPin(newPin);
		await db.update(flat).set({ pinHash }).where(eq(flat.number, locals.flat!.number));

		return json({ success: true });
	} catch (e) {
		if (e instanceof SyntaxError) {
			return json({ error: 'Requête invalide' }, { status: 400 });
		}
		console.error('[POST /api/account]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};
