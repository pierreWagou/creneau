<script lang="ts">
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import ChartBar from '@lucide/svelte/icons/chart-bar';
	import CirclePlus from '@lucide/svelte/icons/circle-plus';
	import CircleUser from '@lucide/svelte/icons/circle-user';
	import ClipboardList from '@lucide/svelte/icons/clipboard-list';
	import { page } from '$app/stores';
	import SiteToolbar from '$lib/components/site-toolbar.svelte';

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
	<SiteToolbar flat={data.flat} />

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
