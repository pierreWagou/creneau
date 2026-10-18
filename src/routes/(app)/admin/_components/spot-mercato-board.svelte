<script lang="ts">
	import './spot-mercato-board.css';
	import CarFront from '@lucide/svelte/icons/car-front';
	import { Combobox } from 'bits-ui';
	import { mode } from 'mode-watcher';
	import { flip } from 'svelte/animate';
	import { dndzone, TRIGGERS } from 'svelte-dnd-action';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import SearchField from '$lib/components/search-field.svelte';
	import { spotChipFullClass, spotChipIconClass, spotStatusStyle } from '$lib/components/spot-chip.svelte';
	import SpotEndpointCard from '$lib/components/spot-endpoint-card.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { DND_FLIP_DURATION_MS } from '$lib/constants';
	import { containerAvatar, type SpotContainer, spotChipProps } from '$lib/spot-containers';
	import { apiFetch } from '$lib/utils/api';
	import { rankComboboxMatches } from '$lib/utils/combobox';
	import { prefersReducedMotion } from '$lib/utils/motion';
	import { notifyResult } from '$lib/utils/toasts';

	interface BoardSpot {
		number: string;
		flatNumber: string | null;
		status: 'shared' | 'assigned' | 'unassigned';
	}

	interface Props {
		spots: BoardSpot[];
		flatOptions: { number: string; displayName: string | null }[];
	}

	type ColumnId = `flat:${string}` | 'pool' | 'pending';

	interface ZoneItem {
		id: string;
		isDndShadowItem?: boolean;
	}

	let { spots, flatOptions }: Props = $props();

	const reduceMotion = $derived(prefersReducedMotion());
	const isDark = $derived(mode.current === 'dark');

	// Selection values are plain lot/spot numbers — the two pickers are
	// separate controls, so no namespacing is needed.
	let selectedLots = $state<string[]>([]);
	let selectedSpots = $state<string[]>([]);
	let lotSearch = $state('');
	let spotSearch = $state('');
	let lotOpen = $state(false);
	let spotOpen = $state(false);
	let lotInputEl = $state<HTMLInputElement | null>(null);
	let spotInputEl = $state<HTMLInputElement | null>(null);
	let applying = $state(false);
	/** Column currently hovered mid-drag: gets the dashed blue whole-frame outline. */
	let hoveredCol = $state<ColumnId | null>(null);

	/** Staged overrides: spot number → destination column. Absent = server snapshot. */
	let staged = $state<Record<string, ColumnId>>({});

	const flatLabel = (number: string): string => {
		const found = flatOptions.find((f) => f.number === number);
		return found?.displayName ? `${number} — ${found.displayName}` : number;
	};

	function lotContainer(flatNumber: string): SpotContainer {
		return {
			kind: 'lot',
			flatNumber,
			displayName: flatOptions.find((f) => f.number === flatNumber)?.displayName ?? null
		};
	}

	const spotHome = (spot: BoardSpot): ColumnId =>
		spot.flatNumber ? `flat:${spot.flatNumber}` : spot.status === 'shared' ? 'pool' : 'pending';

	const spotByNumber = $derived(new Map(spots.map((s) => [s.number, s])));

	const spotsOfFlat = (flatNumber: string): string[] =>
		spots.filter((s) => s.flatNumber === flatNumber).map((s) => s.number);

	function clearSearch(which: 'lot' | 'spot') {
		if (which === 'lot') {
			lotSearch = '';
			if (lotInputEl) lotInputEl.value = '';
		} else {
			spotSearch = '';
			if (spotInputEl) spotInputEl.value = '';
		}
	}

	/**
	 * Linked selection, enforced on user picks (`onValueChange` only fires on
	 * user interaction, so programmatic expansion cannot loop):
	 * - picking a lot also picks its current spots;
	 * - unpicking a lot drops the lot and its spots;
	 * - picking a spot pulls in its lot plus the lot's other spots;
	 * - unpicking a spot drops just that spot.
	 */
	function handleLotChange(next: string[]) {
		const prev = new Set(selectedLots);
		let nextSpots = selectedSpots;
		for (const f of next.filter((lot) => !prev.has(lot))) {
			nextSpots = [...new Set([...nextSpots, ...spotsOfFlat(f)])];
		}
		for (const f of [...prev].filter((lot) => !next.includes(lot))) {
			const gone = new Set(spotsOfFlat(f));
			nextSpots = nextSpots.filter((s) => !gone.has(s));
		}
		selectedLots = next;
		selectedSpots = nextSpots;
		clearSearch('lot');
	}

	function handleSpotChange(next: string[]) {
		const prev = new Set(selectedSpots);
		let nextLots = selectedLots;
		let expanded = next;
		for (const s of next.filter((spot) => !prev.has(spot))) {
			const home = spotByNumber.get(s)?.flatNumber;
			if (!home) continue;
			if (!nextLots.includes(home)) nextLots = [...nextLots, home];
			expanded = [...new Set([...expanded, ...spotsOfFlat(home)])];
		}
		selectedSpots = expanded;
		selectedLots = nextLots;
		clearSearch('spot');
	}

	function clearSelection() {
		selectedLots = [];
		selectedSpots = [];
		clearSearch('lot');
		clearSearch('spot');
	}

	/** Flats shown as columns: chosen lots first, then lots owning chosen spots. */
	const shownFlats = $derived([
		...selectedLots,
		...selectedSpots
			.map((n) => spotByNumber.get(n)?.flatNumber)
			.filter((f): f is string => !!f && !selectedLots.includes(f))
	]);

	const shownColumns = $derived<ColumnId[]>([
		...shownFlats.map((f) => `flat:${f}` as ColumnId),
		'pool'
	]);

	const columnOf = (number: string): ColumnId => staged[number] ?? spotHome(spotByNumber.get(number)!);

	/** Spots rendered on the board: homed in a shown column, or explicitly picked. */
	const boardNumbers = $derived(
		spots
			.filter((s) => shownColumns.includes(spotHome(s)) || selectedSpots.includes(s.number))
			.map((s) => s.number)
			.sort((a, b) => (a < b ? -1 : 1))
	);

	const columnItems = $derived(
		Object.fromEntries(
			shownColumns.map((col) => [
				col,
				boardNumbers.filter((n) => columnOf(n) === col).map((id) => ({ id }))
			])
		) as Record<ColumnId, ZoneItem[]>
	);

	/**
	 * Transient in-drag lists (consider payloads), keyed by column. The
	 * library requires both consider and finalize to refresh its items;
	 * staged state is only ever written on finalize.
	 */
	let dragLists = $state<Partial<Record<ColumnId, ZoneItem[]>>>({});

	/** Rendered items per zone: live drag list while dragging, staged view otherwise. */
	const zoneItems = (col: ColumnId): ZoneItem[] =>
		dragLists[col] ??
		(col === 'pending'
			? pendingPicks.map((id) => ({ id }))
			: (columnItems[col] ?? []));

	const visibleMoves = $derived(
		Object.entries(staged).filter(
			([number, col]) =>
				boardNumbers.includes(number) && (shownColumns.includes(col) || col === 'pending')
		) as [string, ColumnId][]
	);

	/** Explicitly picked pending spots: frameless chips on top of the frame. */
	const pendingPicks = $derived(boardNumbers.filter((n) => columnOf(n) === 'pending'));

	/** Final holdings across every flat, staged moves applied. */
	const finalHoldings = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const s of spots) {
			if (s.flatNumber) counts.set(s.flatNumber, (counts.get(s.flatNumber) ?? 0) + 1);
		}
		for (const [number, col] of visibleMoves) {
			const before = spotByNumber.get(number)?.flatNumber;
			const after = col.startsWith('flat:') ? col.slice('flat:'.length) : null;
			if (before && before !== after) counts.set(before, (counts.get(before) ?? 0) - 1);
			if (after && after !== before) counts.set(after, (counts.get(after) ?? 0) + 1);
		}
		return counts;
	});

	const strandedFlats = $derived(
		[...finalHoldings.entries()]
			.filter(([flatNumber, count]) => {
				const initial = spots.filter((s) => s.flatNumber === flatNumber).length;
				return count === 0 && initial > 0;
			})
			.map(([flatNumber]) => flatNumber)
	);

	const dirty = $derived(visibleMoves.length > 0);

	function targetOf(col: ColumnId): { type: 'flat'; flatNumber: string } | { type: 'shared' } | { type: 'unassigned' } {
		if (col === 'pool') return { type: 'shared' };
		if (col === 'pending') return { type: 'unassigned' };
		return { type: 'flat', flatNumber: col.slice('flat:'.length) };
	}

	function commitItems(col: ColumnId, items: ZoneItem[]) {
		const known = items.filter((item) => !item.isDndShadowItem && spotByNumber.has(item.id));
		const knownSet = new Set(known.map((item) => item.id));
		for (const id of knownSet) {
			const home = spotHome(spotByNumber.get(id)!);
			if (col === home) delete staged[id];
			else staged[id] = col;
		}
		// Snap back anything staged to this column but no longer listed here
		// (and homed here): order-independent no matter which zone fires first.
		for (const [id, target] of Object.entries(staged)) {
			if (target === col && !knownSet.has(id) && spotHome(spotByNumber.get(id)!) === col) {
				delete staged[id];
			}
		}
	}

	function handleConsider(col: ColumnId, e: CustomEvent<{ items: ZoneItem[]; info: { trigger: string; id: string } }>) {
		// Keyboard cancel (Escape): drop all transient lists so the board snaps back.
		if (e.detail.info.trigger === TRIGGERS.DRAG_STOPPED) {
			dragLists = {};
			hoveredCol = null;
			return;
		}
		// Track the hovered column for the whole-frame drop outline. Only
		// entered/left transitions touch it; over-index moves leave it alone.
		// Left clears conditionally: consider events from two zones can
		// interleave in either order during a single drag.
		if (
			e.detail.info.trigger === TRIGGERS.DRAGGED_ENTERED ||
			e.detail.info.trigger === TRIGGERS.DRAGGED_ENTERED_ANOTHER
		) {
			hoveredCol = col;
		} else if (
			(e.detail.info.trigger === TRIGGERS.DRAGGED_LEFT ||
				e.detail.info.trigger === TRIGGERS.DRAGGED_LEFT_ALL) &&
			hoveredCol === col
		) {
			hoveredCol = null;
		}
		dragLists[col] = e.detail.items;
	}

	function handleFinalize(col: ColumnId, e: CustomEvent<{ items: ZoneItem[]; info: { trigger: string; id: string } }>) {
		hoveredCol = null;
		if (e.detail.info.trigger === TRIGGERS.DROPPED_OUTSIDE_OF_ANY) {
			dragLists = {};
			return;
		}
		commitItems(col, e.detail.items);
		dragLists = {};
	}

	function reset() {
		staged = {};
	}

	async function apply() {
		const moves = visibleMoves.map(([spotNumber, col]) => ({ spotNumber, to: targetOf(col) }));
		if (moves.length === 0) return;
		if (strandedFlats.length > 0) return;
		applying = true;
		const result = await apiFetch<{ updated: number }>(
			'/api/admin/spots/moves',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ moves })
			},
			'Impossible d’appliquer la bourse aux places'
		);
		if (result.ok && result.data) {
			const { updated } = result.data;
			toast.success(`${updated} place${updated > 1 ? 's' : ''} réaffectée${updated > 1 ? 's' : ''}`);
			staged = {};
			await invalidateAll();
		} else if (!result.ok) {
			notifyResult(result, null, 'Impossible d’appliquer la bourse aux places');
			staged = {};
			await invalidateAll();
		}
		applying = false;
	}

	// Combobox options, filtered by each search input.
	const lotItems = $derived(flatOptions.map((f) => ({ value: f.number, label: flatLabel(f.number) })));
	const spotItems = $derived(
		spots.map((s) => ({
			value: s.number,
			label: s.flatNumber ? `${s.number} — ${flatLabel(s.flatNumber)}` : `${s.number} — ${s.status === 'shared' ? 'Places partagées' : 'Non affectée'}`
		}))
	);
	const filteredLots = $derived(
		lotSearch.trim() === '' ? lotItems : rankComboboxMatches(lotItems, lotSearch, (i) => i.label)
	);
	const filteredSpots = $derived(
		spotSearch.trim() === '' ? spotItems : rankComboboxMatches(spotItems, spotSearch, (i) => i.label)
	);
	const selectedCount = $derived(selectedLots.length + selectedSpots.length);
