<script lang="ts">
	import BookOpen from '@lucide/svelte/icons/book-open';
	import type { Snippet } from 'svelte';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';

	let { children }: { children: Snippet } = $props();

	// Guide takes the full page: no admin header/tabs below the app top bar.
	const isGuide = $derived($page.url.pathname.startsWith('/admin/guide'));

	const tabs = [
		{ href: '/admin/lots', label: 'Lots' },
		{ href: '/admin/spots', label: 'Places' },
		{ href: '/admin/bookings', label: 'Réservations' }
	];
</script>

{#if isGuide}
	{@render children()}
{:else}
<div class="space-y-8">
	<div class="flex items-center justify-between">
		<h2 class="page-title">Administration</h2>
		<a href="/admin/guide">
			<Button variant="outline" size="sm"><BookOpen class="mr-1 h-4 w-4" />Guide admin</Button>
		</a>
	</div>

	<nav aria-label="Sections d'administration" class="flex gap-6 border-b border-border">
		{#each tabs as tab}
			{@const active =
				$page.url.pathname === tab.href || ($page.url.pathname === '/admin' && tab.href === '/admin/lots')}
			<a
				href={tab.href}
				data-sveltekit-prefetch
				aria-current={active ? 'page' : undefined}
				class="relative whitespace-nowrap pb-2 text-sm font-medium transition-colors {active
					? 'text-foreground'
					: 'text-muted-foreground hover:text-foreground'}"
			>
				{tab.label}
				{#if active}
					<span class="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" aria-hidden="true"></span>
				{/if}
			</a>
		{/each}
	</nav>

	{@render children()}
</div>
{/if}
