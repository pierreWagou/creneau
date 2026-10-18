<script lang="ts">
import Ban from '@lucide/svelte/icons/ban';
import CarFront from '@lucide/svelte/icons/car-front';
import MoveRight from '@lucide/svelte/icons/move-right';
import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
import { mode } from 'mode-watcher';
import type { Snippet } from 'svelte';
import { toast } from 'svelte-sonner';
import * as AlertDialog from '$lib/components/ui/alert-dialog';
import { Button } from '$lib/components/ui/button';
import { DIALOG_FOOTER_CLASS } from '$lib/constants';
	import { containerAvatar, containerTitle, type SpotContainer } from '$lib/spot-containers';
import type { DescribedSpotConflict } from '$lib/utils/spots';
import AsyncButton from './async-button.svelte';
import { selectableCardClass as cardClass } from './detail/selectable';
import DialogHeader from './dialog-header.svelte';
import DialogShell from './dialog-shell.svelte';
	import type { SpotLifecycleStatus } from './spot-chip.svelte';
	import SpotFlightStrip, { type FlightMove } from './spot-flight-strip.svelte';

	export interface ConflictChoice {
		spotNumber: string;
		action: 'reassign' | 'keep';
	}

	/** Lot directory feeding the mini lot-cards: holder lots, pool, and receiving lot */
	export interface ConflictAtlas {
		/** holder lot number → its current spot numbers (pool excluded) */
		holders: Record<string, string[]>;
		/** shared-pool spot numbers */
		pool: string[];
		/** receiving lot: display label + its current draft spots */
		target: { label: string; spots: string[] };
	}

	interface Props {
		open: boolean;
		title: string;
		subtitle: string;
		conflicts: DescribedSpotConflict[];
		atlas: ConflictAtlas;
		applying?: boolean;
		/** Pre-checked picks (staged choices restored on reopen); default = blank */
		initialPicks?: Record<string, 'keep' | 'reassign'>;
		/** Batch apply: reassign = force-include, keep = drop from the pending operation */
		onApply: (choices: ConflictChoice[]) => void;
		onClose: () => void;
	}

	let {
		open,
		title,
		subtitle,
		conflicts,
		atlas,
		applying = false,
		initialPicks = {},
		onApply,
		onClose
	}: Props = $props();

	let picks = $state<Record<string, 'keep' | 'reassign'>>({});
	/** Explicit user-gesture flights; the shared strip animates from these keys. */
	let flights = $state<Record<string, FlightMove | null>>({});
	let flightNonce = $state<Record<string, number>>({});
	let wasOpen = $state(false);
	$effect(() => {
		// Restore staged picks on open; identity churn of initialPicks must not reset mid-dialog
		if (open && !wasOpen) {
			picks = { ...initialPicks };
			flights = {};
			flightNonce = {};
		}
		wasOpen = open;
	});
	$effect(() => {
		// Single-viable-option rows (strand-blocked: Réaffecter disabled) auto-select
		// Garder — the counter counts picks only, so the visible state stays truthful.
		// The !== 'keep' gate guarantees termination: every write lands on 'keep',
		// so a re-run finds nothing left to change.
		for (const c of conflicts) {
			if (c.blocked && picks[c.spotNumber] !== 'keep') {
				picks[c.spotNumber] = 'keep';
			}
		}
	});

	const pickedCount = $derived(conflicts.filter((c) => picks[c.spotNumber]).length);
	const isDark = $derived(mode.current === 'dark');

	/** SpotContainer assembly for strip endpoints (titles stay byte-identical). */
	function sourceContainerFor(isPoolSrc: boolean, currentFlat: string): SpotContainer {
		return isPoolSrc ? { kind: 'pool' } : { kind: 'lot', flatNumber: currentFlat, displayName: null };
	}

	function destContainerFor(label: string): SpotContainer {
		return { kind: 'lot', flatNumber: label, displayName: null };
	}

	/** Lifecycle color resolver for a conflict row's strip: pool source is shared, holder lots assigned. */
	function spotStatusOfFor(
		src: string[],
		isPoolSrc: boolean,
		srcLot: string,
		dst: string[],
		dstLot: string
	): (spot: string) => { status: SpotLifecycleStatus; tint: string | null } | null {
		return (spot: string) => {
			if (src.includes(spot)) {
				return isPoolSrc
					? { status: 'shared', tint: null }
					: {
							status: 'assigned',
							tint: containerAvatar({ kind: 'lot', flatNumber: srcLot, displayName: null }, isDark).tint
						};
			}
			if (dst.includes(spot))
				return {
					status: 'assigned',
					tint: containerAvatar({ kind: 'lot', flatNumber: dstLot, displayName: null }, isDark).tint
				};
			return null;
		};
	}


	/** Shared pick-card frames keep the conflict cards visually consistent. */
	function conflictCardClass(selected: boolean, disabled: boolean): string {
		return cardClass(selected, disabled, true);
	}

	function requestFlight(spotNumber: string, direction: FlightMove['direction'], showPreview: boolean) {
		const nonce = (flightNonce[spotNumber] ?? 0) + 1;
		flightNonce[spotNumber] = nonce;
		flights[spotNumber] = {
			key: `${spotNumber}:${direction}:${nonce}`,
			direction,
			spot: spotNumber,
			showPreview
		};
	}

	function handleSelect(spotNumber: string, pick: 'keep' | 'reassign') {
		picks[spotNumber] = pick;
		requestFlight(spotNumber, pick === 'reassign' ? 'forward' : 'backward', pick === 'reassign');
	}

	function handleReject(spotNumber: string, currentFlat: string) {
		requestFlight(spotNumber, 'bounce', false);
		toast.warning(
			`Affectation impossible : le lot ${currentFlat} doit conserver au moins une place. Ajoutez-lui une autre place, ou supprimez le lot.`,
			{ id: `strand-blocked-${spotNumber}` }
		);
	}

	function apply() {
		if (pickedCount === 0 || applying) return;
		// Partial apply: emit decided rows only. Undecided rows stay in the
		// dialog for a later batch — never silently defaulted to 'keep'.
		onApply(
			conflicts.flatMap((c) => {
				const pick = picks[c.spotNumber];
				if (!pick) return [];
				return [{ spotNumber: c.spotNumber, action: c.blocked ? 'keep' : pick }];
			})
		);
	}

