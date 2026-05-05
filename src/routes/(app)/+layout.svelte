<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';

	let { children, data } = $props();

	const navItems = [
		{ href: '/calendar', label: 'Calendrier', icon: '&#128197;' },
		{ href: '/book', label: 'Réserver', icon: '&#10010;' },
		{ href: '/my-bookings', label: 'Mes réservations', icon: '&#128196;' }
	];

	async function handleLogout() {
		await fetch('/api/auth/logout', { method: 'POST' });
		goto('/login');
	}
</script>

<div class="flex min-h-svh flex-col">
	<!-- En-tête -->
	<header class="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
		<div class="flex h-14 items-center justify-between px-4">
			<a href="/calendar" class="text-lg font-semibold hover:opacity-80">Créneau</a>
			<div class="flex items-center gap-2">
				<span class="text-sm text-muted-foreground">
					{data.user.displayName || data.user.number}
				</span>
				{#if data.user.isAdmin}
					<a href="/admin">
						<Button variant="ghost" size="sm">Admin</Button>
					</a>
				{/if}
				<Button variant="ghost" size="sm" onclick={handleLogout}>Déconnexion</Button>
			</div>
		</div>
	</header>

	<!-- Contenu principal -->
	<main class="flex-1 p-4">
		{@render children()}
	</main>

	<!-- Navigation mobile -->
	<nav class="sticky bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden">
		<div class="flex items-center justify-around py-2">
			{#each navItems as item}
				<a
					href={item.href}
					class="flex flex-col items-center gap-1 px-3 py-1 text-xs transition-colors {$page.url.pathname === item.href ? 'text-primary' : 'text-muted-foreground'}"
				>
					<span class="text-lg">{@html item.icon}</span>
					<span>{item.label}</span>
				</a>
			{/each}
		</div>
	</nav>
</div>
