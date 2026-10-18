<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		class?: string;
	}

	let { children, class: className = '' }: Props = $props();
</script>

<div class="mx-auto w-full max-w-2xl space-y-6{className ? ` ${className}` : ''}">
	{@render children()}
</div>
