<script lang="ts">
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';
	import type { Snippet } from 'svelte';
	import { Button } from '$lib/components/ui/button';

	/**
	 * Unified search field: magnifier icon left, caller-rendered input,
	 * clear (X) button right once there is text. Works with plain `Input`
	 * and `Combobox.Input` alike — the input stays caller-rendered (give
	 * it `pl-8 pr-8` so text clears both icons).
	 */
	interface Props {
		/** Current text; drives clear-button visibility. */
		value: string;
		onClear: () => void;
		clearLabel?: string;
		class?: string;
		children: Snippet;
	}

	let {
		value,
		onClear,
		clearLabel = 'Effacer la recherche',
		class: className = '',
		children
	}: Props = $props();
</script>

<div class="relative {className}">
	<Search
		class="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2"
		aria-hidden="true"
	/>
	{@render children()}
	{#if value.trim() !== ''}
		<Button
			type="button"
			variant="ghost"
			size="icon-sm"
			class="absolute top-1/2 right-1 size-6 -translate-y-1/2"
			aria-label={clearLabel}
			onclick={onClear}
		>
			<X class="h-3.5 w-3.5" />
		</Button>
	{/if}
</div>
