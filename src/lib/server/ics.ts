import { dateKey } from '$lib/utils/time';

/**
 * Minimal RFC 5545 event builder for booking calendar attachments.
 *
 * Times are the app's naive local wall-clock strings (`YYYY-MM-DDTHH:MM:SS`)
 * and are emitted as *floating* local time (no `Z`, no `TZID`): correct for
 * residents in the building's zone without shipping a VTIMEZONE block.
 */

export interface CalendarEvent {
	/** Stable across updates so clients dedupe (`booking-{id}@creneau`). */
	uid: string;
	start: string;
	end: string;
	summary: string;
	description?: string;
	sequence?: number;
	method: 'PUBLISH' | 'CANCEL' | 'REQUEST';
}

/** `YYYY-MM-DDTHH:MM:SS` → `YYYYMMDDTHHMMSS` (floating local time).
 * A folded midnight end (`…T24:00:00`) rolls to next-day `T000000` — RFC 5545
 * has no hour 24, and the rolled instant is identical. */
export function toICSDate(naive: string): string {
	if (naive.endsWith('T24:00:00')) {
		const [y, m, d] = dateKey(naive).split('-').map(Number);
		const next = new Date(Date.UTC(y, m - 1, d + 1));
		const day = `${next.getUTCFullYear()}${String(next.getUTCMonth() + 1).padStart(2, '0')}${String(next.getUTCDate()).padStart(2, '0')}`;
		return `${day}T000000`;
	}
	return naive.replace(/[-:]/g, '');
}

/** RFC 5545 text escaping: backslash, semicolon, comma, newline. */
export function escapeICS(text: string): string {
	return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function buildICS(event: CalendarEvent): string {
	const stamp = new Date()
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '');
	const lines = [
		'BEGIN:VCALENDAR',
		'PRODID:-//Wagou//Creneau//FR',
		'VERSION:2.0',
		`METHOD:${event.method}`,
		'BEGIN:VEVENT',
		`UID:${event.uid}`,
		`DTSTAMP:${stamp}`,
		`DTSTART:${toICSDate(event.start)}`,
		`DTEND:${toICSDate(event.end)}`,
		`SUMMARY:${escapeICS(event.summary)}`,
		`SEQUENCE:${event.sequence ?? 0}`,
		`STATUS:${event.method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'}`
	];
	if (event.description !== undefined) {
		lines.push(`DESCRIPTION:${escapeICS(event.description)}`);
	}
	lines.push('END:VEVENT', 'END:VCALENDAR');
	return `${lines.join('\r\n')}\r\n`;
}

/** Stable UID binding a booking's lifecycle (create → moves → cancel). */
export function bookingUid(bookingId: number): string {
	return `booking-${bookingId}@creneau`;
}
