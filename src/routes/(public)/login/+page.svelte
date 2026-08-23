<script lang="ts">
	import { Combobox } from 'bits-ui';
	import { tick } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import Logo from '$lib/components/logo.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { PIN_MAX_LENGTH, PIN_MIN_LENGTH } from '$lib/constants';

	let { data } = $props();

	let flatNumber = $state('');
	let comboValue = $state('');
	let pin = $state('');
	let loading = $state(false);
	let searchValue = $state('');
	let comboOpen = $state(false);
	let pinInputEl = $state<HTMLInputElement | null>(null);
	let inputEl = $state<HTMLInputElement | null>(null);
	let retriggering = $state(false);

	const flats = $derived(data.flats ?? []);

	const items = $derived(
		flats.map((f) => ({
			value: f.number,
			label: f.displayName ? `${f.number} — ${f.displayName}` : f.number
		}))
	);

	const filteredItems = $derived(
		searchValue.trim() === ''
			? []
			: (() => {
					const q = searchValue.trim().toLowerCase();
					const matches = items.filter((item) => item.label.toLowerCase().includes(q));
					const startsWith = matches.filter((item) => item.label.toLowerCase().startsWith(q));
					const contains = matches.filter((item) => !item.label.toLowerCase().startsWith(q));
					return [...startsWith, ...contains];
				})()
	);

	$effect(() => {
		const match = flats.find((f) => f.number.toLowerCase() === searchValue.trim().toLowerCase());
		if (match) flatNumber = match.number;
	});

	$effect(() => {
		const _ = filteredItems;
		if (comboOpen) {
			requestAnimationFrame(() => {
				if (comboOpen && inputEl) {
					retriggering = true;
					inputEl.dispatchEvent(new Event('input', { bubbles: true }));
					retriggering = false;
				}
			});
		}
	});

	async function handleLogin() {
		if (!flatNumber || !pin) return;
		loading = true;

		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ flatNumber, pin })
			});

			const result = await res.json();

			if (res.ok) {
				goto('/calendar');
			} else {
				toast.error(result.error || 'Connexion impossible');
			}
		} catch {
			toast.error('Erreur de connexion');
		} finally {
			loading = false;
		}
	}
</script>

<div class="mx-auto w-full max-w-sm">
<Card.Root class="shadow-sm">
	<Card.Header class="pb-2 text-center">
		<div class="mx-auto mb-2">
			<Logo class="h-10 w-10" />
		</div>
		<Card.Title class="text-2xl font-bold tracking-tight">Créneau</Card.Title>
		<Card.Description>Réservation parking — Metropolitan</Card.Description>
	</Card.Header>
	<Card.Content>
		<form onsubmit={(e) => { e.preventDefault(); handleLogin(); }} class="space-y-4">
			<div class="space-y-2">
				<Label for="flat">Numéro d'appartement <span class="text-destructive">*</span></Label>
				{#if flats.length > 0}
				<Combobox.Root
					type="single"
					bind:value={comboValue}
					bind:open={comboOpen}
					items={filteredItems}
					onValueChange={(v) => { if (v) flatNumber = v; }}
					onOpenChangeComplete={(open) => {
							if (!open) {
								searchValue = '';
								if (flatNumber) setTimeout(() => pinInputEl?.focus(), 50);
							}
						}}
					>
						<Combobox.Input
							id="flat"
							bind:ref={inputEl}
							oninput={(e) => {
								if (retriggering) return;
								searchValue = e.currentTarget.value;
								comboOpen = e.currentTarget.value.trim().length > 0;
							}}
							placeholder="ex. B12"
							class="dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 disabled:bg-input/50 dark:disabled:bg-input/80 h-8 w-full min-w-0 rounded-lg border bg-transparent px-2.5 py-1 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
						/>
						<Combobox.Portal>
							<Combobox.Content
								class="bg-popover text-popover-foreground border-border z-50 w-[var(--bits-combobox-anchor-width)] min-w-[var(--bits-combobox-anchor-width)] rounded-lg border shadow-md"
								sideOffset={4}
							>
								<Combobox.Viewport class="p-1">
									{#each filteredItems as item (item.value)}
										<Combobox.Item
											value={item.value}
											label={item.label}
											class="data-highlighted:bg-muted flex h-8 cursor-default items-center rounded-sm px-2 text-sm outline-none select-none"
										>
											{item.label}
										</Combobox.Item>
									{:else}
										<span class="text-muted-foreground block px-2 py-1.5 text-sm">
											Aucun appartement trouvé.
										</span>
									{/each}
								</Combobox.Viewport>
							</Combobox.Content>
						</Combobox.Portal>
					</Combobox.Root>
				{:else}
					<Input id="flat" type="text" placeholder="ex. B12" bind:value={flatNumber} required />
				{/if}
			</div>
			<div class="space-y-2">
				<Label for="pin">Code PIN <span class="text-destructive">*</span></Label>
				<Input
					id="pin"
					type="password"
					inputmode="numeric"
					pattern="[0-9]*"
					maxlength={PIN_MAX_LENGTH}
					placeholder="{PIN_MIN_LENGTH} à {PIN_MAX_LENGTH} chiffres"
					bind:value={pin}
					bind:ref={pinInputEl}
					required
				/>
			</div>
			<Button type="submit" class="w-full" disabled={loading || !flatNumber || !pin}>
				{loading ? 'Connexion...' : 'Se connecter'}
			</Button>
		</form>
	</Card.Content>
	<Card.Footer class="flex-col gap-2">
	<p class="text-muted-foreground text-sm">
		Vous avez une invitation ? <a href="/activate" class="inline-link font-medium"
			>Activer mon appartement</a
		>
	</p>
	<p class="text-muted-foreground text-sm">
		Pas encore de compte ? <a href="/request" class="inline-link font-medium"
			>Demander l'accès</a
		>
	</p>
	</Card.Footer>
</Card.Root>
</div>
