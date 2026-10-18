<script lang="ts">
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import type { Snippet } from 'svelte';
	import { Button, type ButtonSize, type ButtonVariant } from './ui/button';

	interface Props {
		loading?: boolean;
		/** Label shown while loading (children when idle). Omit to keep children + spinner. */
		loadingLabel?: string | null;
		variant?: ButtonVariant;
		size?: ButtonSize;
		disabled?: boolean;
		type?: 'button' | 'submit';
		class?: string;
		/** Accessible name override (defaults to content text). */
		ariaLabel?: string | null;
		onclick?: (e: MouseEvent) => void;
		children: Snippet;
	}

	let {
		loading = false,
		loadingLabel = null,
		variant = 'default',
		size,
		disabled = false,
		type = 'button',
		class: className = '',
		ariaLabel = null,
		onclick,
		children
	}: Props = $props();
</script>

<Button {type} {variant} {size} class={className} disabled={disabled || loading} aria-label={ariaLabel} {onclick}>
	{#if loading}
		<LoaderCircle class="h-4 w-4 animate-spin" />
		{#if loadingLabel}{loadingLabel}{:else}{@render children()}{/if}
	{:else}
		{@render children()}
	{/if}
</Button>
