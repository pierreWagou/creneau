import { describe, expect, it, vi } from 'vitest';
import { machineCan } from './flat-machine';
import type { FlatEvent } from './flat-state';

// These tests cover pure transition logic only: stub the DB module whose top-level
// session-cleanup query has no database available in the unit-test environment.
vi.mock('./db', () => ({ db: {} }));

import { canTransition, FlatTransitionError, isInvitationExpired } from './flat-state';

describe('canTransition', () => {
	const cases: Array<[string, FlatEvent, boolean]> = [
		// invite: generate (inactive) + regenerate-refresh (pending); never on active
		['inactive', 'invite', true],
		['pending', 'invite', true],
		['active', 'invite', false],
		// revoke / consume: pending only (no invitation ⟹ inactive, nothing to revoke/consume)
		['inactive', 'revoke', false],
		['active', 'revoke', false],
		['inactive', 'consume', false],
		['pending', 'consume', true],
		['active', 'consume', false],
		// unknown states never transition
		['expired', 'invite', false],
		['', 'consume', false]
	];

	for (const [from, event, expected] of cases) {
		it(`${event} from ${from || '(empty)'} → ${expected}`, () => {
			expect(canTransition(from, event)).toBe(expected);
		});
	}

	it('revoke from pending requires an attached code (machine guard)', () => {
		expect(canTransition('pending', 'revoke', { hasCode: true })).toBe(true);
		expect(canTransition('pending', 'revoke', { hasCode: false })).toBe(false);
		expect(canTransition('pending', 'revoke')).toBe(false);
	});
});

describe('machineCan (XState source of truth)', () => {
	it('INVITE advances inactive → pending', () => {
		expect(machineCan('inactive', 'INVITE', { hasCode: false })).toBe(true);
	});

	it('INVITE on pending is a legal self-refresh', () => {
		expect(machineCan('pending', 'INVITE', { hasCode: true })).toBe(true);
	});

	it('REVOKE follows the hasCode guard', () => {
		expect(machineCan('pending', 'REVOKE', { hasCode: true })).toBe(true);
		expect(machineCan('pending', 'REVOKE', { hasCode: false })).toBe(false);
	});

	it('illegal events leave the value (not legal)', () => {
		expect(machineCan('active', 'INVITE', { hasCode: false })).toBe(false);
		expect(machineCan('inactive', 'CONSUME', { hasCode: false })).toBe(false);
		expect(machineCan('active', 'CONSUME', { hasCode: false })).toBe(false);
	});
});

describe('isInvitationExpired', () => {
	it('null expiry means no TTL (still valid)', () => {
		expect(isInvitationExpired(null)).toBe(false);
	});

	it('past timestamp is expired', () => {
		expect(isInvitationExpired(new Date(Date.now() - 1000).toISOString())).toBe(true);
	});

	it('future timestamp is valid', () => {
		expect(isInvitationExpired(new Date(Date.now() + 3600_000).toISOString())).toBe(false);
	});
});

describe('FlatTransitionError', () => {
	it('defaults to 409', () => {
		const err = new FlatTransitionError('nope');
		expect(err.statusCode).toBe(409);
		expect(err.message).toBe('nope');
	});

	it('accepts a custom status code', () => {
		expect(new FlatTransitionError('missing', 404).statusCode).toBe(404);
	});
});
