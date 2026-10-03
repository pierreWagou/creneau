<script lang="ts">
	interface Props {
		createdAt?: string | null;
		activatedAt?: string | null;
		createdLabel?: string;
		/** Explicit null hides the pending line (for entities without activation, e.g. spots) */
		pendingLabel?: string | null;
	}

	let {
		createdAt,
		activatedAt,
		createdLabel = 'Lot créé',
		pendingLabel = 'Pas encore activé'
	}: Props = $props();

	function formatDateTime(iso: string): string {
		const d = new Date(iso);
		return `${d.toLocaleDateString('fr-FR')} • ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
	}
</script>

<div>
	<div class="rounded-xl border border-border p-4">
		<div class="relative pl-6">
			<div class="absolute left-[5px] top-2 bottom-2 w-px bg-border"></div>
			{#if createdAt}
				<div class="relative pb-4 last:pb-0">
					<span class="absolute -left-6 top-1 h-2.5 w-2.5 rounded-full bg-info ring-4 ring-popover"></span>
					<p class="text-xs text-muted-foreground">{formatDateTime(createdAt)}</p>
					<p class="text-sm font-semibold mt-0.5">{createdLabel}</p>
				</div>
			{/if}
			{#if activatedAt}
				<div class="relative pb-4 last:pb-0">
					<span class="absolute -left-6 top-1 h-2.5 w-2.5 rounded-full bg-success ring-4 ring-popover"></span>
					<p class="text-xs text-muted-foreground">{formatDateTime(activatedAt)}</p>
					<p class="text-sm font-semibold mt-0.5">Compte activé</p>
				</div>
			{:else if pendingLabel}
				<div class="relative pb-4 last:pb-0">
					<span class="absolute -left-6 top-1 h-2.5 w-2.5 rounded-full bg-muted-foreground ring-4 ring-popover"></span>
					<p class="text-sm text-muted-foreground mt-0.5">{pendingLabel}</p>
				</div>
			{/if}
		</div>
	</div>
</div>
