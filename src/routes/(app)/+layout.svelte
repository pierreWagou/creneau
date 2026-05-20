<script lang="ts">
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import CirclePlus from '@lucide/svelte/icons/circle-plus';
	import CircleUser from '@lucide/svelte/icons/circle-user';
	import ClipboardList from '@lucide/svelte/icons/clipboard-list';
	import Moon from '@lucide/svelte/icons/moon';
	import Sun from '@lucide/svelte/icons/sun';
	import { mode, toggleMode } from 'mode-watcher';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';

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
	<header class="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
		<div class="flex h-14 items-center justify-between px-4">
			<div class="flex items-center gap-6">
				<a href="/calendar" class="text-primary text-lg font-bold tracking-tight transition-opacity hover:opacity-80">
					Créneau
				</a>

				<!-- Navigation desktop -->
				<nav class="hidden items-center gap-1 md:flex">
					{#each navItems.slice(0, 3) as item}
						<a
							href={item.href}
							class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors {$page
								.url.pathname === item.href
								? 'bg-primary/10 text-primary'
								: 'text-muted-foreground hover:text-foreground'}"
						>
							<item.icon class="h-4 w-4" />
							<span>{item.label}</span>
						</a>
					{/each}
				</nav>
			</div>

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
					<Button variant="ghost" size="sm" class="text-foreground gap-1.5 font-semibold">
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
	<nav
		class="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-0 z-40 border-t backdrop-blur md:hidden"
	>
		<div class="flex items-center justify-around py-2">
			{#each navItems as item}
				<a
					href={item.href}
					class="flex flex-col items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors {$page.url
						.pathname === item.href
						? 'text-primary'
						: 'text-muted-foreground'}"
				>
					<item.icon class="h-5 w-5" />
					<span>{item.label}</span>
				</a>
			{/each}
		</div>
	</nav>
</div>
