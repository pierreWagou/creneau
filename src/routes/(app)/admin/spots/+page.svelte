<script lang="ts">
	import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right';
	import CarFront from '@lucide/svelte/icons/car-front';
	import Check from '@lucide/svelte/icons/check';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Search from '@lucide/svelte/icons/search';
import Trash2 from '@lucide/svelte/icons/trash-2';
import Undo2 from '@lucide/svelte/icons/undo-2';
import X from '@lucide/svelte/icons/x';
	import { mode } from 'mode-watcher';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import { getFlatColor } from '$lib/colors';
	import FlatLifecycleCard from '$lib/components/flat-lifecycle-card.svelte';
	import FlatSpotCards from '$lib/components/flat-spot-cards.svelte';
	import FlatTextField from '$lib/components/flat-text-field.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
import * as Card from '$lib/components/ui/card';
import * as Dialog from '$lib/components/ui/dialog';
import * as Drawer from '$lib/components/ui/drawer';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { DISPLAY_NAME_MAX_LENGTH, formatSpotNumber, isValidFlatNumber, isValidSpotNumber } from '$lib/constants';
	import { createIsDesktop } from '$lib/utils/is-desktop.svelte';
	import { describeSpotConflicts, findSpotConflicts } from '$lib/utils/spots';
	import { isValidEmail, isValidPhone } from '$lib/validation';
