import { describe, expect, it } from 'vitest';
import { machineCan } from './spot-machine';

describe('spot machineCan', () => {
	it('binds and shares from unassigned, nothing else', () => {
		expect(machineCan('unassigned', 'BIND', { hasFlat: false })).toBe(true);
		expect(machineCan('unassigned', 'SHARE', { hasFlat: false })).toBe(true);
		expect(machineCan('unassigned', 'UNBIND', { hasFlat: false })).toBe(false);
		expect(machineCan('unassigned', 'LIMBO', { hasFlat: false })).toBe(false);
	});

	it('binds and shelves from shared (limbo needs no flat)', () => {
		expect(machineCan('shared', 'BIND', { hasFlat: false })).toBe(true);
		expect(machineCan('shared', 'LIMBO', { hasFlat: false })).toBe(true);
		expect(machineCan('shared', 'UNBIND', { hasFlat: false })).toBe(false);
		expect(machineCan('shared', 'SHARE', { hasFlat: false })).toBe(false);
	});

	it('rebinds freely from assigned, unbinds/shelves only with a flat', () => {
		expect(machineCan('assigned', 'BIND', { hasFlat: true })).toBe(true);
		expect(machineCan('assigned', 'UNBIND', { hasFlat: true })).toBe(true);
		expect(machineCan('assigned', 'UNBIND', { hasFlat: false })).toBe(false);
		expect(machineCan('assigned', 'LIMBO', { hasFlat: true })).toBe(true);
		expect(machineCan('assigned', 'LIMBO', { hasFlat: false })).toBe(false);
		expect(machineCan('assigned', 'SHARE', { hasFlat: true })).toBe(false);
	});
});
