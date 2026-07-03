<script lang="ts">
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import ChartBar from '@lucide/svelte/icons/chart-bar';
	import CirclePlus from '@lucide/svelte/icons/circle-plus';
	import CircleUser from '@lucide/svelte/icons/circle-user';
	import ClipboardList from '@lucide/svelte/icons/clipboard-list';
	import LifeBuoy from '@lucide/svelte/icons/life-buoy';
	import Moon from '@lucide/svelte/icons/moon';
	import Sun from '@lucide/svelte/icons/sun';
	import { mode, toggleMode } from 'mode-watcher';
	import { page } from '$app/stores';
	import AboutDialog from '$lib/components/about-dialog.svelte';
	import Logo from '$lib/components/logo.svelte';
	import { Button } from '$lib/components/ui/button';

	let { children, data } = $props();

	const navItems = [
		{ href: '/calendar', label: 'Calendrier', icon: CalendarDays },
		{ href: '/book', label: 'Réserver', icon: CirclePlus },
		{ href: '/my-bookings', label: 'Mes réservations', icon: ClipboardList },
		{ href: '/stats', label: 'Activité', icon: ChartBar },
		{ href: '/account', label: 'Compte', icon: CircleUser }
	];
</script>

<div class="flex min-h-svh flex-col">
	<!-- En-tête -->
	<header class="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
		<div class="flex h-14 items-center justify-between px-4">
			<div class="flex items-center gap-6">
				<a href="/calendar" class="flex items-center gap-2 transition-opacity hover:opacity-80">
					<Logo class="h-7 w-7" />
					<span class="text-primary text-lg font-bold tracking-tight">Créneau</span>
				</a>

				<!-- Navigation desktop -->
				<nav class="hidden items-center gap-1 md:flex">
					{#each navItems.slice(0, 4) as item}
					<a
						href={item.href}
						class="nav-link-desktop {$page.url.pathname === item.href
							? 'nav-link-desktop-active'
							: 'nav-link-desktop-inactive'}"
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
				<AboutDialog />
				<a href="/about">
					<Button variant="ghost" size="sm" class="text-muted-foreground h-8 w-8 p-0">
						<LifeBuoy class="h-4 w-4" />
					</Button>
				</a>
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
			{#each navItems.slice(0, 4) as item}
				<a
					href={item.href}
					class="nav-link-mobile {$page.url.pathname === item.href
						? 'nav-link-mobile-active'
						: 'nav-link-mobile-inactive'}"
				>
					<item.icon class="h-5 w-5" />
					<span>{item.label}</span>
				</a>
			{/each}
		</div>
	</nav>
</div>
