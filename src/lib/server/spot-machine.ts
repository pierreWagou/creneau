import { createMachine, getNextSnapshot } from 'xstate';
import type { SpotStatus } from './spot-state';

/**
 * The spot lifecycle as an XState v5 machine — single source of transition truth.
 * Pure and import-free (xstate only): safe to import from server and client alike.
 *
 * Server endpoints evaluate it transiently per request (no actors — each HTTP call is
 * independent). Invariant: assigned ⟺ flatNumber set; only shared is bookable.
 *
 * States:
 * - unassigned: limbo, newly created, awaiting routing (flatNumber null)
 * - shared:      the common pool, bookable (flatNumber null)
 * - assigned:    bound to a flat (flatNumber set)
 *
 * Events:
 * - BIND:   (any) → assigned — bind to a flat (rebind on assigned is a legal self-transition)
 * - UNBIND: assigned → shared — release the flat binding
 * - SHARE:  unassigned → shared — move to the bookable pool
 * - LIMBO:  shared|assigned → unassigned — shelve to limbo (assigned clears its flat binding)
 */
export type SpotMachineEvent = 'BIND' | 'UNBIND' | 'SHARE' | 'LIMBO';

interface SpotMachineContext {
	/** Whether the spot is currently bound to a flat (drives the unbind guard) */
	hasFlat: boolean;
}

const spotMachine = createMachine(
	{
		id: 'spot',
		types: {} as {
			input: SpotMachineContext;
			context: SpotMachineContext;
			events: { type: SpotMachineEvent };
		},
		context: ({ input }) => ({ hasFlat: input.hasFlat }),
		initial: 'unassigned',
		states: {
			unassigned: {
				on: {
					BIND: 'assigned',
					SHARE: 'shared'
				}
			},
			shared: {
				on: {
					BIND: 'assigned',
					LIMBO: 'unassigned'
				}
			},
			assigned: {
				on: {
					// Rebind: re-enters assigned with a different flat, no status change.
					BIND: { target: 'assigned' },
					UNBIND: { target: 'shared', guard: 'hasFlat' },
					// Shelve: clears the flat binding straight to limbo (strand-checked by writers).
					LIMBO: { target: 'unassigned', guard: 'hasFlat' }
				}
			}
		}
	},
	{
		guards: {
			hasFlat: ({ context }) => context.hasFlat
		}
	}
);

function snapshotFor(from: SpotStatus, context: SpotMachineContext) {
	// resolveState (not a spread copy): the snapshot carries resolved state nodes,
	// which guarded transitions consult. Hand-built spreads keep stale nodes.
	return spotMachine.resolveState({ value: from, context });
}

/**
 * Legality check used by spot-state.ts write functions and API handlers.
 * BIND on assigned is a legal re-bind despite the unchanged value.
 */
export function machineCan(from: SpotStatus, event: SpotMachineEvent, context: SpotMachineContext): boolean {
	if (from === 'assigned' && event === 'BIND') return true;
	const next = getNextSnapshot(spotMachine, snapshotFor(from, context), { type: event });
	return (next.value as SpotStatus) !== from;
}
