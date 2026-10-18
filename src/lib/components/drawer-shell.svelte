<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Drawer from '$lib/components/ui/drawer';
	import { createIsDesktop } from '$lib/utils/is-desktop.svelte';

	interface Props {
		open: boolean;
		/** Page-specific close/reset logic, wired to Vaul's onOpenChange */
		onClose?: (open: boolean) => void;
		/** Bound content element (e.g. lots iOS keyboard geometry effect) */
		contentEl?: HTMLElement | null;
		children: Snippet;
		footer?: Snippet;
	}

	let {
		open = $bindable(),
		onClose,
		contentEl = $bindable(null),
		children,
		footer
	}: Props = $props();

	const desktop = createIsDesktop();
</script>

<Drawer.Root bind:open direction={desktop.value ? 'right' : 'bottom'} onOpenChange={onClose}>
	<Drawer.Content
		bind:ref={contentEl}
		class="flex flex-col overflow-hidden overflow-clip data-[vaul-drawer-direction=bottom]:max-h-[92svh] sm:max-w-xl"
	>
		<div
			class="flex flex-1 flex-col min-h-0 overflow-y-auto overscroll-none px-6 pt-6 pb-6"
			data-vaul-no-drag
		>
			{@render children()}
			{#if footer}
				{@render footer()}
			{/if}
		</div>
	</Drawer.Content>
</Drawer.Root>
