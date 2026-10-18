import { describe, expect, it } from 'vitest';
import {
	DAY_END,
	DAY_START,
	FLAT_NUMBER_REGEX,
	formatSpotNumber,
	isValidFlatNumber,
	isValidSpotNumber
} from './constants';
import { DAY_END as DAY_END_VIA_TYPES, DAY_START as DAY_START_VIA_TYPES } from './types';

describe('FLAT_NUMBER_REGEX', () => {
	it('accepts letter A/B + 2 digits', () => {
		expect(FLAT_NUMBER_REGEX.test('B12')).toBe(true);
		expect(FLAT_NUMBER_REGEX.test('A01')).toBe(true);
	});

	it('rejects wrong letters, lengths, and digits', () => {
		expect(FLAT_NUMBER_REGEX.test('C12')).toBe(false);
		expect(FLAT_NUMBER_REGEX.test('B1')).toBe(false);
		expect(FLAT_NUMBER_REGEX.test('B123')).toBe(false);
		expect(FLAT_NUMBER_REGEX.test('36')).toBe(false);
	});
});

describe('isValidFlatNumber', () => {
	it('uppercases before testing but does not trim', () => {
		expect(isValidFlatNumber('b12')).toBe(true);
		expect(isValidFlatNumber(' B01 ')).toBe(false);
		expect(isValidFlatNumber('nope')).toBe(false);
	});
});

describe('SPOT_NUMBER_REGEX / isValidSpotNumber', () => {
	it('accepts 1-2 digits', () => {
		expect(isValidSpotNumber('3')).toBe(true);
		expect(isValidSpotNumber('36')).toBe(true);
		expect(isValidSpotNumber(' 03 ')).toBe(true);
	});

	it('rejects letters, empties, and 3+ digits', () => {
		expect(isValidSpotNumber('')).toBe(false);
		expect(isValidSpotNumber('abc')).toBe(false);
		expect(isValidSpotNumber('123')).toBe(false);
	});
});

describe('formatSpotNumber', () => {
	it('zero-pads single digits', () => {
		expect(formatSpotNumber('3')).toBe('03');
		expect(formatSpotNumber('36')).toBe('36');
	});
});

describe('bookable-day bounds', () => {
	it('stay identical across both import homes (constants.ts owns, types.ts re-exports)', () => {
		expect(DAY_START).toBe(0);
		expect(DAY_END).toBe(24);
		expect(DAY_START_VIA_TYPES).toBe(DAY_START);
		expect(DAY_END_VIA_TYPES).toBe(DAY_END);
	});
});
