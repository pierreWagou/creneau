import { differenceInHours, format, isSameDay, isSameMonth, parseISO, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DAY_END, DAY_START, MS_PER_MINUTE } from '$lib/constants';

export const TIME_BLOCKS = {
	morning: { start: '06:00', end: '12:00', label: 'Matin' },
	afternoon: { start: '12:00', end: '18:00', label: 'Après-midi' },
	evening: { start: '18:00', end: '24:00', label: 'Soirée' }
} as const;

export type TimeBlockKey = keyof typeof TIME_BLOCKS;

/**
 * Pad an hour number to 2 digits (e.g., 7 → "07")
 */
export function padH(h: number): string {
	return String(h).padStart(2, '0');
}

/**
 * Extract hour from an ISO datetime string (e.g., "2026-05-06T14:00:00" → 14)
 */
export function getHourFromISO(iso: string, fallback = 0): number {
	return parseInt(iso.split('T')[1]?.substring(0, 2) || String(fallback), 10);
}

/**
 * Calendar-day key of an ISO datetime (`2026-10-17T14:00:00` → `2026-10-17`).
 * Single home for the date-part idiom (comparisons, grouping, display days).
 */
export function dateKey(iso: string): string {
	return iso.slice(0, 10);
}

/**
 * Midnight-frontier fold: an end at exactly 00:00:00 on a later date than the
 * start closes the previous day — it never opens an extra day.
 * `15T18:00 → 16T00:00` becomes `15T18:00 → 15T24:00` (same instant, one day
 * counted). Pure string op; calendar-day math in UTC so DST Sundays can't
 * shift the folded date.
 */
export function foldMidnightEnd(startTime: string, endTime: string): string {
	const endDate = dateKey(endTime);
	if (!endTime.endsWith('T00:00:00') || endDate <= dateKey(startTime)) return endTime;
	const [y, m, d] = endDate.split('-').map(Number);
	const prev = new Date(Date.UTC(y, m - 1, d - 1));
	return `${prev.getUTCFullYear()}-${padH(prev.getUTCMonth() + 1)}-${padH(prev.getUTCDate())}T24:00:00`;
}

/** True when an end time uses the folded midnight form (`…T24:00:00`). */
export function isMidnightEnd(iso: string): boolean {
	return iso.endsWith('T24:00:00');
}

/**
 * Format a Date to YYYY-MM-DD string (timezone-safe — normalizes to noon UTC to avoid date shift)
 */
export function formatDateISO(d: Date): string {
	const noon = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
	return isoDateKey(noon);
}

/**
 * Calendar-day key of a Date (UTC day-walk companion of `dateKey` for strings).
 */
export function isoDateKey(d: Date): string {
	return d.toISOString().split('T')[0];
}

/**
 * Time part of an ISO datetime (`2026-10-17T14:00:00` → `14:00:00`).
 */
export function timeKey(iso: string): string {
	return iso.split('T')[1];
}

/**
 * Bookable bounds of a calendar day (`2026-10-17` → `17T00:00:00…17T24:00:00`).
 * Single home for the day-boundary idiom (timeline building, day filtering,
 * booking-range expansion) — plain string ops, no Date, no DST hazard.
 */
export function dayBounds(dateStr: string): { start: string; end: string } {
	return { start: `${dateStr}T${padH(DAY_START)}:00:00`, end: `${dateStr}T${padH(DAY_END)}:00:00` };
}

/**
 * Noon-anchored Date for day iteration (`2026-10-17` → local-noon Date).
 * Midday is immune to DST transitions — midnight iteration skips or
 * duplicates days on the March/October Sundays.
 */
export function noonDate(dateStr: string): Date {
	return new Date(`${dateStr}T12:00:00`);
}

/**
 * Local ISO datetime of a Date (`2026-10-17T14:05:00`) — for drag/resize
 * payloads where the calendar hands back Date objects.
 */
export function toISOLocal(d: Date): string {
	return `${formatDateISO(d)}T${padH(d.getHours())}:${padH(d.getMinutes())}:00`;
}

/**
 * Format a duration between two ISO datetime strings (e.g., "3h", "2 jours")
 */
export function formatDuration(start: string, end: string): string {
	const hours = differenceInHours(parseISO(end), parseISO(start));
	if (hours < 24) return `${hours}h`;
	const days = Math.ceil(hours / 24);
	return `${days} jour${days > 1 ? 's' : ''}`;
}

type BookingLiveness = 'ongoing' | 'upcoming' | 'past';

export function bookingLiveness(startTime: string, endTime: string): BookingLiveness {
	const now = new Date();
	if (parseISO(endTime) <= now) return 'past';
	if (parseISO(startTime) <= now) return 'ongoing';
	return 'upcoming';
}

/** Duration phrase (`25min`, `3h12`, `2j`) — shared core of countdownLabel + expiry-chip. */
export function formatCountdownDuration(diffMs: number): string {
	const mins = Math.max(0, Math.round(diffMs / MS_PER_MINUTE));
	if (mins < 60) return `${mins}min`;
	const hours = Math.floor(mins / 60);
	if (hours < 48) return `${hours}h${padH(mins % 60)}`;
	return `${Math.floor(hours / 24)}j`;
}

