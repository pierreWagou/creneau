<script lang="ts">
	import BookOpen from '@lucide/svelte/icons/book-open';
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
	import type { SessionFlat } from '$lib/types';
	import AboutDialog from './about-dialog.svelte';
	import Logo from './logo.svelte';
	import { Button } from './ui/button';

	interface Props {
		/** Null for guests: minimal bar (logo + theme + about), no nav. Set: full classic toolbar. */
		flat: SessionFlat | null;
	}

	let { flat }: Props = $props();

	const navItems = [
		{ href: '/calendar', label: 'Calendrier', icon: CalendarDays },
		{ href: '/book', label: 'Réserver', icon: CirclePlus },
		{ href: '/my-bookings', label: 'Mes réservations', icon: ClipboardList },
		{ href: '/stats', label: 'Activité', icon: ChartBar },
		{ href: '/account', label: 'Compte', icon: CircleUser }
	];
</script>

<!-- En-tête -->
<header class="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
	<div class="flex h-14 items-center justify-between px-4">
		<div class="flex items-center gap-6">
			<a href={flat ? '/calendar' : '/login'} class="flex items-center gap-2 transition-opacity hover:opacity-80">
				<Logo class="h-7 w-7" />
				<span class="text-primary text-lg font-bold tracking-tight">Créneau</span>
			</a>

			{#if flat}
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
			{/if}
		</div>

		<div class="flex items-center gap-1">
			{#if flat?.isAdmin}
				<a href="/admin/lots">
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
			{#if !flat}
				<a href="/guide" aria-label="Guide d'utilisation">
					<Button variant="ghost" size="sm" class="text-muted-foreground h-8 w-8 p-0">
						<BookOpen class="h-4 w-4" />
					</Button>
				</a>
			{/if}
			<a href="/about">
				<Button variant="ghost" size="sm" class="text-muted-foreground h-8 w-8 p-0">
					<LifeBuoy class="h-4 w-4" />
				</Button>
			</a>
			{#if flat}
				<a href="/account">
					<Button variant="ghost" size="sm" class="text-foreground gap-1.5 font-semibold">
						<CircleUser class="h-4 w-4" />
						<span class="hidden sm:inline">{flat.displayName || flat.number}</span>
					</Button>
				</a>
			{/if}
		</div>
	</div>
</header>
