import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getFlatEmails } from '$lib/server/contacts';
import { db } from '$lib/server/db';
import { flat } from '$lib/server/db/schema';
import { isInvitationExpired, reapExpiredInvitations } from '$lib/server/flat-state';
import { requireAdmin } from '$lib/server/guards';
import { errorJson, handleHandlerError } from '$lib/server/handler';
import { mailFlag, sendActivationEmail, sendWithMailFlag } from '$lib/server/mail';
import type { RequestHandler } from './$types';

/**
 * POST — Resend activation email with existing code (no regeneration).
 * Optional JSON body `{ email }` targets a single registered address;
 * a bare POST sends to every address on the lot.
 */
export const POST: RequestHandler = async ({ params, locals, url, request }) => {
	const guard = requireAdmin(locals);
	if (guard) return guard;

	const flatNumber = params.number;

	try {
		const existing = await db.select().from(flat).where(eq(flat.number, flatNumber)).get();
		if (!existing) {
			return errorJson('Lot introuvable', 404);
		}

		if (existing.status === 'active') {
			return errorJson('Ce lot est déjà activé', 409);
		}

		if (!existing.activationCode) {
			return errorJson("Aucun code d'activation à envoyer", 400);
		}

		// Fail-closed on dead invitations: reap the flat instead of emailing a dead link
		if (isInvitationExpired(existing.activationCodeExpiresAt)) {
			await reapExpiredInvitations();
			return errorJson("Code d'activation expiré. Générez un nouveau lien.", 410);
		}

		// Optional single-recipient override (tolerates an empty body — bare
		// POST keeps the historical send-to-all behavior). Must be registered
		// on the lot: the endpoint is not an arbitrary-address relay.
		let onlyEmail: string | undefined;
		const rawBody = await request.text();
		if (rawBody.trim() !== '') {
			const body = JSON.parse(rawBody) as { email?: unknown };
			if (typeof body.email === 'string' && body.email.trim() !== '') {
				onlyEmail = body.email.trim();
			} else if (body.email !== undefined) {
				return errorJson('Adresse email invalide', 400);
			}
		}

		const emails = await getFlatEmails(db, flatNumber);
		const targets = onlyEmail ? emails.filter((address) => address.toLowerCase() === onlyEmail.toLowerCase()) : emails;
		if (onlyEmail && targets.length === 0) {
			return errorJson('Adresse non enregistrée pour ce lot', 400);
		}
		// Delivery problems surface as a failure-only flag, never an error
		// (SMTP is an external failure domain — isolated from the DB action).
		// Hoisted: narrowing from the missing-code guard above is lost inside the callback.
		const activationCode = existing.activationCode;
		const { mailFailed } = await sendWithMailFlag(
			'POST /api/admin/flats/:number/activation/send',
			() => sendActivationEmail(db, flatNumber, activationCode, url.origin, onlyEmail),
			`lot ${flatNumber}`
		);
		return json({ emails: targets, ...mailFlag(mailFailed) });
	} catch (e) {
		return handleHandlerError('POST /api/admin/flats/:number/activation/send', e);
	}
};
