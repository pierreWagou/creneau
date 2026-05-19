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
export function getHourFromISO(iso: string): number {
	return parseInt(iso.split('T')[1]?.substring(0, 2) || '0', 10);
}

/**
 * Format a Date to YYYY-MM-DD string (timezone-safe, uses noon trick)
 */
export function formatDateISO(d: Date): string {
	return d.toISOString().split('T')[0];
}
