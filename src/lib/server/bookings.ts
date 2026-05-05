import { db } from './db';
import { booking, flat } from './db/schema';
import { eq, and, lt, gt } from 'drizzle-orm';
import type { BookingWithFlat } from '$lib/types';

export interface CreateBookingInput {
	slotId: number;
	flatId: number;
	startTime: string;
	endTime: string;
	label?: string | null;
	note?: string | null;
}

/**
 * Check if a booking conflicts with existing bookings on the same slot
 */
export async function hasConflict(slotId: number, startTime: string, endTime: string, excludeBookingId?: number): Promise<boolean> {
	// Get all bookings for this slot that might overlap
	const existingBookings = await db
		.select()
		.from(booking)
		.where(
			and(
				eq(booking.slotId, slotId),
				// Potential overlap: existing.start < new.end AND existing.end > new.start
				lt(booking.startTime, endTime),
				gt(booking.endTime, startTime)
			)
		)
		.all();

	// If we're editing a booking, exclude it from conflict check
	const filtered = excludeBookingId
		? existingBookings.filter((b) => b.id !== excludeBookingId)
		: existingBookings;

	return filtered.length > 0;
}

/**
 * Create a new booking after checking for conflicts
 */
export async function createBooking(input: CreateBookingInput): Promise<{ success: true; booking: BookingWithFlat } | { success: false; error: string }> {
	// Validate time range
	if (input.startTime >= input.endTime) {
		return { success: false, error: "L'heure de fin doit être après l'heure de début" };
	}

	// Check for simple overlap conflicts
	const conflict = await hasConflict(input.slotId, input.startTime, input.endTime);
	if (conflict) {
		return { success: false, error: 'Ce créneau est déjà réservé' };
	}

	// Insert booking
	const result = await db
		.insert(booking)
		.values({
			slotId: input.slotId,
			flatId: input.flatId,
			startTime: input.startTime,
			endTime: input.endTime,
			label: input.label ?? null,
			note: input.note ?? null
		})
		.returning()
		.get();

	// Fetch with flat info
	const bookingWithFlat = await getBookingById(result.id);
	if (!bookingWithFlat) {
		return { success: false, error: 'Impossible de récupérer la réservation' };
	}

	return { success: true, booking: bookingWithFlat };
}

/**
 * Get a booking by ID with flat information
 */
export async function getBookingById(id: number): Promise<BookingWithFlat | null> {
	const result = await db
		.select({
			id: booking.id,
			slotId: booking.slotId,
			flatId: booking.flatId,
			startTime: booking.startTime,
			endTime: booking.endTime,
			label: booking.label,
			note: booking.note,
			createdAt: booking.createdAt,
			flatNumber: flat.number,
			flatDisplayName: flat.displayName
		})
		.from(booking)
		.innerJoin(flat, eq(booking.flatId, flat.id))
		.where(eq(booking.id, id))
		.get();

	return result ?? null;
}

/**
 * Get bookings in a date range (for calendar display)
 */
export async function getBookingsInRange(from: string, to: string, slotId?: number): Promise<BookingWithFlat[]> {
	const conditions = [
		lt(booking.startTime, to),
		gt(booking.endTime, from)
	];

	if (slotId) {
		conditions.push(eq(booking.slotId, slotId));
	}

	return await db
		.select({
			id: booking.id,
			slotId: booking.slotId,
			flatId: booking.flatId,
			startTime: booking.startTime,
			endTime: booking.endTime,
			label: booking.label,
			note: booking.note,
			createdAt: booking.createdAt,
			flatNumber: flat.number,
			flatDisplayName: flat.displayName
		})
		.from(booking)
		.innerJoin(flat, eq(booking.flatId, flat.id))
		.where(and(...conditions))
		.all();
}

/**
 * Get bookings for a specific flat
 */
export async function getBookingsByFlat(flatId: number): Promise<BookingWithFlat[]> {
	return await db
		.select({
			id: booking.id,
			slotId: booking.slotId,
			flatId: booking.flatId,
			startTime: booking.startTime,
			endTime: booking.endTime,
			label: booking.label,
			note: booking.note,
			createdAt: booking.createdAt,
			flatNumber: flat.number,
			flatDisplayName: flat.displayName
		})
		.from(booking)
		.innerJoin(flat, eq(booking.flatId, flat.id))
		.where(eq(booking.flatId, flatId))
		.all();
}

/**
 * Cancel a booking (only by owner or admin)
 */
export async function cancelBooking(bookingId: number, flatId: number, isAdmin: boolean): Promise<{ success: boolean; error?: string }> {
	const existing = await db.select().from(booking).where(eq(booking.id, bookingId)).get();

	if (!existing) {
		return { success: false, error: 'Réservation introuvable' };
	}

	if (existing.flatId !== flatId && !isAdmin) {
		return { success: false, error: "Vous n'êtes pas autorisé à annuler cette réservation" };
	}

	await db.delete(booking).where(eq(booking.id, bookingId));
	return { success: true };
}