/** "Commence dans 3h12" / "Se termine dans 25min" countdown (null when past). */
export function countdownLabel(startTime: string, endTime: string): string | null {
	const now = Date.now();
	const start = parseISO(startTime).getTime();
	const end = parseISO(endTime).getTime();
	if (end <= now) return null;
	const upcoming = start > now;
	const prefix = upcoming ? 'Commence dans ' : 'Se termine dans ';
	return `${prefix}${formatCountdownDuration((upcoming ? start : end) - now)}`;
}

/** 'sam. 5 mai' — bare YYYY-MM-DD with the noon trick (timezone-safe day iteration). */
export function formatDateFr(dateStr: string): string {
	return new Date(`${dateStr}T12:00:00`).toLocaleDateString('fr-FR', {
		weekday: 'short',
		day: 'numeric',
		month: 'long'
	});
}

/** '05/10/2026 • 14:00' — full date plus hours. */
export function formatDateTimeFr(iso: string): string {
	const d = new Date(iso);
	return `${d.toLocaleDateString('fr-FR')} • ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

/** '5 oct., 14:00' — compact slot label for mails and tooltips. */
export function formatCompactDateTimeFr(iso: string): string {
	return new Date(iso).toLocaleString('fr-FR', {
		day: 'numeric',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit'
	});
}

/**
 * Booking END label: a folded midnight end (`…T24:00:00`) reads as same-day
 * 24:00 — it never names the next day. Anything else renders exactly like the
 * standard formatters (compact: mails; long: drawer timeline).
 */
export function formatBookingEndFr(iso: string, style: 'compact' | 'long' = 'compact'): string {
	if (isMidnightEnd(iso)) {
		const day =
			style === 'long'
				? format(parseISO(dateKey(iso)), 'EEEE d MMMM', { locale: fr })
				: new Date(`${dateKey(iso)}T12:00:00`).toLocaleString('fr-FR', {
						day: 'numeric',
						month: 'short'
					});
		return `${day}, ${style === 'long' ? '24h00' : '24:00'}`;
	}
	return style === 'long'
		? format(parseISO(iso), "EEEE d MMMM, HH'h'mm", { locale: fr })
		: formatCompactDateTimeFr(iso);
}

/**
 * Compact date-only range title for booking tickets (`lun. 5 mai`,
 * `5 → 7 mai`, `30 avr. → 2 mai`; hours stay drawer-only). Fold-aware: a
 * midnight end — folded (`…T24:00:00`) or plain (`…T00:00:00`) — closes the
 * prior day and never opens an extra one, so it always displays on the
 * prior day. Display days are noon-anchored (DST-immune; only day/month
 * names render).
 */
export function formatBookingRangeFr(startISO: string, endISO: string): string {
	const start = parseISO(startISO);
	const endDay = isMidnightEnd(endISO)
		? parseISO(`${dateKey(endISO)}T12:00:00`)
		: endISO.slice(11, 16) === '00:00'
			? subDays(parseISO(`${dateKey(endISO)}T12:00:00`), 1)
			: parseISO(endISO);
	if (isSameDay(start, endDay)) return format(start, 'EEE d MMM', { locale: fr });
	if (isSameMonth(start, endDay))
		return `${format(start, 'd', { locale: fr })} → ${format(endDay, 'd MMM', { locale: fr })}`;
	return `${format(start, 'd MMM', { locale: fr })} → ${format(endDay, 'd MMM', { locale: fr })}`;
}

/** '12 oct. 2026' — compact box label for the booking date picker. */
export function formatDateShortFr(dateStr: string): string {
	return new Date(`${dateStr}T12:00:00`).toLocaleDateString('fr-FR', {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});
}

const FR_MONTHS: Record<string, number> = {
	janvier: 1,
	janv: 1,
	fevrier: 2,
	fev: 2,
	mars: 3,
	mar: 3,
	avril: 4,
	avr: 4,
	mai: 5,
	juin: 6,
	jun: 6,
	juillet: 7,
	juil: 7,
	aout: 8,
	aou: 8,
	septembre: 9,
	sept: 9,
	sep: 9,
	octobre: 10,
	oct: 10,
	novembre: 11,
	nov: 11,
	decembre: 12,
	dec: 12
};

function stripAccents(s: string): string {
	return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Parse a French date input into YYYY-MM-DD, or null when invalid.
 * Accepts `JJ/MM/AAAA` (`/`, `-`, `.` separators) and `JJ mois AAAA`
 * (full/short month names, case- and accent-insensitive). Pure — no
 * today-clamping, so callers own past-date policy.
 */
export function parseFrDateInput(raw: string): string | null {
	const text = raw.trim();
	if (!text) return null;

	let day: number | undefined;
	let month: number | undefined;
	let year: number | undefined;

	const numeric = text.match(/^(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{4})$/);
	if (numeric) {
		day = Number(numeric[1]);
		month = Number(numeric[2]);
		year = Number(numeric[3]);
	} else {
		const named = stripAccents(text.toLowerCase()).match(/^(\d{1,2})(?:er)?\s+([a-z.]+)\s+(\d{4})$/);
		if (!named) return null;
		const mapped = FR_MONTHS[named[2].replace(/\.+$/, '')];
		if (!mapped) return null;
		day = Number(named[1]);
		month = mapped;
		year = Number(named[3]);
	}

	if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1000 || year > 9999) return null;
	const check = new Date(year, month - 1, day);
	if (check.getFullYear() !== year || check.getMonth() !== month - 1 || check.getDate() !== day) {
		return null;
	}
	return `${year}-${padH(month)}-${padH(day)}`;
}
