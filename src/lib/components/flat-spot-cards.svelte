<script lang="ts">
	import CarFront from '@lucide/svelte/icons/car-front';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import * as Popover from '$lib/components/ui/popover';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { formatSpotNumber, isValidSpotNumber } from '$lib/constants';
	import type { DescribedSpotConflict } from '$lib/utils/spots';
	import InlineEditField from './inline-edit-field.svelte';
	import SpotPicker, { type SpotDirectory } from './spot-picker.svelte';

	interface Props {
		spots?: string[];
		descriptions?: Record<string, string | null>;
		editable?: boolean;
		/** Minimum items kept when removing (edit modes: 1, create draft: 0) */
		minItems?: number;
		onChange?: (spots: string[]) => void;
		/** `cards`: mini-cards grid · `chips`: compact 4-col grid, tap calls `onSelect` */
		variant?: 'cards' | 'chips';
		onSelect?: (number: string) => void;
		/** Chips branch: render a dashed plus-chip cell that calls `onAdd` */
		onAdd?: () => void;
		/** Chips branch: optional subtext per spot (e.g. holder lot) */
		subtexts?: Record<string, string | null>;
		/** Chips branch: lifecycle status per spot (accent bar + data-status; absent = neutral) */
		statuses?: Record<string, 'shared' | 'assigned' | 'unassigned'>;
		/** Conflicting spots get a corner warning badge + tooltip (no layout change otherwise) */
		conflicts?: DescribedSpotConflict[];
		/** Mask holder flat numbers in conflict badges/tooltips (public pages) */
		maskHolder?: boolean;
		/** Directory enabling the constrained picker (omitted = legacy free typing) */
		spotDirectory?: SpotDirectory | null;
	}

	let {
		spots = $bindable([]),
		descriptions = {},
		editable = true,
		minItems = 0,
		onChange,
		variant = 'cards',
		onSelect,
		onAdd,
		subtexts = {},
		statuses = {},
		conflicts = [],
		maskHolder = false,
		spotDirectory = null
	}: Props = $props();

	function conflictFor(spotNum: string): DescribedSpotConflict | undefined {
		return conflicts.find((c) => c.spotNumber === spotNum);
	}

	function conflictTip(c: DescribedSpotConflict): string {
		if (c.kind === 'shared-pool') return 'Place partagée — la demander la retire du pool commun';
		if (maskHolder) return "Déjà attribuée — l'administrateur arbitrera";
		return c.blocked
			? `Déjà attribuée à ${c.currentFlat} — réaffectation impossible (${c.currentFlat} n'aurait plus de place)`
			: `Déjà attribuée à ${c.currentFlat}`;
	}

	function conflictLabel(c: DescribedSpotConflict): string {
		if (c.kind === 'shared-pool') return 'Conflit : place partagée — sortie du pool à confirmer';
		if (maskHolder) return 'Conflit : déjà attribuée — réaffectation à confirmer';
		return c.blocked ? `Conflit : attribuée à ${c.currentFlat} — réaffectation impossible` : `Conflit : attribuée à ${c.currentFlat}`;
	}

	let pickerOpen = $state(false);
	let draft = $state('');

	const draftValid = $derived(draft.length > 0 && isValidSpotNumber(draft));

	function cancel() {
		pickerOpen = false;
		draft = '';
	}

	function commit() {
		if (!draftValid) return;
		selectNumber(formatSpotNumber(draft.trim()));
	}

	function selectNumber(formatted: string) {
		if (spots.includes(formatted)) {
			cancel();
			return;
		}
		const next = [...spots, formatted];
		cancel();
		// Uncontrolled (create) mode: write through the bindable so parent drafts stay
		// in sync. Controlled (view) mode: parent owns the write via onChange.
		if (onChange) onChange(next);
		else spots = next;
	}

	function remove(index: number) {
		if (spots.length <= minItems) return;
		const next = spots.filter((_, i) => i !== index);
		if (onChange) onChange(next);
		else spots = next;
	}
</script>

