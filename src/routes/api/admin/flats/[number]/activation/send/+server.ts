import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getFlatEmails } from '$lib/server/contacts';
import { db } from '$lib/server/db';
import { flat } from '$lib/server/db/schema';
import { isInvitationExpired, reapExpiredInvitations } from '$lib/server/flat-state';
import { requireAdmin } from '$lib/server/guards';
import { sendActivationEmail } from '$lib/server/mail';
import type { RequestHandler } from './$types';

/**
 * POST — Resend activation email with existing code (no regeneration)
 */
export const POST: RequestHandler = async ({ params, locals, url }) => {
	const guard = requireAdmin(locals);
	if (guard) return guard;

	const flatNumber = params.number;

	try {
		const existing = await db.select().from(flat).where(eq(flat.number, flatNumber)).get();
		if (!existing) {
			return json({ error: 'Lot introuvable' }, { status: 404 });
		}

		if (existing.status === 'active') {
			return json({ error: 'Ce lot est déjà activé' }, { status: 409 });
		}

		if (!existing.activationCode) {
			return json({ error: "Aucun code d'activation à envoyer" }, { status: 400 });
		}

		// Fail-closed on dead invitations: reap the flat instead of emailing a dead link
		if (isInvitationExpired(existing.activationCodeExpiresAt)) {
			await reapExpiredInvitations();
			return json({ error: "Code d'activation expiré. Générez un nouveau lien." }, { status: 410 });
		}

		const emails = await getFlatEmails(db, flatNumber);
		const emailSent = await sendActivationEmail(db, flatNumber, existing.activationCode, url.origin);
		return json({ emailSent, emails });
	} catch (e) {
		console.error('[POST /api/admin/flats/:number/activation/send]', e);
		return json({ error: 'Erreur interne' }, { status: 500 });
	}
};
