import { redirect } from '@sveltejs/kit';
import { endOfMonth, startOfMonth } from 'date-fns';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { booking, flat } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

function computeHours(bookings: { startTime: string; endTime: string }[]): number {
	return bookings.reduce((sum, b) => {
		const ms = new Date(b.endTime).getTime() - new Date(b.startTime).getTime();
		return sum + ms / (1000 * 60 * 60);
	}, 0);
}

function computeRanking(
	bookings: { flatNumber: string; flatDisplayName: string | null; startTime: string; endTime: string }[]
): { flatNumber: string; displayName: string | null; hours: number }[] {
	const grouped = new Map<string, { displayName: string | null; hours: number }>();

	for (const b of bookings) {
		const existing = grouped.get(b.flatNumber);
		const hours = (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / (1000 * 60 * 60);
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
	if (!locals.flat) {
		throw redirect(302, '/login');
	}
	const sessionFlat = locals.flat;

	// Fetch full flat info
	const flatInfo = await db.select().from(flat).where(eq(flat.number, sessionFlat.number)).get();

	if (!flatInfo) {
		throw redirect(302, '/login');
	}

	// Fetch all user bookings
	const userBookings = await db
		.select({ startTime: booking.startTime, endTime: booking.endTime })
		.from(booking)
		.where(eq(booking.flatNumber, sessionFlat.number))
		.all();

	// Count upcoming bookings (endTime > now)
	const now = new Date().toISOString();
	const upcomingBookings = userBookings.filter((b) => b.endTime > now);

	// Compute hours
	const totalHours = Math.round(computeHours(userBookings) * 10) / 10;

	// Hours this month
	const monthStart = startOfMonth(new Date()).toISOString().split('.')[0];
	const monthEnd = endOfMonth(new Date()).toISOString().split('.')[0];
	const monthBookings = userBookings.filter((b) => b.startTime >= monthStart && b.startTime <= monthEnd);
	const monthHours = Math.round(computeHours(monthBookings) * 10) / 10;

	// Admin: compute ranking
	let ranking: { allTime: ReturnType<typeof computeRanking>; thisMonth: ReturnType<typeof computeRanking> } | null =
		null;

	if (sessionFlat.isAdmin) {
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

		ranking = {
			allTime: computeRanking(allBookingsWithFlat),
			thisMonth: computeRanking(thisMonthBookings)
		};
	}

	return {
		flat: {
			number: flatInfo.number,
			displayName: flatInfo.displayName,
			isAdmin: flatInfo.isAdmin,
			activatedAt: flatInfo.activatedAt
		},
		stats: {
			totalBookings: userBookings.length,
			upcomingBookings: upcomingBookings.length,
			totalHours,
			monthHours
		},
		ranking
	};
};
