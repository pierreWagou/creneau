import { DAY_START, DAY_END } from '$lib/types';

export const TIME_BLOCKS = {
	morning: { start: '07:00', end: '12:00', label: 'Matin' },
	afternoon: { start: '12:00', end: '18:00', label: 'Après-midi' },
	evening: { start: '18:00', end: '22:00', label: 'Soirée' }
} as const;

export type TimeBlockKey = keyof typeof TIME_BLOCKS;

/**
 * Compute the combined time range for multiple selected blocks
 */
export function blocksToTimeRange(blocks: TimeBlockKey[]): { start: string; end: string; label: string } {
	if (blocks.length === 0) {
		const startStr = `${String(DAY_START).padStart(2, '0')}:00`;
		const endStr = `${String(DAY_END).padStart(2, '0')}:00`;
		return { start: startStr, end: endStr, label: 'Journée entière' };
	}

	// Sort blocks by their start time
	const sorted = [...blocks].sort(
		(a, b) => TIME_BLOCKS[a].start.localeCompare(TIME_BLOCKS[b].start)
	);

	const start = TIME_BLOCKS[sorted[0]].start;
	const end = TIME_BLOCKS[sorted[sorted.length - 1]].end;
	const label = sorted.map((b) => TIME_BLOCKS[b].label).join(' + ');

	return { start, end, label };
}

/**
 * Given a date string and custom start/end times (HH:MM), returns ISO datetime strings
 */
export function customToDateRange(
	startDate: string,
	startTime: string,
	endDate: string,
	endTime: string
): { start: string; end: string } {
	return {
		start: `${startDate}T${startTime}:00`,
		end: `${endDate}T${endTime}:00`
	};
}

/**
 * Check if two time ranges overlap
 */
export function rangesOverlap(
	aStart: string,
	aEnd: string,
	bStart: string,
	bEnd: string
): boolean {
	return aStart < bEnd && bStart < aEnd;
}
