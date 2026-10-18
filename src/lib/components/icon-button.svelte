<script lang="ts">
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import type { Component } from 'svelte';
	import { Button } from './ui/button';

	export type IconButtonTone = 'neutral' | 'success' | 'destructive';

	interface Props {
		icon: Component;
		/** Accessible label */
		label: string;
		tone?: IconButtonTone;
		disabled?: boolean;
		/** Shows a spinner instead of the icon (implies disabled) */
		loading?: boolean;
		type?: 'button' | 'submit';
		class?: string;
		onclick?: (e: MouseEvent) => void;
	}

	let {
		icon: Icon,
		label,
		tone = 'neutral',
		disabled = false,
		loading = false,
		type = 'button',
		class: className = '',
		onclick
	}: Props = $props();

	const toneClass: Record<IconButtonTone, string> = {
		neutral: 'text-muted-foreground hover:text-foreground hover:!bg-muted',
		success: 'text-success hover:text-success hover:!bg-success/10',
		destructive: 'text-destructive hover:text-destructive hover:!bg-destructive/10'
	};
</script>

<Button
	{type}
	variant="ghost"
	size="icon-sm"
	class="shrink-0 {toneClass[tone]}{className ? ` ${className}` : ''}"
	aria-label={label}
	disabled={disabled || loading}
	{onclick}
>
	{#if loading}
		<LoaderCircle class="h-3.5 w-3.5 animate-spin" />
	{:else}
		<Icon class="h-3.5 w-3.5" />
	{/if}
</Button>
