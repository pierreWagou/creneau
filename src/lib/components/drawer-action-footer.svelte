<script lang="ts">
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import type { Component } from 'svelte';
	import { Button } from '$lib/components/ui/button';

	export type DrawerActionTone = 'primary' | 'secondary' | 'success' | 'destructive';

	export interface DrawerAction {
		label: string;
		icon: Component;
		tone: DrawerActionTone;
		onclick: () => void;
		disabled?: boolean;
		/** Swaps the icon for a spinner and disables the button */
		loading?: boolean;
		ariaLabel?: string;
	}

	let { actions }: { actions: DrawerAction[] } = $props();

	const toneProps: Record<DrawerActionTone, { variant: 'default' | 'outline'; class: string }> = {
		primary: { variant: 'default', class: '' },
		secondary: { variant: 'outline', class: '' },
		success: { variant: 'default', class: 'bg-success on-solid hover:bg-success/80' },
		destructive: {
			variant: 'default',
			class: 'bg-destructive on-solid hover:bg-destructive/80'
		}
	};
</script>

<div class="mt-auto pt-1">
	<div class="flex gap-2">
		{#each actions as action (action.label)}
			{@const Icon = action.icon}
			<Button
				variant={toneProps[action.tone].variant}
				class="flex-1 {toneProps[action.tone].class}"
				aria-label={action.ariaLabel ?? action.label}
				onclick={action.onclick}
				disabled={action.disabled || action.loading}
			>
				{#if action.loading}
					<LoaderCircle class="h-4 w-4 mr-2 animate-spin" />
				{:else}
					<Icon class="h-4 w-4 mr-2" />
				{/if}
				<span class="truncate">{action.label}</span>
			</Button>
		{/each}
	</div>
</div>
