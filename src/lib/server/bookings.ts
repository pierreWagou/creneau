import { and, eq, gt, lt } from 'drizzle-orm';
import type { BookingWithFlat } from '$lib/types';
import { DAY_END, DAY_START } from '$lib/types';
import { padH } from '$lib/utils/time';
import { db } from './db';
import { booking, flat } from './db/schema';

interface CreateBookingInput {
	spotNumber: string;
	flatNumber: string;
	startTime: string;
	endTime: string;
	note?: string | null;
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
	const existingBookings = await db
		.select()
		.from(booking)
		.where(and(eq(booking.spotNumber, spotNumber), lt(booking.startTime, endTime), gt(booking.endTime, startTime)))
		.all();

	const filtered = excludeBookingId ? existingBookings.filter((b) => b.id !== excludeBookingId) : existingBookings;

	return filtered.length > 0;
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
): Promise<{ success: true; booking: BookingWithFlat } | { success: false; error: string }> {
	if (input.startTime >= input.endTime) {
		return { success: false, error: "L'heure de fin doit être après l'heure de début" };
	}

	const conflict = await hasConflict(input.spotNumber, input.startTime, input.endTime);
	if (conflict) {
		return { success: false, error: 'Ce créneau est déjà réservé' };
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
		return { success: false, error: 'Impossible de récupérer la réservation' };
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
): Promise<{ success: boolean; error?: string; status?: number }> {
	const existing = await db.select().from(booking).where(eq(booking.id, bookingId)).get();

	if (!existing) {
		return { success: false, error: 'Réservation introuvable', status: 404 };
	}

	if (existing.flatNumber !== flatNumber && !isAdmin) {
		return { success: false, error: "Vous n'êtes pas autorisé à annuler cette réservation", status: 403 };
	}

	await db.delete(booking).where(eq(booking.id, bookingId));
	return { success: true };
}
