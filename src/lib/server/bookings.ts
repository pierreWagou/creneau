import { and, eq, gt, lt, ne } from 'drizzle-orm';
import { MAX_BOOKING_DAYS, MAX_BOOKING_HOURS, MS_PER_HOUR } from '$lib/constants';
import type { BookingWithFlat } from '$lib/types';
import { DAY_END, DAY_START } from '$lib/types';
import { dayBounds, foldMidnightEnd, getHourFromISO } from '$lib/utils/time';
import { db } from './db';
import { booking, flat, spot } from './db/schema';

interface CreateBookingInput {
	spotNumber: string;
	flatNumber: string;
	startTime: string;
	endTime: string;
	note?: string | null;
}

/**
 * Validate that booking start/end times satisfy hour-bound and duration rules.
 * Returns an error result on failure, or null on success.
 */
export function validateBookingTimes(
	startTime: string,
	endTime: string
): { success: false; error: string; status: number } | null {
	if (startTime >= endTime) {
		return { success: false, error: "L'heure de fin doit être après l'heure de début", status: 400 };
	}
	const startHour = getHourFromISO(startTime);
	const endHour = getHourFromISO(endTime);
	if (startHour < DAY_START || endHour > DAY_END) {
		return { success: false, error: 'Créneau en dehors des heures autorisées', status: 400 };
	}
	const durationHours = (new Date(endTime).getTime() - new Date(startTime).getTime()) / MS_PER_HOUR;
	if (durationHours > MAX_BOOKING_HOURS) {
		return {
			success: false,
			error: `La durée maximale d'une réservation est de ${MAX_BOOKING_DAYS} jours`,
			status: 400
		};
	}
	return null;
}

/** Shared select columns for BookingWithFlat queries */
const bookingWithFlatColumns = {
	id: booking.id,
	spotNumber: booking.spotNumber,
	flatNumber: booking.flatNumber,
	startTime: booking.startTime,
	endTime: booking.endTime,
	note: booking.note,
	createdAt: booking.createdAt,
	status: booking.status,
	flatDisplayName: flat.displayName
} as const;

/**
 * Check if a booking conflicts with existing bookings on the same spot
 */
async function hasConflict(
	spotNumber: string,
	startTime: string,
	endTime: string,
	excludeBookingId?: number
): Promise<boolean> {
	const conditions = [
		eq(booking.spotNumber, spotNumber),
		eq(booking.status, 'active'),
		lt(booking.startTime, endTime),
		gt(booking.endTime, startTime)
	];
	if (excludeBookingId !== undefined) {
		conditions.push(ne(booking.id, excludeBookingId));
	}
	const rows = await db
		.select({ id: booking.id })
		.from(booking)
		.where(and(...conditions))
		.all();
	return rows.length > 0;
}

/**
 * Get a booking by ID with flat information
 */
export async function getBookingById(id: number): Promise<BookingWithFlat | null> {
	const result = await db
		.select(bookingWithFlatColumns)
		.from(booking)
		.innerJoin(flat, eq(booking.flatNumber, flat.number))
		.where(eq(booking.id, id))
		.get();

	return result ?? null;
}

/**
 * Create a new booking after checking for conflicts
 */
export async function createBooking(
	input: CreateBookingInput
): Promise<{ success: true; booking: BookingWithFlat } | { success: false; error: string; status: number }> {
	const now = new Date().toISOString();
	if (input.startTime < now) {
		return { success: false, error: 'Impossible de créer une réservation dans le passé', status: 400 };
	}

	// Verify spot exists
	const spotExists = await db.select().from(spot).where(eq(spot.number, input.spotNumber)).get();
	if (!spotExists) {
		return { success: false, error: 'Place de parking introuvable', status: 404 };
	}

	// Midnight-frontier fold: an end at 00:00 closes the previous day, so it is
	// stored folded (`…T24:00:00`) before validation, conflicts and persistence.
	const startTime = input.startTime;
	const endTime = foldMidnightEnd(input.startTime, input.endTime);

	const timesError = validateBookingTimes(startTime, endTime);
	if (timesError) return timesError;

	const conflict = await hasConflict(input.spotNumber, startTime, endTime);
	if (conflict) {
		return { success: false, error: 'Ce créneau est déjà réservé', status: 409 };
	}

	const result = await db
		.insert(booking)
		.values({
			spotNumber: input.spotNumber,
			flatNumber: input.flatNumber,
			startTime,
			endTime,
			note: input.note ?? null
		})
		.returning()
		.get();

	const bookingWithFlat = await getBookingById(result.id);
	if (!bookingWithFlat) {
		return { success: false, error: 'Impossible de récupérer la réservation', status: 500 };
	}

	return { success: true, booking: bookingWithFlat };
}

/**
 * Get bookings in a date range (for timeline/calendar)
 */
export async function getBookingsInRange(from: string, to: string, spotNumber?: string): Promise<BookingWithFlat[]> {
	// Expand bare date strings to full datetime boundaries so that
	// lexicographic comparison against stored ISO datetimes is correct.
	const rangeStart = from.includes('T') ? from : dayBounds(from).start;
	const rangeEnd = to.includes('T') ? to : dayBounds(to).end;

	const conditions = [eq(booking.status, 'active'), lt(booking.startTime, rangeEnd), gt(booking.endTime, rangeStart)];

	if (spotNumber) {
		conditions.push(eq(booking.spotNumber, spotNumber));
	}

	return await db
		.select(bookingWithFlatColumns)
		.from(booking)
		.innerJoin(flat, eq(booking.flatNumber, flat.number))
		.where(and(...conditions))
		.all();
}

