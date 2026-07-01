import { redirect } from '@sveltejs/kit';
import { endOfMonth, format, getDaysInMonth, startOfMonth } from 'date-fns';
import { eq } from 'drizzle-orm';
import { MS_PER_HOUR } from '$lib/constants';
import { db } from '$lib/server/db';
import { booking, flat, spot } from '$lib/server/db/schema';
import { DAY_END, DAY_START } from '$lib/types';
import type { PageServerLoad } from './$types';

function computeHours(bookings: { startTime: string; endTime: string }[]): number {
	return bookings.reduce((sum, b) => {
		const ms = new Date(b.endTime).getTime() - new Date(b.startTime).getTime();
		return sum + ms / MS_PER_HOUR;
	}, 0);
}

function computeRanking(
	bookings: { flatNumber: string; flatDisplayName: string | null; startTime: string; endTime: string }[]
): { flatNumber: string; displayName: string | null; hours: number }[] {
	const grouped = new Map<string, { displayName: string | null; hours: number }>();

	for (const b of bookings) {
		const existing = grouped.get(b.flatNumber);
		const hours = (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / MS_PER_HOUR;
		if (existing) {
			existing.hours += hours;
		} else {
			grouped.set(b.flatNumber, { displayName: b.flatDisplayName, hours });
		}
	}

	return Array.from(grouped.entries())
		.map(([flatNumber, { displayName, hours }]) => ({ flatNumber, displayName, hours: Math.round(hours * 10) / 10 }))
		.filter((e) => e.hours > 0)
		.sort((a, b) => b.hours - a.hours);
}

export const load: PageServerLoad = async ({ locals }) => {
	const sessionFlat = locals.flat;
	if (!sessionFlat) throw redirect(302, '/login');

	// --- Personal stats ---
	const userBookings = await db
		.select({ startTime: booking.startTime, endTime: booking.endTime })
		.from(booking)
		.where(eq(booking.flatNumber, sessionFlat.number))
		.all();

	const now = new Date().toISOString();
	const upcomingBookings = userBookings.filter((b) => b.endTime > now);
	const totalHours = Math.round(computeHours(userBookings) * 10) / 10;

	const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd'T'HH:mm:ss");
	const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd'T'HH:mm:ss");
	const userMonthBookings = userBookings.filter((b) => b.startTime >= monthStart && b.startTime <= monthEnd);
	const monthHours = Math.round(computeHours(userMonthBookings) * 10) / 10;

	// --- Building stats ---
	const allBookingsWithFlat = await db
		.select({
			flatNumber: booking.flatNumber,
			flatDisplayName: flat.displayName,
			startTime: booking.startTime,
			endTime: booking.endTime
		})
		.from(booking)
		.innerJoin(flat, eq(booking.flatNumber, flat.number))
		.all();

	const thisMonthBookings = allBookingsWithFlat.filter((b) => b.startTime >= monthStart && b.startTime <= monthEnd);

	// Spot utilization
	const spots = await db.select().from(spot).all();
	const daysInMonth = getDaysInMonth(new Date());
	const availableHoursPerDay = DAY_END - DAY_START;
	const totalAvailable = daysInMonth * availableHoursPerDay * spots.length;
	const totalBookedThisMonth = computeHours(thisMonthBookings);
	const utilization = totalAvailable > 0 ? Math.round((totalBookedThisMonth / totalAvailable) * 100) : 0;

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
