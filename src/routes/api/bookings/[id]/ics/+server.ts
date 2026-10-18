import { getBookingById } from '$lib/server/bookings';
import { requireAuth } from '$lib/server/guards';
import { errorJson, handleHandlerError, parseNumericId } from '$lib/server/handler';
import { bookingUid, buildICS } from '$lib/server/ics';
import type { RequestHandler } from './$types';

/**
 * GET — Download a booking as a calendar (.ics) invite.
 * Owner or admin only; past bookings included (calendars archive them).
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const guard = requireAuth(locals);
	if (guard) return guard;

	const bookingId = parseNumericId(params, 'réservation');
	if (bookingId instanceof Response) return bookingId;

	try {
		const booking = await getBookingById(bookingId);
		if (!booking) {
			return errorJson('Réservation introuvable', 404);
		}
		if (booking.flatNumber !== locals.flat!.number && !locals.flat!.isAdmin) {
			return errorJson("Vous n'avez pas accès à cette réservation", 403);
		}

		const ics = buildICS({
			uid: bookingUid(booking.id),
			start: booking.startTime,
			end: booking.endTime,
			summary: `Parking — Place ${booking.spotNumber}`,
			description: `Réservation Créneau — place ${booking.spotNumber} (lot ${booking.flatNumber})`,
			method: 'PUBLISH'
		});
		return new Response(ics, {
			headers: {
				'Content-Type': 'text/calendar; charset=utf-8',
				'Content-Disposition': `attachment; filename="reservation-${booking.id}.ics"`
			}
		});
	} catch (e) {
		return handleHandlerError('GET /api/bookings/:id/ics', e);
	}
};
