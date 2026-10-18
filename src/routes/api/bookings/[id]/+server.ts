import { json } from '@sveltejs/kit';
import { formatSpotNumber } from '$lib/constants';
import { cancelBooking, getBookingById, updateBooking } from '$lib/server/bookings';
import { getFlatEmails } from '$lib/server/contacts';
import { db } from '$lib/server/db';
import { requireAuth } from '$lib/server/guards';
import { errorJson, handleHandlerError, parseNumericId } from '$lib/server/handler';
import { mailFlag, sendBookingCancelledEmail, sendBookingMovedEmail, sendWithMailFlag } from '$lib/server/mail';
import { sseManager } from '$lib/server/sse';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request, locals, url }) => {
	const guard = requireAuth(locals);
	if (guard) return guard;

	const bookingId = parseNumericId(params, 'réservation');
	if (bookingId instanceof Response) return bookingId;

	try {
		const { startTime, endTime, note, spotNumber: rawSpotNumber } = await request.json();

		if ((startTime === undefined || endTime === undefined) && note === undefined && rawSpotNumber === undefined) {
			return errorJson('Heures de début et de fin requises', 400);
		}

		// Zero-padded like every other spot input (`7` hits stored `07`)
		const spotNumber = rawSpotNumber === undefined ? undefined : formatSpotNumber(String(rawSpotNumber).trim());

		const previous = await getBookingById(bookingId);

		const result = await updateBooking(
			bookingId,
			locals.flat!.number,
			{ startTime, endTime, note, spotNumber },
			locals.flat!.isAdmin
		);

		if (!result.success) {
			return errorJson(result.error, result.status);
		}

		// Every move is announced to the owner — including self-moves, as a
		// receipt (never fails the move). Note-only edits carry no times,
		// so they stay silent — otherwise the owner would get a “modifiée”
		// mail with identical old/new slots.
		// Delivery problems surface as a failure-only flag, never an error.
		let mailFailed = false;
		const spotChanged = previous && spotNumber !== undefined && spotNumber !== previous.spotNumber;
		if (previous && ((startTime !== undefined && endTime !== undefined) || spotChanged)) {
			({ mailFailed } = await sendWithMailFlag(
				'PATCH /api/bookings/:id',
				async () => {
					const recipients = await getFlatEmails(db, previous.flatNumber);
					return sendBookingMovedEmail(
						{
							bookingId,
							to: recipients,
							spotNumber: result.booking.spotNumber,
							flatNumber: previous.flatNumber,
							startTime: result.booking.startTime,
							endTime: result.booking.endTime
						},
						previous.startTime,
						previous.endTime,
						previous.flatNumber === locals.flat!.number,
						url.origin,
						previous.spotNumber
					);
				},
				`booking ${bookingId}`
			));
		}

		sseManager.broadcast('booking_updated', result.booking);
		return json({ booking: result.booking, ...mailFlag(mailFailed) });
	} catch (e) {
		return handleHandlerError('PATCH /api/bookings/:id', e);
	}
};

export const DELETE: RequestHandler = async ({ params, locals, url }) => {
	const guard = requireAuth(locals);
	if (guard) return guard;

	const bookingId = parseNumericId(params, 'réservation');
	if (bookingId instanceof Response) return bookingId;

	try {
		const previous = await getBookingById(bookingId);
		const result = await cancelBooking(bookingId, locals.flat!.number, locals.flat!.isAdmin);

		if (!result.success) {
			return errorJson(result.error, result.status);
		}

		// Every cancellation is announced to the owner — including
		// self-cancels, as a receipt with the calendar retraction
		// (never fails the cancellation).
		// Delivery problems surface as a failure-only flag, never an error.
		let mailFailed = false;
		if (previous) {
			({ mailFailed } = await sendWithMailFlag(
				'DELETE /api/bookings/:id',
				async () => {
					const recipients = await getFlatEmails(db, previous.flatNumber);
					return sendBookingCancelledEmail(
						{
							bookingId,
							to: recipients,
							spotNumber: previous.spotNumber,
							flatNumber: previous.flatNumber,
							startTime: previous.startTime,
							endTime: previous.endTime
						},
						previous.flatNumber === locals.flat!.number,
						url.origin
					);
				},
				`booking ${bookingId}`
			));
		}

		sseManager.broadcast('booking_cancelled', { id: bookingId });
		return json({ success: true, ...mailFlag(mailFailed) });
	} catch (e) {
		return handleHandlerError('DELETE /api/bookings/:id', e);
	}
};
