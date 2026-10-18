<script lang="ts">
	import { DAY_END, DAY_START } from '$lib/types';
	import { padH } from '$lib/utils/time';

	interface Props {
		startHour: number;
		endHour: number;
		validStartHours: number[];
		validEndHours: number[];
		onStart: (h: number) => void;
		onEnd: (h: number) => void;
		/** Group label for screen readers (two instances co-exist in multi-day) */
		label?: string;
		/** Bump to glide the lists to the selection (preset taps, date-driven
			resets). List taps and mount never glide — nothing moves unasked. */
		glideSignal?: number;
		/** First glide positions instantly (dialog arrival) instead of smooth. */
		instantFirstGlide?: boolean;
	}

	let {
		startHour,
		endHour,
		validStartHours,
		validEndHours,
		onStart,
		onEnd,
		label = "Choisir l'horaire",
		glideSignal = 0,
		instantFirstGlide = false
	}: Props = $props();

	const hours = Array.from({ length: DAY_END - DAY_START + 1 }, (_, i) => DAY_START + i);

	function formatHour(h: number): string {
		return `${padH(h)}:00`;
	}

	let startListEl = $state<HTMLElement | null>(null);
	let endListEl = $state<HTMLElement | null>(null);

	function glideListToSelected(listEl: HTMLElement | null, kind: 'start' | 'end', instant: boolean) {
		const selected = listEl?.querySelector(`[data-selected="${kind}"]`);
		if (!listEl || !(selected instanceof HTMLElement)) return;
		const listRect = listEl.getBoundingClientRect();
		const elRect = selected.getBoundingClientRect();
		const delta = elRect.top - listRect.top - listEl.clientHeight / 2 + selected.clientHeight / 2;
		listEl.scrollBy({ top: delta, behavior: instant ? 'auto' : 'smooth' });
	}

	function scrollSelectionIntoView(instant: boolean) {
		glideListToSelected(startListEl, 'start', instant);
		glideListToSelected(endListEl, 'end', instant);
	}

	let glidedOnce = false;

	// Signal bumps only (presets, date-driven resets): the bump flushes
	// post-DOM, so markers exist. Container-local — the page never moves.
	$effect(() => {
		glideSignal;
		startListEl;
		endListEl;
		if (glideSignal <= 0) return;
		const instant = instantFirstGlide && !glidedOnce;
		glidedOnce = true;
		scrollSelectionIntoView(instant);
	});
</script>

<div class="grid grid-cols-2 gap-2" role="group" aria-label={label}>
	<div bind:this={startListEl} class="max-h-28 space-y-0.5 overflow-y-auto">
		{#each hours as h}
			{@const startValid = validStartHours.includes(h)}
			{@const isStart = h === startHour}
			<button
				type="button"
				data-selected={isStart ? 'start' : undefined}
				disabled={!startValid}
				aria-label={startValid ? `Début à ${formatHour(h)}` : `${formatHour(h)}, réservé`}
				onclick={() => onStart(h)}
				class="w-full rounded-full px-3 py-1.5 text-left text-sm transition-colors {isStart
					? 'bg-primary/15 font-semibold text-primary'
					: startValid
						? 'hover:bg-muted'
						: 'opacity-40'}"
			>
				{formatHour(h)}
			</button>
		{/each}
	</div>
	<div bind:this={endListEl} class="max-h-28 space-y-0.5 overflow-y-auto">
		{#each hours as h}
			{@const endValid = validEndHours.includes(h)}
			{@const isEnd = h === endHour}
			<button
				type="button"
				data-selected={isEnd ? 'end' : undefined}
				disabled={!endValid}
				aria-label={endValid ? `Fin à ${formatHour(h)}` : `${formatHour(h)}, conflit`}
				onclick={() => onEnd(h)}
				class="w-full rounded-full px-3 py-1.5 text-right text-sm transition-colors {isEnd
					? 'bg-primary/15 font-semibold text-primary'
					: endValid
						? 'hover:bg-muted'
						: 'opacity-40'}"
			>
				{formatHour(h)}
			</button>
		{/each}
	</div>
</div>