import ConfirmDialog, { type ConfirmAction } from '../_components/confirm-dialog.svelte';

	let { data } = $props();

	// Dialog state
	type AdminDialog = 'swapSpot' | null;
	let openDialog = $state<AdminDialog>(null);
	// Spot-add dialog is independent so it can nest over the create dialog
	let spotDialogOpen = $state(false);
	// Spot detail drawer (null = closed; derived object auto-clears if the spot disappears)
	let spotDetailNum = $state<string | null>(null);
	const spotDetail = $derived(
		spotDetailNum ? (data.spots.find((s) => s.number === spotDetailNum) ?? null) : null
	);

	function openSpotDetail(spotNumber: string) {
		spotDetailNum = spotNumber;
		editingSpotDesc = false;
		spotDetailOpen = true;
	}

	// Spot description inline edit (server-truth: display reads spotDetail, draft is local)
	let editingSpotDesc = $state(false);
	let spotDescDraft = $state('');
	let savingSpotDesc = $state(false);
	let spotDescInput: HTMLTextAreaElement | null = $state(null);

	$effect(() => {
		if (editingSpotDesc) spotDescInput?.focus();
	});

	async function commitSpotDescription(): Promise<void> {
		if (!spotDetail) return;
		const trimmed = spotDescDraft.trim();
		if (trimmed === (spotDetail.description ?? '')) {
			editingSpotDesc = false;
			return;
		}
		savingSpotDesc = true;
		try {
			const res = await fetch(`/api/spots/${encodeURIComponent(spotDetail.number)}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ description: trimmed || null })
			});
			if (res.ok) {
				toast.success(`Place de parking "${spotDetail.number}" mise à jour`);
				await invalidateAll();
				editingSpotDesc = false;
			} else {
				const result = await res.json();
				toast.error(result.error || 'Impossible de modifier la place de parking');
			}
		} catch {
			toast.error('Erreur réseau');
		} finally {
			savingSpotDesc = false;
		}
	}
	let spotDetailOpen = $state(false);
	const desktop = createIsDesktop();
	const isDark = $derived(mode.current === 'dark');
	let newSpotNumber = $state('');
	let newSpotDescription = $state('');
	let swapTarget = $state<(typeof data.spots)[0] | null>(null);
	let swapFlatNumber = $state('');
	let swapSpotNumber = $state('');
	let swapLoading = $state(false);
	const swapFlatSpots = $derived(
		swapFlatNumber
			? data.spots.filter((s) => s.flatNumber === swapFlatNumber)
			: []
	);

	$effect(() => {
		if (swapFlatSpots.length === 1) {
			swapSpotNumber = swapFlatSpots[0].number;
		} else {
			swapSpotNumber = '';
		}
	});

	// Derived
	const sharedSpots = $derived(data.spots.filter((s) => s.status === 'shared'));
	const unassignedSpots = $derived(
		data.spots.filter((s) => s.status === 'unassigned').sort((a, b) => (a.number < b.number ? -1 : 1))
	);
	const boundSpots = $derived(
		data.spots.filter((s) => s.flatNumber).sort((a, b) => (a.number < b.number ? -1 : 1))
	);
	let selectedSpotStatuses = $state<('shared' | 'assigned' | 'unassigned')[]>(['shared']);
	let spotQuery = $state('');
	const SPOT_PAGE_SIZE = 15;
	let spotPage = $state(1);

	// Pagination restarts whenever the result set changes
	$effect(() => {
		selectedSpotStatuses;
		spotQuery;
		spotPage = 1;
	});

	function toggleSpotStatus(status: 'shared' | 'assigned' | 'unassigned') {
		selectedSpotStatuses = selectedSpotStatuses.includes(status)
			? selectedSpotStatuses.filter((s) => s !== status)
			: [...selectedSpotStatuses, status];
	}

	// Mosaic derivations (script-level: {@const} can't live at template top level)
	const spotCounts = $derived({
		shared: sharedSpots.length,
		assigned: boundSpots.length,
		unassigned: unassignedSpots.length
	});
	const spotPills = [
		{ value: 'shared', label: 'Partagées' },
		{ value: 'assigned', label: 'Attribuées' },
		{ value: 'unassigned', label: 'En attente' }
	] as const;
	const spotQ = $derived(spotQuery.trim().toUpperCase());
	const visibleSpots = $derived(
		data.spots
			.filter(
				(s) =>
					(selectedSpotStatuses.length === 0 || selectedSpotStatuses.includes(s.status)) &&
					(spotQ === '' || s.number.includes(spotQ) || (s.flatNumber ?? '').includes(spotQ))
			)
			.slice()
			.sort((a, b) => (a.number < b.number ? -1 : 1))
	);
	const spotTotalPages = $derived(Math.max(1, Math.ceil(visibleSpots.length / SPOT_PAGE_SIZE)));
	const pagedSpots = $derived(visibleSpots.slice((spotPage - 1) * SPOT_PAGE_SIZE, spotPage * SPOT_PAGE_SIZE));
	const spotEmptyCopy = $derived(
		selectedSpotStatuses.length === 1
			? ({
					shared: 'Aucune place de parking partagée configurée.',
					assigned: 'Aucune place attribuée.',
					unassigned: 'Aucune place en attente.'
				} as const)[selectedSpotStatuses[0]]
			: 'Aucune place pour ces critères.'
	);
	// Confirmation dialog state (narrowed: flat/request confirms live on the lots page)
	let confirmAction = $state<ConfirmAction | null>(null);
	const normalizedNewSpot = $derived(newSpotNumber.trim());
	const newSpotValid = $derived(normalizedNewSpot.length > 0 && isValidSpotNumber(normalizedNewSpot));
	const shareConflictHolder = $derived(
		newSpotValid
			? (data.spots.find((s) => s.number === formatSpotNumber(normalizedNewSpot))?.flatNumber ?? null)
			: null
	);

	/** Open the resolver from the create solve button (client-side conflicts, no 409 needed) */
	let pendingShareSpotData = $state<{ number: string; description: string | null } | null>(null);

	async function addSpot(force = false) {
		if (!newSpotValid) return;

		const res = await fetch('/api/spots', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				number: normalizedNewSpot,
				description: newSpotDescription.trim() || null,
				...(force ? { force: true } : {})
			})
		});

		if (res.ok) {
			toast.success(`Place de parking "${formatSpotNumber(normalizedNewSpot)}" ajoutée`);
			newSpotNumber = '';
			newSpotDescription = '';
			pendingShareSpotData = null;
			spotDialogOpen = false;
			invalidateAll();
		} else {
			const result = await res.json();
			if (res.status === 409 && result.conflicts?.length > 0) {
				// Race: bound after render — refresh so the inline transfer box appears
				toast.warning('Cette place vient d’être attribuée — données actualisées');
				invalidateAll();
			} else {
				toast.error(result.error || "Impossible d'ajouter la place de parking");
			}
		}
	}

	async function deleteSpot(spotNumber: string) {
		const res = await fetch(`/api/spots/${encodeURIComponent(spotNumber)}`, { method: 'DELETE' });
		if (res.ok) {
			toast.success(`Place de parking "${spotNumber}" supprimée`);
			spotDetailOpen = false;
			spotDetailNum = null;
			invalidateAll();
		} else {
			const result = await res.json();
			toast.error(result.error || 'Impossible de supprimer la place de parking');
		}
	}

	function confirmDeleteSpot(spotNumber: string) {
		confirmAction = { type: 'deleteSpot', spotNumber };
	}

	/** Siding move between pool and limbo (bound spots route through lot flows) */
	async function moveSpotStatus(spotNumber: string, status: 'shared' | 'unassigned') {
		const res = await fetch(`/api/spots/${encodeURIComponent(spotNumber)}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ status })
		});
		if (res.ok) {
			toast.success(status === 'shared' ? 'Place mise en commun' : 'Place retirée du pool');
			invalidateAll();
		} else {
			const result = await res.json();
			toast.error(result.error || 'Impossible de modifier la place');
		}
	}
	function showSwapSpot(s: (typeof data.spots)[0]) {
		swapTarget = s;
		swapFlatNumber = '';
		swapSpotNumber = '';
		openDialog = 'swapSpot';
	}

	async function executeSwap() {
		if (!swapTarget || !swapFlatNumber) return;
		swapLoading = true;
		try {
			const res = await fetch('/api/admin/spots/swap', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					spotNumber: swapTarget.number,
					flatNumber: swapFlatNumber,
					targetSpotNumber: swapSpotNumber || undefined
				})
			});
			if (res.ok) {
				toast.success(`Place de parking "${swapTarget.number}" échangée`);
				openDialog = null;
				swapTarget = null;
				invalidateAll();
			} else {
				const result = await res.json();
				toast.error(result.error || "Impossible d'échanger la place de parking");
			}
		} catch {
			toast.error("Erreur lors de l'échange");
		} finally {
			swapLoading = false;
		}
	}
	async function executeConfirmAction(action: ConfirmAction) {
		if (action.type === 'deleteSpot') {
			await deleteSpot(action.spotNumber);
		}
		confirmAction = null;
	}
