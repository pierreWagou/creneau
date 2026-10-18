import { describe, expect, it } from 'vitest';
import { rankComboboxMatches } from './combobox';

const items = [
	{ value: 'B12', label: 'B12 — Dupont' },
	{ value: 'A01', label: 'A01' },
	{ value: 'B01', label: 'B01 — Martin' }
];

describe('rankComboboxMatches', () => {
	it('returns no matches for an empty query', () => {
		expect(rankComboboxMatches(items, '  ', (i) => i.label)).toEqual([]);
	});

	it('matches case-insensitively with startsWith on top', () => {
		const result = rankComboboxMatches(items, 'a', (i) => i.label);
		expect(result.map((i) => i.value)).toEqual(['A01', 'B01']);
	});

	it('matches on a separate haystack while ranking by label', () => {
		const withHaystack = [
			{ value: 'B12', label: 'B12 — Dupont', haystack: 'b12 dupont' },
			{ value: 'A01', label: 'A01', haystack: 'a01' },
			{ value: 'B01', label: 'B01 — Martin', haystack: 'b01 martin' }
		];
		const result = rankComboboxMatches(
			withHaystack,
			'dupont',
			(i) => i.haystack,
			(i) => i.label
		);
		expect(result.map((i) => i.value)).toEqual(['B12']);
	});
});
