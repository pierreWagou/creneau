<script lang="ts">
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import { toggleMode, mode } from 'mode-watcher';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import CirclePlus from '@lucide/svelte/icons/circle-plus';
	import ClipboardList from '@lucide/svelte/icons/clipboard-list';
	import CircleUser from '@lucide/svelte/icons/circle-user';
	import Sun from '@lucide/svelte/icons/sun';
	import Moon from '@lucide/svelte/icons/moon';

	let { children, data } = $props();

	const navItems = [
		{ href: '/calendar', label: 'Calendrier', icon: CalendarDays },
		{ href: '/book', label: 'Réserver', icon: CirclePlus },
		{ href: '/my-bookings', label: 'Mes réservations', icon: ClipboardList },
		{ href: '/account', label: 'Compte', icon: CircleUser }
	];
</script>

<div class="flex min-h-svh flex-col">
	<!-- En-tête -->
	<header class="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
		<div class="flex h-14 items-center justify-between px-4">
			<a href="/calendar" class="text-lg font-bold tracking-tight text-primary hover:opacity-80 transition-opacity">
				Créneau
			</a>
			<div class="flex items-center gap-1">
				{#if data.flat.isAdmin}
					<a href="/admin">
						<Button variant="ghost" size="sm">Admin</Button>
					</a>
				{/if}
				<Button variant="ghost" size="sm" onclick={toggleMode} class="text-muted-foreground h-8 w-8 p-0">
					{#if mode.current === 'dark'}
						<Sun class="h-4 w-4" />
					{:else}
						<Moon class="h-4 w-4" />
					{/if}
				</Button>
				<a href="/account">
					<Button variant="ghost" size="sm" class="gap-1.5 font-semibold text-foreground">
						<CircleUser class="h-4 w-4" />
						<span class="hidden sm:inline">{data.flat.displayName || data.flat.number}</span>
					</Button>
				</a>
			</div>
		</div>
	</header>

	<!-- Contenu principal -->
	<main class="flex-1 p-4">
		{@render children()}
	</main>

	<!-- Navigation mobile -->
	<nav class="sticky bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
		<div class="flex items-center justify-around py-2">
			{#each navItems as item}
				<a
					href={item.href}
					class="flex flex-col items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors {$page.url.pathname === item.href ? 'text-primary' : 'text-muted-foreground'}"
				>
					<item.icon class="h-5 w-5" />
					<span>{item.label}</span>
				</a>
			{/each}
		</div>
	</nav>
</div>
