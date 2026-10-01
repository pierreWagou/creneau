<script lang="ts">
	import BookOpen from '@lucide/svelte/icons/book-open';
	import type { Snippet } from 'svelte';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';

	let { children }: { children: Snippet } = $props();

	const tabs = [
		{ href: '/admin/lots', label: 'Lots' },
		{ href: '/admin/spots', label: 'Places' }
	];
</script>

<div class="space-y-8">
	<div class="flex items-center justify-between">
		<h2 class="page-title">Administration</h2>
		<a href="/admin/guide">
			<Button variant="outline" size="sm"><BookOpen class="mr-1 h-4 w-4" />Guide admin</Button>
		</a>
	</div>

	<nav aria-label="Sections d'administration" class="flex gap-1 rounded-lg bg-muted p-[3px]">
		{#each tabs as tab}
			{@const active =
				$page.url.pathname === tab.href || ($page.url.pathname === '/admin' && tab.href === '/admin/lots')}
			<a
				href={tab.href}
				data-sveltekit-prefetch
				aria-current={active ? 'page' : undefined}
				class="h-8 flex-1 inline-flex items-center justify-center rounded-md px-1.5 text-sm font-medium whitespace-nowrap transition-all {active
					? 'bg-primary text-white dark:text-[#1e1e2e] shadow-sm'
					: 'text-foreground/60 hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground'}"
			>
				{tab.label}
			</a>
		{/each}
	</nav>

	{@render children()}
</div>
