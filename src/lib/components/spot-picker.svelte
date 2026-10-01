<script lang="ts">
		import CarFront from '@lucide/svelte/icons/car-front';
	import { Input } from '$lib/components/ui/input';
	import * as Tabs from '$lib/components/ui/tabs';
	import { formatSpotNumber, isValidSpotNumber } from '$lib/constants';

	export interface PickerSpot {
		number: string;
		flatNumber: string | null;
		status: 'shared' | 'assigned' | 'unassigned';
		description?: string | null;
	}

	/** Directory enabling the constrained picker (omitted = legacy free typing) */
	export interface SpotDirectory {
		all: PickerSpot[];
		/** Never reveal holder flat numbers in tooltips/labels/notes (public pages) */
		maskHolder?: boolean;
	}

	interface Props {
		/** All known spots with holders — drives the unified list */
		allSpots: PickerSpot[];
		/** Numbers already in the draft (excluded from choices) */
		selected: string[];
		/** Never reveal holder flat numbers in tooltips/labels/notes (public pages) */
		maskHolder?: boolean;
		onSelect: (number: string) => void;
		onCancel: () => void;
	}

	let { allSpots, selected, maskHolder = false, onSelect, onCancel }: Props = $props();

	let typed = $state('');
	let showAssigned = $state(false);
	let rejectNote = $state<string | null>(null);
	let showAll = $state(false);

	const spotFilterTab = $derived(showAssigned ? 'all' : 'free');

	const t = $derived(typed.trim());
	/** Unfiltered preview stays small — search does the heavy lifting */
	const PREVIEW_LIMIT = 8;
	/**
	 * One list everywhere: unassigned first-hand, then shared pool, then
	 * bound — numeric inside each group. Warnings (not order) vary per flow.
	 */
	const rank = (s: PickerSpot): number =>
		s.status === 'unassigned' ? 0 : s.status === 'shared' ? 1 : 2;
	const matched = $derived(
		allSpots
			.filter(
				(s) =>
					(s.status === 'unassigned' || (showAssigned && (s.status === 'shared' || !!s.flatNumber))) &&
					!selected.includes(s.number)
			)
			.sort(
				(a, b) =>
					(rank(a) - rank(b) || Number(!!a.flatNumber) - Number(!!b.flatNumber)) ||
					(a.number < b.number ? -1 : a.number > b.number ? 1 : 0)
			)
	);
	const listShown = $derived(!showAll ? matched.slice(0, PREVIEW_LIMIT - 1) : matched);
	const truncated = $derived(matched.length > PREVIEW_LIMIT);

	function commitTyped() {
		rejectNote = null;
		if (t.length === 0 || !isValidSpotNumber(t)) return;
		const formatted = formatSpotNumber(t);
		if (selected.includes(formatted)) {
			onCancel();
			return;
		}
		const row = allSpots.find((s) => s.number === formatted);
		if (!row) {
			// Select-only: creation happens exclusively via the main spot-section button
			rejectNote = `Place « ${formatted} » inexistante — créez-la depuis la section “Place de parking partagée”.`;
			return;
		}
		// Any known spot stages into the draft (unassigned/shared/bound alike);
		// conflicts resolve at commit in the caller's conflict dialog.
		onSelect(formatted);
	}
</script>

<div class="space-y-3">
	<div class="flex items-center gap-1.5">
		<Input
			bind:value={typed}
			placeholder="N°"
			aria-label="Saisir un numéro de place"
			class="h-8 w-20 text-center"
			onkeydown={(e) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					commitTyped();
				} else if (e.key === 'Escape') {
					onCancel();
				}
			}}
		/>
		<Tabs.Root
			value={spotFilterTab}
			onValueChange={(v) => (showAssigned = v === 'all')}
			class="flex-1"
		>
			<Tabs.List class="grid w-full grid-cols-2 rounded-xl bg-muted p-1">
				<Tabs.Trigger
					value="free"
					class="rounded-full px-2 py-1 text-xs data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
				>
					Libres
				</Tabs.Trigger>
				<Tabs.Trigger
					value="all"
					class="rounded-full px-2 py-1 text-xs data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
				>
					Toutes
				</Tabs.Trigger>
			</Tabs.List>
		</Tabs.Root>
	</div>
	{#if rejectNote}
		<p class="text-xs text-warning">{rejectNote}</p>
	{/if}

	{#if listShown.length > 0}
		<div class="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto overscroll-contain">
			{#each listShown as s (s.number)}
				{@const holderNote = maskHolder ? 'Déjà attribuée' : `Attribuée au lot ${s.flatNumber}`}
				{@const poolNote = 'Place partagée — la demander la retire du pool commun'}
				{#if s.status === 'unassigned'}
					<button
						type="button"
						onclick={() => onSelect(s.number)}
						aria-label="Choisir la place {s.number}"
						class="flex items-center justify-center gap-1 rounded-md border border-border px-2 py-1.5 text-sm font-semibold transition-colors hover:border-foreground/30 hover:bg-muted/50"
					>
						<CarFront class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
						{s.number}
					</button>
				{:else if s.status === 'shared'}
					<button
						type="button"
						onclick={() => onSelect(s.number)}
						aria-label="Place {s.number}, place partagée — sélectionner quand même"
						title={poolNote}
						class="flex items-center justify-center gap-1 rounded-md border border-primary/40 bg-primary/5 px-2 py-1.5 text-sm font-semibold transition-colors hover:border-primary/60 hover:bg-primary/10"
					>
						<CarFront class="h-3.5 w-3.5 shrink-0 text-primary" />
						{s.number}
					</button>
				{:else}
					<button
						type="button"
						onclick={() => onSelect(s.number)}
						aria-label="Place {s.number}, {maskHolder ? 'déjà attribuée — sélectionner quand même' : `attribuée au lot ${s.flatNumber} — sélectionner quand même`}"
						title={holderNote}
						class="flex items-center justify-center gap-1 rounded-md border border-warning/40 bg-warning/5 px-2 py-1.5 text-sm font-semibold transition-colors hover:border-warning/60 hover:bg-warning/10"
					>
						<CarFront class="h-3.5 w-3.5 shrink-0 text-warning" />
						{s.number}
					</button>
				{/if}
			{/each}
			{#if truncated}
				<button
					type="button"
					onclick={() => (showAll = !showAll)}
					aria-label={showAll ? 'Afficher moins de places' : 'Afficher plus de places'}
					aria-expanded={showAll}
					class="rounded-md border border-dashed border-border px-2 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
				>
					{showAll ? '−' : '…'}
				</button>
			{/if}
		</div>
	{:else}
		<p class="text-xs text-muted-foreground">Aucune place disponible.</p>
	{/if}

</div>
