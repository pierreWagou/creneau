<script lang="ts">
	import Moon from '@lucide/svelte/icons/moon';
	import Sun from '@lucide/svelte/icons/sun';
	import { mode, toggleMode } from 'mode-watcher';
	import { Button } from '$lib/components/ui/button';

	let { children } = $props();
</script>

<div class="bg-muted/50 relative flex min-h-svh items-center justify-center p-4">
	<Button
		variant="ghost"
		size="sm"
		onclick={toggleMode}
		class="text-muted-foreground absolute top-4 right-4 h-8 w-8 p-0"
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