</script>

	<!-- Places de parking (single mosaic, status filter) -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Places de parking</Card.Title>
			<Card.Description>Gérez le pool, les attributions et les places en attente.</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="flex items-center gap-2">
				<div class="relative w-28 sm:w-44 shrink-0">
					<Search class="text-muted-foreground absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
					<Input
						placeholder="Rechercher une place…"
						bind:value={spotQuery}
						class="h-9 w-full pl-8 text-sm"
					/>
				</div>
				<div class="flex min-w-0 flex-1 gap-2 overflow-x-auto" role="group" aria-label="Filtrer par statut">
				{#each spotPills as pill}
					<button
						type="button"
						class="h-7 shrink-0 rounded-full border px-2.5 sm:px-3 text-xs font-medium tabular-nums transition-colors {selectedSpotStatuses.includes(pill.value)
							? pill.value === 'shared'
								? 'bg-primary text-white dark:text-[#1e1e2e] border-transparent font-semibold'
								: pill.value === 'assigned'
									? 'bg-muted-foreground text-[#1e1e2e] border-transparent font-semibold'
									: 'bg-warning text-[#1e1e2e] border-transparent font-semibold'
							: pill.value === 'shared'
								? 'bg-primary/15 text-primary hover:opacity-90'
								: pill.value === 'assigned'
									? 'bg-muted text-muted-foreground hover:opacity-90'
									: 'bg-warning/15 text-warning hover:opacity-90'}"
						aria-pressed={selectedSpotStatuses.includes(pill.value)}
						onclick={() => toggleSpotStatus(pill.value)}
					>
						{pill.label} ({spotCounts[pill.value]})
					</button>
				{/each}
				</div>
			</div>
			{#if visibleSpots.length === 0}
				<p class="text-muted-foreground text-sm">{spotEmptyCopy}</p>
			{/if}
			<FlatSpotCards
				variant="chips"
				spots={pagedSpots.map((s) => s.number)}
				editable={false}
				subtexts={Object.fromEntries(pagedSpots.map((s) => [s.number, s.flatNumber]))}
				statuses={Object.fromEntries(pagedSpots.map((s) => [s.number, s.status]))}
				onSelect={(n) => openSpotDetail(n)}
				onAdd={() => {
					newSpotNumber = '';
					newSpotDescription = '';
					spotDialogOpen = true;
				}}
			/>
			{#if spotTotalPages > 1}
				<div class="flex items-center justify-between gap-2">
					<p class="text-muted-foreground text-xs">
						{visibleSpots.length} place{visibleSpots.length > 1 ? 's' : ''}
					</p>
					<div class="flex items-center gap-2">
						<span class="text-muted-foreground text-xs">Page {spotPage}/{spotTotalPages}</span>
						<Button size="sm" variant="outline" disabled={spotPage <= 1} onclick={() => (spotPage -= 1)}>
							Précédent
						</Button>
						<Button size="sm" variant="outline" disabled={spotPage >= spotTotalPages} onclick={() => (spotPage += 1)}>
							Suivant
						</Button>
					</div>
				</div>
			{/if}
		</Card.Content>
	</Card.Root>

<!-- Drawer: Spot detail -->
<Drawer.Root
	bind:open={spotDetailOpen}
	direction={desktop.value ? 'right' : 'bottom'}
	onOpenChange={(o) => {
		if (!o) {
			spotDetailNum = null;
			editingSpotDesc = false;
		}
	}}
>
	<Drawer.Content class="overflow-hidden overflow-clip data-[vaul-drawer-direction=bottom]:max-h-[92svh] sm:max-w-xl">
		{#if spotDetail}
			{@const spotOwnerName = spotDetail.flatNumber
				? (data.ownerNames[spotDetail.flatNumber] ?? spotDetail.flatNumber)
				: null}
			{@const spotColor = getFlatColor(spotDetail.number, isDark)}
			<div class="flex flex-1 flex-col min-h-0 overflow-y-auto overscroll-none px-6 pt-6 pb-6" data-vaul-no-drag>
				<div>
					<div class="rounded-xl border border-border p-4">
						<div class="flex items-center gap-4">
							<div
								class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
								style="background-color: color-mix(in srgb, {spotColor} 18%, transparent); color: {spotColor}"
							>
								<CarFront class="h-6 w-6" />
							</div>
							<div class="flex-1 min-w-0">
								<p class="text-base font-semibold">Place {spotDetail.number}</p>
								{#if spotOwnerName}
									<p class="text-muted-foreground text-sm truncate">
										Assignée à {spotOwnerName}
									</p>
								{/if}
							</div>
							{#if spotOwnerName}
								<Badge class="shrink-0 bg-muted-foreground text-[#1e1e2e] border-transparent">Assignée</Badge>
							{:else if spotDetail.status === 'unassigned'}
								<Badge class="shrink-0 bg-warning text-[#1e1e2e] border-transparent">En attente</Badge>
							{:else}
								<Badge class="shrink-0 bg-primary text-white dark:text-[#1e1e2e] border-transparent">Partagée</Badge>
							{/if}
						</div>
					</div>
				</div>

				<div class="mt-4">
					<p class="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Informations</p>
					<div class="rounded-xl border border-border p-4 space-y-0">
						<div class="py-2.5">
							<div class="flex items-center justify-between gap-3 min-h-8">
								<span class="text-sm text-muted-foreground">Description</span>
								{#if editingSpotDesc}
									<div class="flex items-center gap-1 shrink-0">
										<Button
											type="button"
											variant="ghost"
											size="icon-sm"
											class="text-success hover:text-success hover:!bg-success/10"
											disabled={savingSpotDesc}
											aria-label="Valider"
											onclick={commitSpotDescription}
										>
											<Check class="h-3.5 w-3.5" />
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="icon-sm"
											class="shrink-0"
											disabled={savingSpotDesc}
											aria-label="Annuler"
											onclick={() => (editingSpotDesc = false)}
										>
											<X class="h-3.5 w-3.5" />
										</Button>
									</div>
								{:else}
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										class="shrink-0 text-muted-foreground hover:text-foreground hover:!bg-muted"
										aria-label="Modifier la description"
										onclick={() => {
											spotDescDraft = spotDetail.description ?? '';
											editingSpotDesc = true;
										}}
									>
										<Pencil class="h-3.5 w-3.5" />
									</Button>
								{/if}
							</div>
							{#if editingSpotDesc}
								<Textarea
									bind:ref={spotDescInput}
									bind:value={spotDescDraft}
									placeholder="ex. Place handicapé"
									disabled={savingSpotDesc}
									rows={3}
									class="w-full mt-1.5 text-sm"
									onkeydown={(e) => {
										if (e.key === 'Escape') {
											editingSpotDesc = false;										}
									}}
								/>
							{:else}
								<p class="text-sm font-semibold break-words mt-0.5">
									{spotDetail.description ?? '—'}
								</p>
							{/if}
						</div>
						<div class="py-2.5 border-t border-border">
							<div class="flex items-center justify-between gap-3 min-h-8">
								<span class="text-sm text-muted-foreground">Lot</span>
								{#if spotDetail.flatNumber}
									<a
										href="/admin/lots?q={encodeURIComponent(spotDetail.flatNumber)}"
										class="inline-link text-sm font-semibold truncate"
									>
										{spotDetail.flatNumber}{spotOwnerName !== spotDetail.flatNumber
											? ` — ${spotOwnerName}`
											: ''}
									</a>
								{:else if spotDetail.status === 'unassigned'}
									<span class="text-sm text-muted-foreground text-right">En attente d'affectation</span>
								{:else}
									<span class="text-sm text-muted-foreground">Pool — réservable par tous</span>
								{/if}
							</div>
						</div>
					</div>
				</div>

				<div class="mt-4 pb-4">
					<p class="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Cycle de vie</p>
					<FlatLifecycleCard
						createdAt={spotDetail.createdAt}
						createdLabel="Ajoutée le"
						pendingLabel={null}
					/>
				</div>
				<div class="mt-auto pt-1 space-y-2">
					{#if !spotDetail.flatNumber}
						{#if spotDetail.status === 'unassigned'}
							<Button variant="default" class="w-full" onclick={() => moveSpotStatus(spotDetail.number, 'shared')}>
								<Check class="h-4 w-4 mr-2" />Mettre en commun
							</Button>
						{:else}
							<Button variant="outline" class="w-full" onclick={() => moveSpotStatus(spotDetail.number, 'unassigned')}>
								<Undo2 class="h-4 w-4 mr-2" />Retirer du pool
							</Button>
						{/if}
					{/if}
					{#if data.grandTotal > 0}
						<Button variant="default" class="w-full" onclick={() => showSwapSpot(spotDetail)}>
							<ArrowLeftRight class="h-4 w-4 mr-2" />Échanger
						</Button>
					{/if}
					<Button variant="default" class="w-full bg-destructive text-white hover:bg-destructive/80 dark:text-[#1e1e2e]" onclick={() => confirmDeleteSpot(spotDetail.number)}>
						<Trash2 class="h-4 w-4 mr-2" />
						Supprimer la place
					</Button>
				</div>
			</div>
		{/if}
	</Drawer.Content>
</Drawer.Root>

<!-- Dialog: Ajouter -->
<Dialog.Root
	open={spotDialogOpen}
	onOpenChange={(o) => {
		if (!o) spotDialogOpen = false;
	}}
>
	<Dialog.Content class="sm:p-6">
		<Dialog.Header>
			<div class="flex items-center gap-3">
				<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
					<CarFront class="h-6 w-6" />
				</div>
				<div class="min-w-0">
					<Dialog.Title>Ajouter une place de parking</Dialog.Title>
					<Dialog.Description>La place sera créée en attente d'affectation.</Dialog.Description>
				</div>
			</div>
		</Dialog.Header>
		<div class="space-y-4">
			<FlatTextField
				label="Numéro"
				placeholder="ex. 01"
				uppercase
				maxlength={2}
				bind:value={newSpotNumber}
				error={newSpotNumber && !newSpotValid
					? 'Format requis : 1 ou 2 chiffres (ex. 3, 01, 36)'
					: null}
			/>
			<FlatTextField
				label="Description"
				placeholder="ex. Place de parking handicapé"
				required={false}
				bind:value={newSpotDescription}
			/>
			{#if shareConflictHolder}
				<div class="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
					<p>
						Place <strong>{formatSpotNumber(normalizedNewSpot)}</strong> attribuée au lot
						<strong>{shareConflictHolder}</strong>.
					</p>
					<p class="text-muted-foreground">La libérer vers les places partagées ?</p>
					<div class="mt-2 flex gap-2">
						<Button size="sm" variant="default" onclick={() => addSpot(true)}>
							Libérer la place
						</Button>
						<Button size="sm" variant="ghost" onclick={() => (newSpotNumber = '')}>Annuler</Button>
					</div>
				</div>
			{/if}
		</div>
		<Dialog.Footer class="bg-transparent border-t-0">
			<Button variant="outline" onclick={() => (spotDialogOpen = false)}>Annuler</Button>
			<Button variant="default" onclick={() => addSpot()} disabled={!newSpotValid || shareConflictHolder !== null}>Ajouter</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Dialog: Échanger une place -->
<Dialog.Root
	open={openDialog === 'swapSpot'}
	onOpenChange={(o) => {
		if (!o) {
			openDialog = null;
			swapTarget = null;
		}
	}}
>
	<Dialog.Content class="sm:max-w-md sm:p-6">
		{#if swapTarget}
			<Dialog.Header>
				<div class="flex items-center gap-3">
					<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
						<ArrowLeftRight class="h-6 w-6" />
					</div>
					<div class="min-w-0">
						<Dialog.Title>Échanger la place de parking {swapTarget.number}</Dialog.Title>
						<Dialog.Description>Assigner cette place de parking à un lot existant.</Dialog.Description>
					</div>
				</div>
			</Dialog.Header>
			<div class="space-y-4">
				<div class="dialog-section">
					<p class="dialog-section-label">Lot</p>
					<select
						id="swap-flat"
						class="border-input bg-background text-foreground flex h-8 w-full rounded-md border px-2 text-sm"
						bind:value={swapFlatNumber}
					>
						<option value="">Sélectionner un lot...</option>
						{#each data.flatOptions as f}
							<option value={f.number}>{f.number}{f.displayName ? ` — ${f.displayName}` : ''}</option>
						{/each}
					</select>
				</div>

				{#if swapFlatNumber && swapFlatSpots.length > 0}
					<div class="dialog-section">
						<p class="dialog-section-label">Place de parking à échanger</p>
						<select
							id="swap-spot"
							class="border-input bg-background text-foreground flex h-8 w-full rounded-md border px-2 text-sm"
							bind:value={swapSpotNumber}
						>
							<option value="">Sélectionner une place de parking...</option>
							{#each swapFlatSpots as s}
								<option value={s.number}>Place de parking {s.number}{s.description ? ` — ${s.description}` : ''}</option>
							{/each}
						</select>
					</div>
				{/if}

				{#if swapFlatNumber}
					<div class="rounded-md bg-muted p-3 text-xs text-muted-foreground">
						{#if swapSpotNumber}
La place de parking <strong class="text-foreground">{swapTarget.number}</strong> sera assignée à <strong class="text-foreground">{swapFlatNumber}</strong>.
						La place de parking <strong class="text-foreground">{swapSpotNumber}</strong> deviendra partagée.
						{:else}
La place de parking <strong class="text-foreground">{swapTarget.number}</strong> sera assignée à <strong class="text-foreground">{swapFlatNumber}</strong>.
					{/if}
					</div>
				{/if}

			</div>
		{/if}
		<Dialog.Footer class="bg-transparent border-t-0">
			<Button variant="outline" onclick={() => (openDialog = null)}>Annuler</Button>
			<Button
				variant="default"
				onclick={executeSwap}
				disabled={!swapFlatNumber || swapLoading}
			>
				{swapLoading ? 'Échange...' : 'Échanger'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Confirmation dialog (shared) -->
<ConfirmDialog action={confirmAction} onClose={() => (confirmAction = null)} onExecute={executeConfirmAction} />
