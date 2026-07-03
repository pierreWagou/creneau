<script lang="ts">
	import LifeBuoy from '@lucide/svelte/icons/life-buoy';
	import Moon from '@lucide/svelte/icons/moon';
	import Sun from '@lucide/svelte/icons/sun';
	import { mode, toggleMode } from 'mode-watcher';
	import AboutDialog from '$lib/components/about-dialog.svelte';
	import Logo from '$lib/components/logo.svelte';
	import { Button } from '$lib/components/ui/button';

	let { children } = $props();
</script>

<div class="flex min-h-svh flex-col">
	<!-- En-tête -->
	<header class="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
		<div class="flex h-14 items-center justify-between px-4">
			<a href="/login" class="flex items-center gap-2 transition-opacity hover:opacity-80">
				<Logo class="h-7 w-7" />
				<span class="text-primary text-lg font-bold tracking-tight">Créneau</span>
			</a>

			<div class="flex items-center gap-1">
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
				<a href="/about">
					<Button variant="ghost" size="sm" class="text-muted-foreground h-8 w-8 p-0">
						<LifeBuoy class="h-4 w-4" />
					</Button>
				</a>
			</div>
		</div>
	</header>

	<!-- Contenu principal -->
	<main class="flex flex-1 items-center justify-center p-4">
		{@render children()}
	</main>
</div>
