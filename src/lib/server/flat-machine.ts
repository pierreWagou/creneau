import { createMachine, getNextSnapshot } from 'xstate';
import type { FlatStatus } from './flat-state';

/**
 * The flat lifecycle as an XState v5 machine — single source of transition truth.
 * Pure and import-free (xstate only): safe to import from server and client alike.
 *
 * Server endpoints evaluate it transiently per request (no actors — each HTTP call is
 * independent). `expired` stays out of the machine: it is an invitation sub-state derived
 * from the code TTL at read time. `requested` lives in the request table.
 */
export type FlatMachineEvent = 'INVITE' | 'REVOKE' | 'CONSUME';

export interface FlatMachineContext {
	/** Whether an activation code is currently attached (drives the revoke guard) */
	hasCode: boolean;
}

export const flatMachine = createMachine(
	{
		id: 'flat',
		types: {} as {
			input: FlatMachineContext;
			context: FlatMachineContext;
			events: { type: FlatMachineEvent };
		},
		context: ({ input }) => ({ hasCode: input.hasCode }),
		initial: 'inactive',
		states: {
			inactive: {
				on: { INVITE: 'pending' }
			},
			pending: {
				on: {
					// Regenerate-refresh: re-enters pending with a fresh code, no state change.
					INVITE: { target: 'pending' },
					REVOKE: { target: 'inactive', guard: 'hasCode' },
					CONSUME: 'active'
				}
			},
			active: {}
		}
	},
	{
		guards: {
			hasCode: ({ context }) => context.hasCode
		}
	}
);

function snapshotFor(from: FlatStatus, context: FlatMachineContext) {
	// resolveState (not a spread copy): the snapshot carries resolved state nodes,
	// which guarded transitions consult. Hand-built spreads keep stale nodes.
	return flatMachine.resolveState({ value: from, context });
}

/**
 * Legality check used by flat-state.ts write functions.
 * INVITE on pending is a legal self-refresh despite the unchanged value.
 */
export function machineCan(from: FlatStatus, event: FlatMachineEvent, context: FlatMachineContext): boolean {
	if (from === 'pending' && event === 'INVITE') return true;
	const next = getNextSnapshot(flatMachine, snapshotFor(from, context), { type: event });
	return (next.value as FlatStatus) !== from;
}