</script>

<DialogShell kind="alert" size="lg" {open} {onClose}>
	<DialogHeader
		kind="alert"
		icon={TriangleAlert}
		tone="warning"
		{title}
		{subtitle}
		{onClose}
		headerClass="place-items-start text-left w-full"
		descriptionClass="text-left text-wrap"
	/>
		<div class="space-y-3">
		{#each conflicts as c (c.spotNumber)}
			{@const isPool = c.kind === 'shared-pool'}
			{@const keepPicked = picks[c.spotNumber] === 'keep'}
			{@const takePicked = picks[c.spotNumber] === 'reassign'}
			{@const srcSpots = isPool ? atlas.pool : (atlas.holders[c.currentFlat] ?? [])}
			{@const dstBase = atlas.target.spots.filter((n) => n !== c.spotNumber)}
			{@const move = flights[c.spotNumber] ?? null}
			{#snippet sourceCard(content: Snippet)}
				<label class={conflictCardClass(keepPicked, false)} data-fly-home>
					<input
						type="radio"
						name="conflict-{c.spotNumber}"
						value="keep"
						class="sr-only"
						checked={keepPicked}
						disabled={applying}
						onchange={() => handleSelect(c.spotNumber, 'keep')}
					/>
					{@render content()}
				</label>
			{/snippet}
			{#snippet destinationCard(content: Snippet)}
				{#if c.blocked}
					<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions: bounce flight is pointer-only delight feedback on an aria-disabled card; state is fully exposed via the auto-selected keep option, counter, tooltip, and sr-only text -->
					<div
						class={conflictCardClass(false, true)}
						aria-disabled="true"
						title="Impossible : le lot {c.currentFlat} n'aurait plus de place"
						onclick={() => handleReject(c.spotNumber, c.currentFlat)}
					>
						{@render content()}
					</div>
				{:else}
					<label class={conflictCardClass(takePicked, false)}>
						<input
							type="radio"
							name="conflict-{c.spotNumber}"
							value="reassign"
							class="sr-only"
							checked={takePicked}
							disabled={applying}
							onchange={() => handleSelect(c.spotNumber, 'reassign')}
						/>
						{@render content()}
					</label>
				{/if}
			{/snippet}
			{#snippet center()}
				<span class="flex flex-col items-center justify-center" aria-hidden="true">
					{#if c.blocked}
						<Ban class="h-4 w-4 shrink-0 text-warning" />
					{:else}
						<MoveRight class="h-4 w-4 shrink-0 text-muted-foreground" />
					{/if}
				</span>
			{/snippet}
			<fieldset class="rounded-lg border p-3">
				<legend class="sr-only">Résolution pour la place {c.spotNumber}</legend>
				<div class="flex items-center gap-2 text-sm">
					<CarFront class="h-4 w-4 shrink-0 text-muted-foreground" />
					<span class="font-semibold">Place {c.spotNumber}</span>
				</div>
				<div class="mt-2">
					<SpotFlightStrip
						source={{
							title: containerTitle(sourceContainerFor(isPool, c.currentFlat)),
							spots: srcSpots,
							avatar: containerAvatar(sourceContainerFor(isPool, c.currentFlat), isDark)
						}}
						destination={{
							title: containerTitle(destContainerFor(atlas.target.label)),
							avatar: containerAvatar(destContainerFor(atlas.target.label), isDark),
							
							spots: dstBase,
							titleMuted: c.blocked,
							note: c.blocked ? `Impossible : le lot ${c.currentFlat} n'aurait plus de place` : undefined
						}}
						move={move}
						strikeSpot={takePicked ? c.spotNumber : null}
						spotStatusOf={spotStatusOfFor(srcSpots, isPool, c.currentFlat, dstBase, atlas.target.label)}
						ariaLabel={`Résolution pour la place ${c.spotNumber}`}
						role="radiogroup"
						framed={false}
						sourceCard={sourceCard}
						destinationCard={destinationCard}
						center={center}
					/>
				</div>
			</fieldset>
		{/each}
		</div>
		<AlertDialog.Footer class={DIALOG_FOOTER_CLASS}>
			<AlertDialog.Cancel disabled={applying}>Annuler</AlertDialog.Cancel>
			<AsyncButton disabled={pickedCount === 0 || applying} loading={applying} onclick={apply}>
				Appliquer ({pickedCount}/{conflicts.length})
			</AsyncButton>
		</AlertDialog.Footer>
	</DialogShell>
