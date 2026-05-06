<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { toggleMode, mode } from 'mode-watcher';
	import Sun from '@lucide/svelte/icons/sun';
	import Moon from '@lucide/svelte/icons/moon';

	let { children } = $props();
</script>

<div class="relative flex min-h-svh items-center justify-center bg-muted/50 p-4">
	<Button
		variant="ghost"
		size="sm"
		onclick={toggleMode}
		class="absolute top-4 right-4 text-muted-foreground h-8 w-8 p-0"
	>
		{#if mode.current === 'dark'}
			<Sun class="h-4 w-4" />
		{:else}
			<Moon class="h-4 w-4" />
		{/if}
	</Button>
	<div class="w-full max-w-sm">
		{@render children()}
	</div>
</div>
