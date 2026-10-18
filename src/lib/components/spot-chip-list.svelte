<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { SpotChipSize, SpotChipState } from './spot-chip.svelte';
	import SpotChip from './spot-chip.svelte';

	/**
	 * Shared spot-chip list for the flight strip: capped chips with `+N`
	 * overflow (or `…` ellipsis), an optional trailing snippet rendered
	 * after the chips (e.g. the dashed flight preview), and per-chip
	 * state via `toneOf`. Scale comes from `size`, so the strip stays
	 * compact while the mercato board reuses the same language larger.
	 */
	interface Props {
		spots: string[];
		size?: SpotChipSize;
		/** Max chips before `+N`; `null` disables capping. */
		cap?: number | null;
		/** Render `…` instead of `+N` when capped. */
		ellipsis?: boolean;
		singleLine?: boolean;
		/** Marks the wrapper for ghost-flight measurement. */
		flyDst?: boolean;
		toneOf?: (spot: string) => SpotChipState;
		/** Rendered after the chips, before the `+N` overflow. */
		trailing?: Snippet;
		class?: string;
	}

	let {
		spots,
		size = 'sm',
		cap = null,
		ellipsis = false,
		singleLine = false,
		flyDst = false,
		toneOf,
		trailing,
		class: className = ''
	}: Props = $props();

	const shown = $derived(cap == null ? spots : spots.slice(0, cap));
	const extra = $derived(cap == null ? 0 : Math.max(0, spots.length - cap));
</script>

<span
	class="flex gap-1 {singleLine
		? 'flex-nowrap overflow-hidden whitespace-nowrap'
		: 'flex-wrap'} {className}"
	aria-hidden="true"
	data-fly-dst={flyDst ? true : undefined}
>
	{#each shown as spot (spot)}
		{@const state = toneOf?.(spot) ?? { tone: 'muted' as const }}
		<SpotChip
			label={spot}
			{size}
			tone={state.tone}
			status={state.status ?? null}
			tint={state.tint ?? null}
			fly={state.fly ?? null}
			ghosted={state.ghosted ?? false}
		/>
	{/each}
	{#if trailing}
		{@render trailing()}
	{/if}
	{#if ellipsis && extra > 0}
		<SpotChip label="…" {size} tone="muted" />
	{:else if extra > 0}
		<span class="px-1 py-0.5 text-xs text-muted-foreground">+{extra}</span>
	{/if}
</span>
