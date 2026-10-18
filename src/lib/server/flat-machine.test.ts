import { describe, expect, it } from 'vitest';
import { machineCan } from './flat-machine';

describe('flat machineCan', () => {
	it('invites from inactive', () => {
		expect(machineCan('inactive', 'INVITE', { hasCode: false })).toBe(true);
		expect(machineCan('inactive', 'REVOKE', { hasCode: false })).toBe(false);
		expect(machineCan('inactive', 'CONSUME', { hasCode: false })).toBe(false);
	});

	it('refreshes, revokes (guarded), and consumes from pending', () => {
		expect(machineCan('pending', 'INVITE', { hasCode: true })).toBe(true);
		expect(machineCan('pending', 'REVOKE', { hasCode: true })).toBe(true);
		expect(machineCan('pending', 'REVOKE', { hasCode: false })).toBe(false);
		expect(machineCan('pending', 'CONSUME', { hasCode: true })).toBe(true);
	});

	it('locks active (terminal — no transitions out)', () => {
		expect(machineCan('active', 'INVITE', { hasCode: false })).toBe(false);
		expect(machineCan('active', 'REVOKE', { hasCode: false })).toBe(false);
		expect(machineCan('active', 'CONSUME', { hasCode: false })).toBe(false);
	});
});
