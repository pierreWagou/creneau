import { json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { formatSpotNumber } from '$lib/constants';
import { createBooking } from '$lib/server/bookings';
import { getFlatEmails } from '$lib/server/contacts';
import { db } from '$lib/server/db';
import { spot } from '$lib/server/db/schema';
import { requireAuth } from '$lib/server/guards';
import { errorJson, handleHandlerError } from '$lib/server/handler';
import { mailFlag, sendBookingConfirmationEmail, sendWithMailFlag } from '$lib/server/mail';
import { sseManager } from '$lib/server/sse';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, url }) => {
	const guard = requireAuth(locals);
	if (guard) return guard;

	try {
		const { spotNumber, startTime, endTime, note } = await request.json();

		if (!spotNumber || !startTime || !endTime) {
			return errorJson('Champs obligatoires manquants', 400);
		}

		// Zero-padded like every other spot input (`7` hits stored `07`)
		const normalizedSpot = formatSpotNumber(spotNumber.trim());

		// Validate spot is shared (not bound to any flat)
		const targetSpot = await db
			.select()
			.from(spot)
			.where(and(eq(spot.number, normalizedSpot), eq(spot.status, 'shared')))
			.get();

		if (!targetSpot) {
			return errorJson("Cette place de parking n'est pas disponible pour réservation", 400);
		}

		const result = await createBooking({
			spotNumber: normalizedSpot,
			flatNumber: locals.flat!.number,
			startTime,
			endTime,
			note: note || null
		});

		if (!result.success) {
			return errorJson(result.error, result.status);
		}

		// Booking receipt with a calendar invite (never fails the booking).
		const { mailFailed } = await sendWithMailFlag(
			'POST /api/bookings',
			async () => {
				const recipients = await getFlatEmails(db, result.booking.flatNumber);
				return sendBookingConfirmationEmail(
					{
						bookingId: result.booking.id,
						to: recipients,
						spotNumber: result.booking.spotNumber,
						flatNumber: result.booking.flatNumber,
						startTime: result.booking.startTime,
						endTime: result.booking.endTime
					},
					url.origin
				);
			},
			`booking ${result.booking.id}`
		);

		sseManager.broadcast('booking_created', result.booking);
		return json({ booking: result.booking, ...mailFlag(mailFailed) }, { status: 201 });
	} catch (e) {
		return handleHandlerError('POST /api/bookings', e);
	}
};
