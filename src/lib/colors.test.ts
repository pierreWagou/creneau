import { describe, expect, it } from 'vitest';
import { FLAT_COLORS_DARK, FLAT_COLORS_LIGHT, flatColorForIndex, flatColorIndex, getFlatColor } from './colors';

describe('flatColorIndex', () => {
	it('is deterministic per flat number', () => {
		expect(flatColorIndex('B22')).toBe(flatColorIndex('B22'));
	});

	it('stays within the palette', () => {
		for (const n of ['A01', 'B12', 'B22', '36', 'Z99']) {
			const i = flatColorIndex(n);
			expect(i).toBeGreaterThanOrEqual(0);
			expect(i).toBeLessThan(FLAT_COLORS_LIGHT.length);
		}
	});
});

describe('flatColorForIndex', () => {
	it('resolves both themes', () => {
		expect(flatColorForIndex(0, false)).toBe(FLAT_COLORS_LIGHT[0]);
		expect(flatColorForIndex(0, true)).toBe(FLAT_COLORS_DARK[0]);
	});

	it('wraps negatives and overflow', () => {
		expect(flatColorForIndex(8, false)).toBe(FLAT_COLORS_LIGHT[0]);
		expect(flatColorForIndex(-1, false)).toBe(FLAT_COLORS_LIGHT[7]);
	});
});

describe('getFlatColor', () => {
	it('delegates to index resolution (byte-identical)', () => {
		for (const n of ['A01', 'B12', 'B22']) {
			expect(getFlatColor(n, false)).toBe(flatColorForIndex(flatColorIndex(n), false));
			expect(getFlatColor(n, true)).toBe(flatColorForIndex(flatColorIndex(n), true));
		}
	});
});
