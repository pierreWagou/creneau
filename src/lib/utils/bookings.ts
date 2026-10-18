import { differenceInCalendarDays, isToday, isTomorrow, parseISO } from 'date-fns';
import { MS_PER_HOUR } from '$lib/constants';
import { DAY_END, DAY_START } from '$lib/types';
import { bookingLiveness } from './time';

interface DatedBooking {
	startTime: string;
	endTime: string;
}

interface BookingLivenessSplit<T> {
	/** Started and not ended, ascending (always predates `upcoming` chronologically) */
	ongoing: T[];
	/** Starts in the future, ascending */
	upcoming: T[];
	/** Ended, descending */
	past: T[];
}

const byStartAsc = (a: DatedBooking, b: DatedBooking) => a.startTime.localeCompare(b.startTime);
const byStartDesc = (a: DatedBooking, b: DatedBooking) => b.startTime.localeCompare(a.startTime);

/**
 * Split bookings into ongoing/upcoming/past slices with stable orders.
 * Shared by Mes réservations and the admin reservations tab — one definition
 * instead of triplicated isPast/sort derivations.
 */
export function splitBookingsByLiveness<T extends DatedBooking>(bookings: T[]): BookingLivenessSplit<T> {
	const ongoing: T[] = [];
	const upcoming: T[] = [];
	const past: T[] = [];

	for (const booking of bookings) {
		const liveness = bookingLiveness(booking.startTime, booking.endTime);
		if (liveness === 'past') past.push(booking);
		else if (liveness === 'ongoing') ongoing.push(booking);
		else upcoming.push(booking);
	}

	ongoing.sort(byStartAsc);
	upcoming.sort(byStartAsc);
	past.sort(byStartDesc);
	return { ongoing, upcoming, past };
}

/**
 * Hours between two ISO datetimes (fractional). Single home for duration
 * math — stats, ranking, and utilization all divide by the same hour.
 */
export function bookingHours(startTime: string, endTime: string): number {
	return (new Date(endTime).getTime() - new Date(startTime).getTime()) / MS_PER_HOUR;
}

/**
 * Find a booking by id in an already-loaded list (drawer/deep-link
 * resolution on the three pages that hold bookings client-side).
 */
export function findBookingById<T extends { id: number }>(bookings: T[], id: number | null | undefined): T | undefined {
	if (id == null) return undefined;
	return bookings.find((b) => b.id === id);
}

/**
 * Building utilization % = booked hours ÷ bookable capacity
 * (shared spots only — assigned/unassigned aren't bookable — × full clock × days).
 * One decimal so sub-1% months render instead of collapsing to 0; 0 when
 * there is no capacity.
 */
export function computeUtilization(bookedHours: number, sharedSpotCount: number, daysInMonth: number): number {
	const totalAvailable = daysInMonth * (DAY_END - DAY_START) * sharedSpotCount;
	if (totalAvailable <= 0) return 0;
	return Math.round((bookedHours / totalAvailable) * 100 * 10) / 10;
}

interface BookingStatusPill {
	/** `Annulée` / `En cours` / `Aujourd'hui` / `Demain` / `Dans X j` / `Passée` */
	label: string;
	/** Solid treatment: cancelled red, ongoing blue, upcoming green, past solid grey */
	className: string;
}

/**
 * The one shared booking-status pill (cards + drawer): granular day label
 * with the red/green/blue/grey solid system. Cancelled short-circuits first —
 * a void booking reads Annulée whatever its dates. Day labels follow the
 * system clock (tests pin it with fake timers).
 */
export function bookingStatusPill(
	startTime: string,
	endTime: string,
	status: 'active' | 'cancelled' = 'active'
): BookingStatusPill {
	if (status === 'cancelled') return { label: 'Annulée', className: 'bg-destructive on-solid' };
	const liveness = bookingLiveness(startTime, endTime);
	if (liveness === 'past') return { label: 'Passée', className: 'bg-foreground on-solid' };
	if (liveness === 'ongoing') return { label: 'En cours', className: 'bg-primary on-solid' };
	const start = parseISO(startTime);
	const label = isToday(start)
		? "Aujourd'hui"
		: isTomorrow(start)
			? 'Demain'
			: `Dans ${differenceInCalendarDays(start, new Date())} j`;
	return { label, className: 'bg-success on-solid' };
}
