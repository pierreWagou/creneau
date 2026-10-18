import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { REJECTION_REASON_MAX_LENGTH } from '$lib/constants';
import { replaceValidatedContacts, validateEmails, validatePhones } from '$lib/server/contacts';
import { db } from '$lib/server/db';
import { flat, flatEmail, flatPhone, request, requestEmail, requestPhone, requestSpot } from '$lib/server/db/schema';
import { inviteFlat } from '$lib/server/flat-state';
import { requireAdmin } from '$lib/server/guards';
import { errorJson, handleHandlerError, parseNumericId } from '$lib/server/handler';
import { mailFlag, sendRequestApprovedEmail, sendRequestRejectedEmail, sendWithMailFlag } from '$lib/server/mail';
import { bindSpotsToFlat, detectConflicts, guardRebind, parseSpotListInput } from '$lib/server/rebind';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request: req, locals, url }) => {
	const guard = requireAdmin(locals);
	if (guard) return guard;

	const parsedId = parseNumericId(params, 'demande');
	if (parsedId instanceof Response) return parsedId;
	const requestId = parsedId;

	try {
		const existing = await db.select().from(request).where(eq(request.id, requestId)).get();

		if (!existing) {
			return errorJson('Demande introuvable', 404);
		}

		if (existing.status !== 'pending') {
			return errorJson('Cette demande a déjà été traitée', 409);
		}

		// Check flat doesn't already exist
		const existingFlat = await db.select().from(flat).where(eq(flat.number, existing.flatNumber)).get();
		if (existingFlat) {
			return errorJson(`Le lot ${existing.flatNumber} existe déjà`, 409);
		}

		// Read requested spots
		const requestedSpots = await db.select().from(requestSpot).where(eq(requestSpot.requestId, requestId)).all();
		if (requestedSpots.length === 0) {
			return errorJson('Cette demande ne contient plus de place de parking', 400);
		}

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
			// Sanctioned: optional body → default force=false (no body or invalid JSON).
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

		// Approval also creates the invitation so the mail carries a usable
		// link right away. Mail never fails the approval: on any delivery
		// problem we log and still answer success (the code stays usable).
		const { mailFailed } = await sendWithMailFlag(
			'POST /api/admin/requests/:id',
			async () => {
				const invited = await inviteFlat(existing.flatNumber);
				if (!invited.activationCode) return true;
				return sendRequestApprovedEmail(
					db,
					existing.flatNumber,
					invited.activationCode,
					url.origin,
					reqEmails.map((r) => r.email)
				);
			},
			`flat ${existing.flatNumber}`
		);

		return json({ success: true, ...mailFlag(mailFailed) });
	} catch (e) {
		return handleHandlerError('POST /api/admin/requests/:id', e);
	}
};

export const PUT: RequestHandler = async ({ params, request: req, locals }) => {
	const guard = requireAdmin(locals);
	if (guard) return guard;

	const parsedId = parseNumericId(params, 'demande');
	if (parsedId instanceof Response) return parsedId;
	const requestId = parsedId;

	let updates: Record<string, unknown>;
	try {
		updates = await req.json();
	} catch (e) {
		return handleHandlerError('PUT /api/admin/requests/:id', e);
	}

	try {
		const existing = await db.select().from(request).where(eq(request.id, requestId)).get();

		if (!existing) {
			return errorJson('Demande introuvable', 404);
		}

		if (existing.status !== 'pending') {
			return errorJson('Cette demande a déjà été traitée', 409);
		}

		if ('requesterName' in updates) {
			await db
				.update(request)
				.set({ requesterName: String(updates.requesterName ?? '').trim() || null })
				.where(eq(request.id, requestId));
		}

		if ('emails' in updates) {
			const emailError = await replaceValidatedContacts(updates.emails, validateEmails, async (values) => {
				await db.delete(requestEmail).where(eq(requestEmail.requestId, requestId));
				if (values.length > 0) {
					await db.insert(requestEmail).values(values.map((email) => ({ requestId, email })));
				}
			});
			if (emailError) return errorJson(emailError, 400);
		}

		if ('phones' in updates) {
			const phoneError = await replaceValidatedContacts(updates.phones, validatePhones, async (values) => {
				await db.delete(requestPhone).where(eq(requestPhone.requestId, requestId));
				if (values.length > 0) {
					await db.insert(requestPhone).values(values.map((phone) => ({ requestId, phone })));
				}
			});
			if (phoneError) return errorJson(phoneError, 400);
		}

		if ('spotNumbers' in updates) {
			const parsedSpots = parseSpotListInput(
				updates.spotNumbers,
				'Une demande doit avoir au moins une place de parking'
			);
			if (parsedSpots instanceof Response) return parsedSpots;
			const trimmedSpots = parsedSpots;

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
		return handleHandlerError('PUT /api/admin/requests/:id', e);
	}
};

export const PATCH: RequestHandler = async ({ params, locals, request: req, url }) => {
	const guard = requireAdmin(locals);
	if (guard) return guard;

	const parsedId = parseNumericId(params, 'demande');
	if (parsedId instanceof Response) return parsedId;
	const requestId = parsedId;

	// Optional rejection reason (transient — email only, never stored).
	// A bare PATCH keeps working: empty bodies mean “no reason”.
	let reason: string | null = null;
	try {
		const rawBody = await req.text();
		if (rawBody.trim() !== '') {
			const body = JSON.parse(rawBody) as { reason?: unknown };
			if (typeof body.reason === 'string' && body.reason.trim() !== '') {
				reason = body.reason.trim().slice(0, REJECTION_REASON_MAX_LENGTH);
			}
		}
	} catch (e) {
		return handleHandlerError('PATCH /api/admin/requests/:id', e);
	}

	try {
		const existing = await db.select().from(request).where(eq(request.id, requestId)).get();

		if (!existing) {
			return errorJson('Demande introuvable', 404);
		}

		if (existing.status !== 'pending') {
			return errorJson('Cette demande a déjà été traitée', 409);
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

		// Courtesy notice to the requester (never fails the rejection).
		const { mailFailed } = await sendWithMailFlag(
			'PATCH /api/admin/requests/:id',
			async () => {
				const addresses = await db.select().from(requestEmail).where(eq(requestEmail.requestId, requestId)).all();
				return sendRequestRejectedEmail(
					addresses.map((r) => r.email),
					existing.requesterName,
					reason,
					existing.flatNumber,
					url.origin
				);
			},
			`request ${requestId}`
		);

		return json({ success: true, ...mailFlag(mailFailed) });
	} catch (e) {
		return handleHandlerError('PATCH /api/admin/requests/:id', e);
	}
};
