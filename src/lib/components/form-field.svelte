<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		for?: string;
		required?: boolean;
		error?: string | null;
		hint?: string | null;
		children: Snippet;
	}

	let { label, for: forId, required = false, error = null, hint = null, children }: Props = $props();
</script>

<div>
	<p class="dialog-section-label mb-2">
		<label for={forId}>
			{label}
			{#if required}<span class="text-destructive">*</span>{/if}
		</label>
	</p>
	{@render children()}
	{#if error}
		<p class="text-destructive text-xs mt-1.5">{error}</p>
	{:else if hint}
		<p class="text-muted-foreground text-xs mt-1.5">{hint}</p>
	{/if}
</div>
