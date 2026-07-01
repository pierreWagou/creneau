import { and, eq, gt, lt, ne } from 'drizzle-orm';
import { MAX_BOOKING_HOURS, MS_PER_HOUR } from '$lib/constants';
import type { BookingWithFlat } from '$lib/types';
import { DAY_END, DAY_START } from '$lib/types';
import { getHourFromISO, padH } from '$lib/utils/time';
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
function validateBookingTimes(
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
			error: `La durée maximale d'une réservation est de ${MAX_BOOKING_HOURS / 24} jours`,
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
async function getBookingById(id: number): Promise<BookingWithFlat | null> {
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
		return { success: false, error: 'Place introuvable', status: 400 };
	}

	const timesError = validateBookingTimes(input.startTime, input.endTime);
	if (timesError) return timesError;

	const conflict = await hasConflict(input.spotNumber, input.startTime, input.endTime);
	if (conflict) {
		return { success: false, error: 'Ce créneau est déjà réservé', status: 409 };
	}

	const result = await db
		.insert(booking)
		.values({
			spotNumber: input.spotNumber,
			flatNumber: input.flatNumber,
			startTime: input.startTime,
			endTime: input.endTime,
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
	const rangeStart = from.includes('T') ? from : `${from}T${padH(DAY_START)}:00:00`;
	const rangeEnd = to.includes('T') ? to : `${to}T${padH(DAY_END)}:00:00`;

	const conditions = [lt(booking.startTime, rangeEnd), gt(booking.endTime, rangeStart)];

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
 * Get bookings for a specific flat
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

	await db.delete(booking).where(eq(booking.id, bookingId));
	return { success: true };
}

/**
 * Update a booking's time range (only by owner)
 */
export async function updateBooking(
	bookingId: number,
	flatNumber: string,
	updates: { startTime: string; endTime: string }
): Promise<{ success: true; booking: BookingWithFlat } | { success: false; error: string; status: number }> {
	const existing = await db.select().from(booking).where(eq(booking.id, bookingId)).get();

	if (!existing) {
		return { success: false, error: 'Réservation introuvable', status: 404 };
	}

	if (existing.flatNumber !== flatNumber) {
		return { success: false, error: "Vous n'êtes pas autorisé à modifier cette réservation", status: 403 };
	}

	const now = new Date().toISOString();

	// Cannot modify a booking that has already ended
	if (existing.endTime < now) {
		return { success: false, error: 'Impossible de modifier une réservation passée', status: 400 };
	}

	// Cannot move a booking to start in the past
	if (updates.startTime < now) {
		return { success: false, error: 'Impossible de placer une réservation dans le passé', status: 400 };
	}

	const timesError = validateBookingTimes(updates.startTime, updates.endTime);
	if (timesError) return timesError;

	const conflict = await hasConflict(existing.spotNumber, updates.startTime, updates.endTime, bookingId);
	if (conflict) {
		return { success: false, error: 'Ce créneau est déjà réservé', status: 409 };
	}

	await db
		.update(booking)
		.set({ startTime: updates.startTime, endTime: updates.endTime })
		.where(eq(booking.id, bookingId));

	const updated = await getBookingById(bookingId);
	if (!updated) {
		return { success: false, error: 'Impossible de récupérer la réservation', status: 500 };
	}

	return { success: true, booking: updated };
}
