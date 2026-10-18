<script lang="ts">
	import { Combobox } from 'bits-ui';
	import { goto } from '$app/navigation';
	import AsyncButton from '$lib/components/async-button.svelte';
	import FormField from '$lib/components/form-field.svelte';
	import Logo from '$lib/components/logo.svelte';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { PIN_MAX_LENGTH, PIN_MIN_LENGTH, UI_FOCUS_DELAY_MS } from '$lib/constants';
	import { apiFetch } from '$lib/utils/api';
	import { rankComboboxMatches } from '$lib/utils/combobox';
	import { notifyResult } from '$lib/utils/toasts';

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

	const filteredItems = $derived(rankComboboxMatches(items, searchValue, (item) => item.label));

	$effect(() => {
		const match = flats.find((f) => f.number.toLowerCase() === searchValue.trim().toLowerCase());
		if (match) flatNumber = match.number;
	});

	$effect(() => {
		const _ = filteredItems;
		if (!comboOpen) return;
		const frame = requestAnimationFrame(() => {
			if (comboOpen && inputEl) {
				retriggering = true;
				inputEl.dispatchEvent(new Event('input', { bubbles: true }));
				retriggering = false;
			}
		});
		return () => cancelAnimationFrame(frame);
	});

	async function handleLogin() {
		if (!flatNumber || !pin) return;
		loading = true;

		const result = await apiFetch(
			'/api/auth/login',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ flatNumber, pin })
			},
			'Connexion impossible'
		);

		if (result.ok) {
			goto('/calendar');
		} else {
			notifyResult(result, null, 'Connexion impossible');
		}
		loading = false;
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
			<FormField label="Numéro de lot" for="flat" required>
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
								if (flatNumber) setTimeout(() => pinInputEl?.focus(), UI_FOCUS_DELAY_MS);
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
											Aucun lot trouvé.
										</span>
									{/each}
								</Combobox.Viewport>
							</Combobox.Content>
						</Combobox.Portal>
					</Combobox.Root>
				{:else}
					<Input id="flat" type="text" placeholder="ex. B12" bind:value={flatNumber} required />
				{/if}
			</FormField>
			<FormField label="Code PIN" for="pin" required>
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
			</FormField>
			<AsyncButton type="submit" class="w-full" disabled={!flatNumber || !pin} {loading} loadingLabel="Connexion…">
				Se connecter
			</AsyncButton>
		</form>
	</Card.Content>
	<Card.Footer class="flex-col gap-2">
	<p class="text-muted-foreground text-sm">
		Vous avez une invitation ? <a href="/activate" class="inline-link font-medium"
			>Activer mon lot</a
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
