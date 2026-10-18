<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Uppercase section heading (e.g. "Informations", "Lot", "Cycle de vie") */
		title: string;
		children: Snippet;
	}

	let { title, children }: Props = $props();
</script>

<div class="mt-4">
	<p class="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{title}</p>
	{@render children()}
</div>
