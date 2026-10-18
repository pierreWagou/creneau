<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		/** Appended to the frame (rare exceptions only — default stays the standard) */
		class?: string;
		/** When set, renders an anchor instead of a div (card-as-link pattern) */
		href?: string | null;
	}

	let { children, class: className = '', href = null }: Props = $props();
</script>

{#if href}
	<a {href} class="rounded-xl border border-border p-4 {className}">
		{@render children()}
	</a>
{:else}
	<div class="rounded-xl border border-border p-4 {className}">
		{@render children()}
	</div>
{/if}

