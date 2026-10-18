<script lang="ts">
	import CalendarCheck from '@lucide/svelte/icons/calendar-check';
	import CalendarClock from '@lucide/svelte/icons/calendar-clock';
	import Hourglass from '@lucide/svelte/icons/hourglass';
	import Timer from '@lucide/svelte/icons/timer';
	import { format, parseISO } from 'date-fns';
	import { fr } from 'date-fns/locale';
	import type { Snippet } from 'svelte';
	import { countdownLabel, formatBookingEndFr, formatDuration } from '$lib/utils/time';

	/**
	 * Booking slot as a vertical icon timeline: start → duration → end,
	 * with the live countdown as footer. Same card language as
	 * FlatLifecycleCard (bordered card, dotted spine) but booking-specific
	 * rows (duration has no date) live here instead of stretching that card.
	 */
	interface Props {
		startTime: string;
		endTime: string;
		/** Optional action pinned to the card's bottom-right corner (e.g. .ics download) */
		corner?: Snippet;
	}

	let { startTime, endTime, corner }: Props = $props();
	const countdown = $derived(countdownLabel(startTime, endTime));

	function formatSlotDateTime(iso: string): string {
		return format(parseISO(iso), "EEEE d MMMM, HH'h'mm", { locale: fr });
	}
</script>

<div>
	<div class="relative rounded-xl border border-border p-4">
		{#if corner}
			<div class="absolute right-3 bottom-3">
				{@render corner()}
			</div>
		{/if}
		<div class="relative">
			<div class="absolute left-[13px] top-4 bottom-4 w-px border-l border-dashed border-border"></div>
			<div class="relative flex min-h-7 items-center gap-3 pb-5 last:pb-0">
				<span
					class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-info/15 text-info ring-4 ring-popover"
				>
					<CalendarClock class="h-3.5 w-3.5" />
				</span>
				<p class="text-sm font-semibold capitalize">{formatSlotDateTime(startTime)}</p>
			</div>
			<div class="relative flex min-h-7 items-center gap-3 pb-5 last:pb-0">
				<span
					class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground ring-4 ring-popover"
				>
					<Hourglass class="h-3.5 w-3.5" />
				</span>
				<p class="text-sm font-semibold">{formatDuration(startTime, endTime)}</p>
			</div>
			<div class="relative flex min-h-7 items-center gap-3 pb-5 last:pb-0">
				<span
					class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground ring-4 ring-popover"
				>
					<CalendarCheck class="h-3.5 w-3.5" />
				</span>
				<p class="text-sm font-semibold capitalize">{formatBookingEndFr(endTime, 'long')}</p>
			</div>
		</div>
		{#if countdown}
			<p class="mt-3">
				<span
					class="pill-chip border-primary/30 bg-primary/10 text-primary {corner ? 'mr-10' : ''}"
				>
					<Timer class="h-3.5 w-3.5 shrink-0" />
					{countdown}
				</span>
			</p>
		{/if}
	</div>
</div>
