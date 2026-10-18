import { redirect } from '@sveltejs/kit';
import { endOfMonth, format, getDaysInMonth, startOfMonth } from 'date-fns';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { booking, flat, spot } from '$lib/server/db/schema';
import { bookingHours, computeUtilization } from '$lib/utils/bookings';
import type { PageServerLoad } from './$types';

function roundToTenth(n: number): number {
	return Math.round(n * 10) / 10;
}

function computeHours(bookings: { startTime: string; endTime: string }[]): number {
	return bookings.reduce((sum, b) => sum + bookingHours(b.startTime, b.endTime), 0);
}

function computeRanking(
	bookings: { flatNumber: string; flatDisplayName: string | null; startTime: string; endTime: string }[]
): { flatNumber: string; displayName: string | null; hours: number }[] {
	const grouped = new Map<string, { displayName: string | null; hours: number }>();

	for (const b of bookings) {
		const existing = grouped.get(b.flatNumber);
		const hours = bookingHours(b.startTime, b.endTime);
		if (existing) {
			existing.hours += hours;
		} else {
			grouped.set(b.flatNumber, { displayName: b.flatDisplayName, hours });
		}
	}

	return Array.from(grouped.entries())
		.map(([flatNumber, { displayName, hours }]) => ({ flatNumber, displayName, hours: roundToTenth(hours) }))
		.filter((e) => e.hours > 0)
		.sort((a, b) => b.hours - a.hours);
}

export const load: PageServerLoad = async ({ locals }) => {
	const sessionFlat = locals.flat;
	if (!sessionFlat) throw redirect(302, '/login');

	// --- Personal stats (cancelled bookings freed their slot — excluded) ---
	const userBookings = await db
		.select({ startTime: booking.startTime, endTime: booking.endTime })
		.from(booking)
		.where(and(eq(booking.flatNumber, sessionFlat.number), eq(booking.status, 'active')))
		.all();

	const now = new Date().toISOString();
	const upcomingBookings = userBookings.filter((b) => b.endTime > now);
	const totalHours = roundToTenth(computeHours(userBookings));

	const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd'T'HH:mm:ss");
	const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd'T'HH:mm:ss");
	const userMonthBookings = userBookings.filter((b) => b.startTime >= monthStart && b.startTime <= monthEnd);
	const monthHours = roundToTenth(computeHours(userMonthBookings));

	// --- Building stats (cancelled excluded, same rule) ---
	const allBookingsWithFlat = await db
		.select({
			flatNumber: booking.flatNumber,
			flatDisplayName: flat.displayName,
			startTime: booking.startTime,
			endTime: booking.endTime
		})
		.from(booking)
		.innerJoin(flat, eq(booking.flatNumber, flat.number))
		.where(eq(booking.status, 'active'))
		.all();

	const thisMonthBookings = allBookingsWithFlat.filter((b) => b.startTime >= monthStart && b.startTime <= monthEnd);

	// Spot utilization over bookable capacity: only shared spots can be
	// booked, so assigned/unassigned ones are not capacity. One decimal so
	// sub-1% months render instead of collapsing to 0.
	const spots = await db.select().from(spot).all();
	const sharedSpots = spots.filter((s) => s.status === 'shared');
	const daysInMonth = getDaysInMonth(new Date());
	const totalBookedThisMonth = computeHours(thisMonthBookings);
	const utilization = computeUtilization(totalBookedThisMonth, sharedSpots.length, daysInMonth);

	return {
		personal: {
			totalHours,
			monthHours,
			upcomingBookings: upcomingBookings.length,
			totalBookings: userBookings.length
		},
		building: {
			utilization,
			ranking: {
				allTime: computeRanking(allBookingsWithFlat),
				thisMonth: computeRanking(thisMonthBookings)
			}
		}
	};
};
