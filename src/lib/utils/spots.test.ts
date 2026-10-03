import { describe, expect, it } from 'vitest';
import { describeSharedPoolConflicts, describeSpotConflicts, findSpotConflicts } from './spots';

const spots = [
	{ number: '01', flatNumber: 'A01' },
	{ number: '02', flatNumber: 'A01' },
	{ number: '03', flatNumber: 'A02' },
	{ number: '04', flatNumber: null }
];

const directory = [
	{ number: '01', flatNumber: 'A01', status: 'assigned' as const },
	{ number: '04', flatNumber: null, status: 'shared' as const },
	{ number: '05', flatNumber: null, status: 'unassigned' as const },
	{ number: '06', flatNumber: null, status: 'shared' as const }
];

describe('describeSpotConflicts', () => {
	it('movable conflict keeps remaining count', () => {
		expect(describeSpotConflicts([{ spotNumber: '01', currentFlat: 'A01' }], spots)).toEqual([
			{ spotNumber: '01', currentFlat: 'A01', remainingForCurrent: 1, blocked: false }
		]);
	});

	it('single-spot holder is blocked', () => {
		expect(describeSpotConflicts([{ spotNumber: '03', currentFlat: 'A02' }], spots)).toEqual([
			{ spotNumber: '03', currentFlat: 'A02', remainingForCurrent: 0, blocked: true }
		]);
	});

	it('handles mixed batches independently', () => {
		const out = describeSpotConflicts(
			[
				{ spotNumber: '01', currentFlat: 'A01' },
				{ spotNumber: '03', currentFlat: 'A02' }
			],
			spots
		);
		expect(out.map((c) => c.blocked)).toEqual([false, true]);
	});

	it('unknown holder counts as blocked (0 held)', () => {
		expect(describeSpotConflicts([{ spotNumber: '04', currentFlat: 'ZZ' }], spots)).toEqual([
			{ spotNumber: '04', currentFlat: 'ZZ', remainingForCurrent: 0, blocked: true }
		]);
	});

	it('empty conflicts stay empty', () => {
		expect(describeSpotConflicts([], spots)).toEqual([]);
	});
});

describe('findSpotConflicts', () => {
	it('flags spots bound to another flat', () => {
		expect(findSpotConflicts(['01'], spots)).toEqual([{ spotNumber: '01', currentFlat: 'A01' }]);
	});

	it('ignores shared (unbound) and unknown spots', () => {
		expect(findSpotConflicts(['04', '99'], spots)).toEqual([]);
	});

	it('excludes the given flat’s own spots', () => {
		expect(findSpotConflicts(['01', '03'], spots, 'A01')).toEqual([{ spotNumber: '03', currentFlat: 'A02' }]);
	});

	it('empty input stays empty', () => {
		expect(findSpotConflicts([], spots)).toEqual([]);
	});
});

describe('describeSharedPoolConflicts', () => {
	it('flags selected shared-pool spots', () => {
		expect(describeSharedPoolConflicts(['04', '06'], directory)).toEqual([
			{ spotNumber: '04', currentFlat: '', remainingForCurrent: 0, blocked: false, kind: 'shared-pool' },
			{ spotNumber: '06', currentFlat: '', remainingForCurrent: 0, blocked: false, kind: 'shared-pool' }
		]);
	});

	it('ignores assigned, unassigned and unknown spots', () => {
		expect(describeSharedPoolConflicts(['01', '05', '99'], directory)).toEqual([]);
	});

	it('empty input stays empty', () => {
		expect(describeSharedPoolConflicts([], directory)).toEqual([]);
	});
});