/**
 * Get bookings for a specific flat — inclusive of cancelled rows, which the
 * owner's list displays (Annulée pill + toggle). Use getBookingsInRange
 * for bookability (active only).
 */
export async function getBookingsByFlat(flatNumber: string): Promise<BookingWithFlat[]> {
	return await db
		.select(bookingWithFlatColumns)
		.from(booking)
		.innerJoin(flat, eq(booking.flatNumber, flat.number))
		.where(eq(booking.flatNumber, flatNumber))
		.all();
}

/**
 * Get all bookings across flats (admin views) — inclusive of cancelled rows,
 * which the admin list displays. Use getBookingsInRange for bookability
 * (active only).
 */
export async function getAllBookings(): Promise<BookingWithFlat[]> {
	return await db
		.select(bookingWithFlatColumns)
		.from(booking)
		.innerJoin(flat, eq(booking.flatNumber, flat.number))
		.all();
}

/**
 * Cancel a booking (only by owner or admin)
 */
export async function cancelBooking(
	bookingId: number,
	flatNumber: string,
	isAdmin: boolean
): Promise<{ success: true } | { success: false; error: string; status: number }> {
	const existing = await db.select().from(booking).where(eq(booking.id, bookingId)).get();

	if (!existing) {
		return { success: false, error: 'Réservation introuvable', status: 404 };
	}

	// Cannot cancel a booking that has already ended
	const now = new Date().toISOString();
	if (existing.endTime < now) {
		return { success: false, error: "Impossible d'annuler une réservation passée", status: 400 };
	}

	if (existing.flatNumber !== flatNumber && !isAdmin) {
		return { success: false, error: "Vous n'êtes pas autorisé à annuler cette réservation", status: 403 };
	}

	if (existing.status === 'cancelled') {
		return { success: false, error: 'Cette réservation est déjà annulée', status: 409 };
	}

	await db.update(booking).set({ status: 'cancelled' }).where(eq(booking.id, bookingId));
	return { success: true };
}

/**
 * Update a booking's time range and/or spot (only by owner or admin).
 * A spot move targets a shared spot; same-spot is a no-op for that dimension.
 */
export async function updateBooking(
	bookingId: number,
	flatNumber: string,
	updates: { startTime?: string; endTime?: string; note?: string | null; spotNumber?: string },
	isAdmin: boolean
): Promise<{ success: true; booking: BookingWithFlat } | { success: false; error: string; status: number }> {
	const existing = await db.select().from(booking).where(eq(booking.id, bookingId)).get();

	if (!existing) {
		return { success: false, error: 'Réservation introuvable', status: 404 };
	}

	if (existing.flatNumber !== flatNumber && !isAdmin) {
		return { success: false, error: "Vous n'êtes pas autorisé à modifier cette réservation", status: 403 };
	}

	const now = new Date().toISOString();

	// Cannot modify a booking that has already ended
	if (existing.endTime < now) {
		return { success: false, error: 'Impossible de modifier une réservation passée', status: 400 };
	}

	// Cancelled bookings are void — edit them never, rebook instead
	if (existing.status === 'cancelled') {
		return { success: false, error: 'Impossible de modifier une réservation annulée', status: 400 };
	}

	const moveTimes = updates.startTime !== undefined || updates.endTime !== undefined;
	const moveSpot = updates.spotNumber !== undefined && updates.spotNumber !== existing.spotNumber;
	const editNote = updates.note !== undefined;
	if (!moveTimes && !moveSpot && !editNote) {
		return { success: false, error: 'Aucune modification fournie', status: 400 };
	}

	// Spot moves land on shared spots only (same rule as booking creation's
	// bookable pool) — verified before times so a bad target fails fast.
	let targetSpot = existing.spotNumber;
	if (moveSpot) {
		const target = await db.select().from(spot).where(eq(spot.number, updates.spotNumber!)).get();
		if (!target) {
			return { success: false, error: 'Place de parking introuvable', status: 404 };
		}
		if (target.status !== 'shared') {
			return { success: false, error: "Cette place n'est pas réservable", status: 400 };
		}
		targetSpot = target.number;
	}

	const nextStart = updates.startTime ?? existing.startTime;
	// Midnight-frontier fold, same as createBooking: an end at 00:00 closes the
	// previous day and is stored folded (`…T24:00:00`).
	const nextEnd = foldMidnightEnd(nextStart, updates.endTime ?? existing.endTime);

	// Cannot move a booking to start in the past (times and/or spot — an
	// ongoing booking is immovable in every dimension, consistent with re-timing).
	// Spot-only moves reuse the stored times, so only time moves must supply both.
	if (moveTimes || moveSpot) {
		if (moveTimes && (!updates.startTime || !updates.endTime)) {
			return { success: false, error: 'Heures de début et de fin requises', status: 400 };
		}
		if (nextStart < now) {
			return { success: false, error: 'Impossible de placer une réservation dans le passé', status: 400 };
		}

		const timesError = validateBookingTimes(nextStart, nextEnd);
		if (timesError) return timesError;

		const conflict = await hasConflict(targetSpot, nextStart, nextEnd, bookingId);
		if (conflict) {
			return { success: false, error: 'Ce créneau est déjà réservé', status: 409 };
		}
	}

	await db
		.update(booking)
		.set({
			...(moveTimes ? { startTime: nextStart, endTime: nextEnd } : {}),
			...(moveSpot ? { spotNumber: targetSpot } : {}),
			...(editNote ? { note: updates.note?.trim() || null } : {})
		})
		.where(eq(booking.id, bookingId));

	const updated = await getBookingById(bookingId);
	if (!updated) {
		return { success: false, error: 'Impossible de récupérer la réservation', status: 500 };
	}

	return { success: true, booking: updated };
}