<div>
	{#if variant === 'chips'}
		{#if spots.length > 0 || onAdd}
			<div class="grid grid-cols-4 gap-2">
				{#each spots as spotNum}
					{@const subtext = subtexts[spotNum]}
					{@const chipStatus = statuses[spotNum]}
					{@const pillLabel = subtext ?? (chipStatus === 'shared' ? 'Partagée' : chipStatus === 'unassigned' ? 'En attente' : null)}
					{@const pillClass = subtext
						? 'bg-muted-foreground text-[#1e1e2e]'
						: chipStatus === 'shared'
							? 'bg-primary text-white dark:text-[#1e1e2e]'
							: 'bg-warning text-[#1e1e2e]'}
					<button
						type="button"
						onclick={() => onSelect?.(spotNum)}
						aria-label={subtext ? `Voir la place ${spotNum} (lot ${subtext})` : `Voir la place ${spotNum}`}
						data-status={chipStatus}
						class="rounded-lg border border-border min-h-16 px-3 flex flex-col items-center justify-center gap-0.5 transition-colors hover:border-foreground/30 hover:bg-muted/50"
					>
						<span class="flex items-center gap-2">
							<CarFront class="h-4 w-4 shrink-0 text-muted-foreground" />
							<span class="text-base font-semibold truncate">{spotNum}</span>
						</span>
						{#if pillLabel}
							<span class="rounded-full px-2 py-px text-[11px] font-medium truncate {pillClass}">{pillLabel}</span>
						{/if}
					</button>
				{/each}
				{#if onAdd}
					<button
						type="button"
						onclick={onAdd}
						aria-label="Ajouter une place"
						class="text-muted-foreground hover:text-foreground rounded-lg border border-dashed border-border min-h-16 px-3 flex flex-col items-center justify-center gap-0.5 transition-colors hover:border-foreground/30"
					>
						<Plus class="h-4 w-4 shrink-0" />
						<span class="text-sm font-semibold">Ajouter</span>
					</button>
				{/if}
			</div>
		{:else if !editable}
			<p class="text-sm text-muted-foreground">Aucune place assignée</p>
		{/if}
	{:else if spots.length > 0 || editable}
		<div class="grid grid-cols-2 gap-2">
			{#each spots as spotNum, i}
					{@const cardConflict = conflictFor(spotNum)}
					{#snippet cardBody()}
						{#if cardConflict}
							<span class="sr-only">{conflictLabel(cardConflict)}</span>
						{/if}
						{#if cardConflict || (editable && spots.length > minItems)}
							<div class="absolute top-1 right-1 flex items-center gap-0.5">
								{#if cardConflict}
									<span class="p-1 text-warning" aria-hidden="true">
										<TriangleAlert class="h-3 w-3" />
									</span>
								{/if}
								{#if editable && spots.length > minItems}
									<button
										type="button"
										class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
										aria-label="Supprimer la place {spotNum}"
										onclick={() => remove(i)}
									>
										<Trash2 class="h-3 w-3" />
									</button>
								{/if}
							</div>
						{/if}
						<div class="flex items-center justify-center gap-2">
							<CarFront class="h-5 w-5 shrink-0 {cardConflict ? 'text-warning' : 'text-muted-foreground'}" />
							<p class="text-2xl font-semibold {cardConflict ? 'text-warning' : ''}">{spotNum}</p>
						</div>
						{#if descriptions[spotNum]}
							<p class="text-xs text-muted-foreground truncate max-w-full mt-0.5">{descriptions[spotNum]}</p>
						{/if}
					{/snippet}
					{#if cardConflict}
						<Tooltip.Provider>
							<Tooltip.Root>
								<Tooltip.Trigger>
									{#snippet child({ props })}
										<div
											{...props}
											class="rounded-lg border border-warning/40 bg-warning/10 p-3 text-center relative min-h-[88px] flex flex-col items-center justify-center"
										>
											{@render cardBody()}
										</div>
									{/snippet}
								</Tooltip.Trigger>
								<Tooltip.Content>
									<p class="text-xs">{conflictTip(cardConflict)}</p>
								</Tooltip.Content>
							</Tooltip.Root>
						</Tooltip.Provider>
					{:else}
						<div
							class="rounded-lg border border-border p-3 text-center relative min-h-[88px] flex flex-col items-center justify-center"
						>
							{@render cardBody()}
						</div>
					{/if}
			{/each}
			{#if editable}
				<Popover.Root bind:open={pickerOpen} onOpenChange={(o) => { if (!o) draft = ''; }}>
					<Popover.Trigger
						aria-label="Ajouter une place"
						class="text-muted-foreground hover:text-foreground flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border transition-colors hover:border-foreground/30"
					>
						<Plus class="h-4 w-4" />
						<span class="text-xs">Ajouter</span>
					</Popover.Trigger>
					<Popover.Content>
						{#if spotDirectory}
							<SpotPicker
								allSpots={spotDirectory.all}
								selected={spots}
								maskHolder={spotDirectory.maskHolder ?? maskHolder}
								onSelect={selectNumber}
								onCancel={cancel}
							/>
						{:else}
							<div class="flex items-center gap-1">
								<InlineEditField
									bind:value={draft}
									placeholder="ex. 01"
									ariaLabel="Numéro de place"
									inputClass="text-center"
									error={draft.length > 0 && !draftValid ? 'Format requis : 1 ou 2 chiffres (ex. 3, 01, 36)' : null}
									errorDisplay="tooltip"
									committable={draftValid}
									autofocus={pickerOpen}
									onCommit={commit}
									onCancel={cancel}
								/>
							</div>
						{/if}
					</Popover.Content>
				</Popover.Root>
			{/if}
		</div>
	{:else if !editable}
		<p class="text-sm text-muted-foreground">Aucune place assignée</p>
	{/if}
</div>
