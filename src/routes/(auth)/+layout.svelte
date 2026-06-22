<script lang="ts">
	import Moon from '@lucide/svelte/icons/moon';
	import Sun from '@lucide/svelte/icons/sun';
	import { mode, toggleMode } from 'mode-watcher';
	import AboutDialog from '$lib/components/about-dialog.svelte';
	import Logo from '$lib/components/logo.svelte';
	import { Button } from '$lib/components/ui/button';

	let { children } = $props();
</script>

<div class="bg-muted/50 relative flex min-h-svh items-center justify-center p-4">
	<!-- Top-left: Créneau logo -->
	<a
		href="/login"
		class="text-primary absolute top-4 left-4 flex items-center gap-2 text-lg font-bold tracking-tight transition-colors hover:opacity-80"
	>
		<Logo class="h-6 w-6" />
		Créneau
	</a>

	<!-- Top-right: dark-mode toggle + about -->
	<div class="absolute top-4 right-4 flex items-center gap-1">
		<Button
			variant="ghost"
			size="sm"
			onclick={toggleMode}
			class="text-muted-foreground h-8 w-8 p-0"
		>
			{#if mode.current === 'dark'}
				<Sun class="h-4 w-4" />
			{:else}
				<Moon class="h-4 w-4" />
			{/if}
		</Button>
		<AboutDialog />
	</div>

	<div class="w-full max-w-sm">
		{@render children()}
	</div>
</div>
