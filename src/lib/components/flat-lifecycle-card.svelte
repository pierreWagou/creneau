<script lang="ts">
	import { formatDateTimeFr } from '$lib/utils/time';

	interface Props {
		createdAt?: string | null;
		activatedAt?: string | null;
		createdLabel?: string;
		/** Overrides the default "Compte activé" milestone label (e.g. bookings). */
		activatedLabel?: string;
		/** Optional third milestone (e.g. booking end). Absent = not rendered. */
		endedAt?: string | null;
		endedLabel?: string;
		/** Explicit null hides the pending line (for entities without activation, e.g. spots) */
		pendingLabel?: string | null;
	}

	let {
		createdAt,
		activatedAt,
		createdLabel = 'Lot créé',
		activatedLabel = 'Compte activé',
		endedAt,
		endedLabel = 'Fin',
		pendingLabel = 'Pas encore activé'
	}: Props = $props();
</script>

<div>
	<div class="rounded-xl border border-border p-4">
		<div class="relative pl-6">
			<div class="absolute left-[5px] top-2 bottom-2 w-px bg-border"></div>
			{#if createdAt}
				<div class="relative pb-4 last:pb-0">
					<span class="absolute -left-6 top-1 h-2.5 w-2.5 rounded-full bg-info ring-4 ring-popover"></span>
					<p class="text-sm text-muted-foreground">{formatDateTimeFr(createdAt)}</p>
					<p class="text-sm font-semibold mt-0.5">{createdLabel}</p>
				</div>
			{/if}
			{#if activatedAt}
				<div class="relative pb-4 last:pb-0">
					<span class="absolute -left-6 top-1 h-2.5 w-2.5 rounded-full bg-success ring-4 ring-popover"></span>
					<p class="text-sm text-muted-foreground">{formatDateTimeFr(activatedAt)}</p>
					<p class="text-sm font-semibold mt-0.5">{activatedLabel}</p>
				</div>
			{:else if pendingLabel}
				<div class="relative pb-4 last:pb-0">
					<span class="absolute -left-6 top-1 h-2.5 w-2.5 rounded-full bg-muted-foreground ring-4 ring-popover"></span>
					<p class="text-sm text-muted-foreground mt-0.5">{pendingLabel}</p>
				</div>
			{/if}
			{#if endedAt}
				<div class="relative pb-4 last:pb-0">
					<span class="absolute -left-6 top-1 h-2.5 w-2.5 rounded-full bg-muted-foreground ring-4 ring-popover"></span>
					<p class="text-sm text-muted-foreground">{formatDateTimeFr(endedAt)}</p>
					<p class="text-sm font-semibold mt-0.5">{endedLabel}</p>
				</div>
			{/if}
		</div>
	</div>
</div>