</script>

<div class="space-y-3" role="group" aria-label="Bourse aux places">
	<div class="flex flex-wrap items-center gap-2">
		<div class="flex w-full items-center gap-2 sm:w-auto">
			<Label class="w-12 shrink-0 text-xs font-medium tracking-wide text-muted-foreground uppercase sm:w-auto">Lot</Label>
			<SearchField
				value={lotSearch}
				onClear={() => {
					clearSearch('lot');
					lotOpen = false;
				}}
				class="min-w-0 flex-1 sm:w-64 sm:flex-none"
			>
		<Combobox.Root
			type="multiple"
			bind:value={selectedLots}
			bind:open={lotOpen}
			items={lotItems}
			onValueChange={handleLotChange}
			onOpenChangeComplete={(o) => {
				if (!o) clearSearch('lot');
			}}
		>
			<Combobox.Input
				bind:ref={lotInputEl}
				oninput={(e) => {
					lotSearch = e.currentTarget.value;
					lotOpen = true;
				}}
				placeholder="Rechercher…"
				aria-label="Rechercher un lot"
				class="dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-lg border bg-transparent py-1 pr-8 pl-8 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-3"
			/>
			<Combobox.Portal>
				<Combobox.Content
					class="bg-popover text-popover-foreground border-border z-[60] max-h-72 w-[var(--bits-combobox-anchor-width)] min-w-[var(--bits-combobox-anchor-width)] overflow-y-auto rounded-lg border p-1 shadow-md"
					sideOffset={4}
				>
					<Combobox.Viewport class="p-1">
						{#each filteredLots as item (item.value)}
							<Combobox.Item
								value={item.value}
								label={item.label}
								class="data-highlighted:bg-muted flex h-8 cursor-default items-center rounded-sm px-2 text-sm outline-none select-none"
							>
								{#snippet children({ selected })}
									{item.label}
									{#if selected}
										<span class="text-success ml-auto text-xs font-semibold">✓</span>
									{/if}
								{/snippet}
							</Combobox.Item>
						{:else}
							<span class="text-muted-foreground block px-2 py-1.5 text-sm">Aucun lot</span>
						{/each}
					</Combobox.Viewport>
				</Combobox.Content>
			</Combobox.Portal>
		</Combobox.Root>
			</SearchField>
		</div>
		<div class="flex w-full items-center gap-2 sm:w-auto">
			<Label class="w-12 shrink-0 text-xs font-medium tracking-wide text-muted-foreground uppercase sm:w-auto">Place</Label>
			<SearchField
				value={spotSearch}
				onClear={() => {
					clearSearch('spot');
					spotOpen = false;
				}}
				class="min-w-0 flex-1 sm:w-64 sm:flex-none"
			>
		<Combobox.Root
			type="multiple"
			bind:value={selectedSpots}
			bind:open={spotOpen}
			items={spotItems}
			onValueChange={handleSpotChange}
			onOpenChangeComplete={(o) => {
				if (!o) clearSearch('spot');
			}}
		>
			<Combobox.Input
				bind:ref={spotInputEl}
				oninput={(e) => {
					spotSearch = e.currentTarget.value;
					spotOpen = true;
				}}
				placeholder="Rechercher…"
				aria-label="Rechercher une place"
				class="dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-lg border bg-transparent py-1 pr-8 pl-8 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-3"
			/>
			<Combobox.Portal>
				<Combobox.Content
					class="bg-popover text-popover-foreground border-border z-[60] max-h-72 w-[var(--bits-combobox-anchor-width)] min-w-[var(--bits-combobox-anchor-width)] overflow-y-auto rounded-lg border p-1 shadow-md"
					sideOffset={4}
				>
					<Combobox.Viewport class="p-1">
						{#each filteredSpots as item (item.value)}
							<Combobox.Item
								value={item.value}
								label={item.label}
								class="data-highlighted:bg-muted flex h-8 cursor-default items-center rounded-sm px-2 text-sm outline-none select-none"
							>
								{#snippet children({ selected })}
									{item.label}
									{#if selected}
										<span class="text-success ml-auto text-xs font-semibold">✓</span>
									{/if}
								{/snippet}
							</Combobox.Item>
						{:else}
							<span class="text-muted-foreground block px-2 py-1.5 text-sm">Aucune place</span>
						{/each}
					</Combobox.Viewport>
				</Combobox.Content>
			</Combobox.Portal>
		</Combobox.Root>
			</SearchField>
		</div>
		{#if selectedCount > 0}
			<Badge variant="secondary">{selectedCount} sélectionné{selectedCount > 1 ? 's' : ''}</Badge>
			<Button variant="ghost" size="sm" onclick={clearSelection}>Effacer</Button>
		{/if}
	</div>

	<!-- Places partagées + Non affectée — première ligne du board, toujours visible -->
	<div class="grid gap-3 sm:grid-cols-2">
		<div
			class="min-w-0 rounded-lg {hoveredCol === 'pool' ? 'outline-2 outline-dashed outline-primary/60 outline-offset-2' : ''}"
			aria-label="Places partagées"
		>
			<SpotEndpointCard title="Places partagées" avatar={containerAvatar({ kind: 'pool' }, isDark)}>
				{#snippet chips()}
					{@const zone = zoneItems('pool')}
					<div
					data-testid="mercato-zone-pool"
						class="flex min-h-12 flex-1 flex-wrap content-start gap-1.5 rounded-md p-0.5"
						use:dndzone={{
							items: zone,
							type: 'mercato-spot',
							flipDurationMs: reduceMotion ? 0 : DND_FLIP_DURATION_MS,
							delayTouchStart: true,
							// Explicit empty object: omitting dropTargetStyle restores the
							// library's yellow default outline on every valid zone.
							dropTargetStyle: {}
						}}
						onconsider={(e) => handleConsider('pool', e)}
						onfinalize={(e) => handleFinalize('pool', e)}
					>
						{#each zone as item (item.id)}
							{@const shadow = !!item.isDndShadowItem}
							{@const spot = spotByNumber.get(item.id)}
							{@const moved = !shadow && spot
								? staged[item.id] !== undefined && staged[item.id] !== spotHome(spot)
								: false}
							{@const tint = !shadow ? spotChipProps(spots, item.id, isDark).spotTint : null}
														<div
								animate:flip={{ duration: reduceMotion ? 0 : DND_FLIP_DURATION_MS }}
								class="flex cursor-grab touch-none items-center gap-1 {spotChipFullClass('md', shadow ? 'shadow' : moved ? 'highlight' : 'muted', spot?.status ?? null)}"
								style={spotStatusStyle(spot?.status ?? null, tint) ?? undefined}
								aria-hidden={shadow ? true : undefined}
								aria-label={shadow ? undefined : spot ? `Place ${spot.number}, Places partagées` : `Place ${item.id}`}
							>
								{#if shadow}
									…
								{:else}
									<CarFront class={spotChipIconClass('md')} aria-hidden="true" />
									{item.id}
								{/if}
							</div>
						{/each}
					</div>
				{/snippet}
			</SpotEndpointCard>
		</div>

		<!-- Non affectée — titled frame -->
		<div
			class="min-w-0 rounded-lg {hoveredCol === 'pending' ? 'outline-2 outline-dashed outline-primary/60 outline-offset-2' : ''}"
			aria-label="Non affectée"
		>
			<SpotEndpointCard title="Non affectée" avatar={containerAvatar({ kind: 'limbo' }, isDark)}>
				{#snippet chips()}
					{@const zone = zoneItems('pending')}
					<div
					data-testid="mercato-zone-pending"
						class="flex min-h-12 flex-1 flex-wrap content-start gap-1.5 rounded-md p-0.5"
						use:dndzone={{
							items: zone,
							type: 'mercato-spot',
							flipDurationMs: reduceMotion ? 0 : DND_FLIP_DURATION_MS,
							delayTouchStart: true,
							// Explicit empty object: omitting dropTargetStyle restores the
							// library's yellow default outline on every valid zone.
							dropTargetStyle: {}
						}}
						onconsider={(e) => handleConsider('pending', e)}
						onfinalize={(e) => handleFinalize('pending', e)}
					>
						{#each zone as item (item.id)}
							{@const shadow = !!item.isDndShadowItem}
							{@const spot = spotByNumber.get(item.id)}
							{@const moved = !shadow && spot
								? staged[item.id] !== undefined && staged[item.id] !== spotHome(spot)
								: false}
							{@const tint = !shadow ? spotChipProps(spots, item.id, isDark).spotTint : null}
														<div
								animate:flip={{ duration: reduceMotion ? 0 : DND_FLIP_DURATION_MS }}
								class="flex cursor-grab touch-none items-center gap-1 {spotChipFullClass('md', shadow ? 'shadow' : moved ? 'highlight' : 'muted', spot?.status ?? null)}"
								style={spotStatusStyle(spot?.status ?? null, tint) ?? undefined}
								aria-hidden={shadow ? true : undefined}
								aria-label={shadow ? undefined : spot ? `Place ${spot.number}, non affectée` : `Place ${item.id}`}
							>
								{#if shadow}
									…
								{:else}
									<CarFront class={spotChipIconClass('md')} aria-hidden="true" />
									{item.id}
								{/if}
							</div>
						{/each}
					</div>
				{/snippet}
			</SpotEndpointCard>
		</div>

		</div>

		{#if shownFlats.length > 0}
			<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				{#each shownFlats as flatNumber (flatNumber)}
					{@const col = `flat:${flatNumber}` as ColumnId}
					{@const title = `Lot ${flatNumber}`}
					{@const stranded = strandedFlats.includes(flatNumber)}
					<div
						class="relative min-w-0 rounded-lg {hoveredCol === col ? 'outline-2 outline-dashed outline-primary/60 outline-offset-2' : ''}"
						aria-label={title}
					>
						<SpotEndpointCard
							{title}
							warning={stranded}
							warningMessage={stranded ? 'Ce lot se retrouverait sans place' : undefined}
							avatar={containerAvatar(lotContainer(flatNumber), isDark)}
						>
							{#snippet chips()}
								{@const zone = zoneItems(col)}
								<div
								data-testid={`mercato-zone-${flatNumber}`}
									class="flex min-h-12 flex-1 flex-wrap content-start gap-1.5 rounded-md p-0.5"
									use:dndzone={{
										items: zone,
										type: 'mercato-spot',
										flipDurationMs: reduceMotion ? 0 : DND_FLIP_DURATION_MS,
										delayTouchStart: true,
										// Explicit empty object: omitting dropTargetStyle restores the
										// library's yellow default outline on every valid zone.
										dropTargetStyle: {}
									}}
									onconsider={(e) => handleConsider(col, e)}
									onfinalize={(e) => handleFinalize(col, e)}
								>
									{#each zone as item (item.id)}
										{@const shadow = !!item.isDndShadowItem}
										{@const spot = spotByNumber.get(item.id)}
										{@const moved = !shadow && spot
											? staged[item.id] !== undefined && staged[item.id] !== spotHome(spot)
											: false}
										{@const tint = !shadow ? spotChipProps(spots, item.id, isDark).spotTint : null}
																				<div
											animate:flip={{ duration: reduceMotion ? 0 : DND_FLIP_DURATION_MS }}
											class="flex cursor-grab touch-none items-center gap-1 {spotChipFullClass('md', shadow ? 'shadow' : moved ? 'highlight' : 'muted', spot?.status ?? null)}"
											style={spotStatusStyle(spot?.status ?? null, tint) ?? undefined}
											aria-hidden={shadow ? true : undefined}
											aria-label={shadow ? undefined : spot ? `Place ${spot.number}, ${title}` : `Place ${item.id}`}
										>
											{#if shadow}
												…
											{:else}
												<CarFront class={spotChipIconClass('md')} aria-hidden="true" />
												{item.id}
											{/if}
										</div>
									{/each}
								</div>
							{/snippet}
						</SpotEndpointCard>
					</div>
				{/each}
			</div>
		{/if}

	<div class="flex flex-wrap items-center gap-2">
		{#if dirty}
			<p class="text-muted-foreground text-sm">
				{visibleMoves.length} place{visibleMoves.length > 1 ? 's' : ''} déplacée{visibleMoves.length > 1 ? 's' : ''}
			</p>
		{/if}
		<div class="ml-auto flex gap-2">
			<Button variant="outline" size="sm" disabled={!dirty || applying} onclick={reset}>Réinitialiser</Button>
			<Button
				variant="default"
				size="sm"
				disabled={!dirty || strandedFlats.length > 0 || applying}
				onclick={apply}
			>
				{applying ? 'Application…' : 'Appliquer'}
			</Button>
		</div>
	</div>
</div>
