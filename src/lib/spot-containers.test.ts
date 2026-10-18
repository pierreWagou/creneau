import { describe, expect, it } from 'vitest';
import { getFlatColor } from './colors';
import { containerAvatar, containerTitle, spotChipProps } from './spot-containers';

describe('containerTitle', () => {
	it('matches the legacy strings', () => {
		expect(containerTitle({ kind: 'pool' })).toBe('Places partagées');
		expect(containerTitle({ kind: 'limbo' })).toBe('Non affectée');
		expect(containerTitle({ kind: 'lot', flatNumber: 'B22', displayName: 'Dupont' })).toBe('Lot B22');
	});
});

describe('containerAvatar', () => {
	it('gives the pool a blue avatar in both themes', () => {
		expect(containerAvatar({ kind: 'pool' }, false)).toEqual({ initial: 'P', tint: '#1e66f5' });
		expect(containerAvatar({ kind: 'pool' }, true)).toEqual({ initial: 'P', tint: '#89b4fa' });
	});

	it('gives limbo a muted (grey) avatar', () => {
		expect(containerAvatar({ kind: 'limbo' }, false)).toEqual({ initial: 'N', tint: null });
		expect(containerAvatar({ kind: 'limbo' }, true)).toEqual({ initial: 'N', tint: null });
	});

	it('gives lots their flat tint', () => {
		expect(containerAvatar({ kind: 'lot', flatNumber: 'B22', displayName: null }, false)).toEqual({
			initial: 'B',
			tint: getFlatColor('B22', false)
		});
	});

	it('prefers a valid stored color index', () => {
		expect(containerAvatar({ kind: 'lot', flatNumber: 'B22', displayName: null, colorIndex: 0 }, false)).toEqual({
			initial: 'B',
			tint: '#8839ef'
		});
	});

	it('falls back to the hash for missing or invalid indices', () => {
		const expected = { initial: 'B', tint: getFlatColor('B22', false) };
		expect(containerAvatar({ kind: 'lot', flatNumber: 'B22', displayName: null }, false)).toEqual(expected);
		expect(containerAvatar({ kind: 'lot', flatNumber: 'B22', displayName: null, colorIndex: null }, false)).toEqual(
			expected
		);
		expect(containerAvatar({ kind: 'lot', flatNumber: 'B22', displayName: null, colorIndex: NaN }, false)).toEqual(
			expected
		);
		expect(containerAvatar({ kind: 'lot', flatNumber: 'B22', displayName: null, colorIndex: 2.5 }, false)).toEqual(
			expected
		);
	});
});

describe('spotChipProps', () => {
	const directory = [
		{ number: '36', status: 'shared' as const, flatNumber: null },
		{ number: '82', status: 'assigned' as const, flatNumber: 'B22' },
		{ number: '84', status: 'unassigned' as const, flatNumber: null }
	];

	it('resolves status with lot tint for assigned spots', () => {
		expect(spotChipProps(directory, '82', false)).toEqual({
			spotStatus: 'assigned',
			spotTint: getFlatColor('B22', false)
		});
	});

	it('resolves shared and unassigned without tint', () => {
		expect(spotChipProps(directory, '36', false)).toEqual({ spotStatus: 'shared', spotTint: null });
		expect(spotChipProps(directory, '84', true)).toEqual({ spotStatus: 'unassigned', spotTint: null });
	});

	it('returns nulls for unknown spots', () => {
		expect(spotChipProps(directory, '99', false)).toEqual({ spotStatus: null, spotTint: null });
		expect(spotChipProps([], '36', false)).toEqual({ spotStatus: null, spotTint: null });
	});
});
