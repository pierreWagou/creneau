<script lang="ts">
	import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right';
import CarFront from '@lucide/svelte/icons/car-front';
import Check from '@lucide/svelte/icons/check';
import ChevronRight from '@lucide/svelte/icons/chevron-right';
import Clock from '@lucide/svelte/icons/clock';
import House from '@lucide/svelte/icons/house';
import Pencil from '@lucide/svelte/icons/pencil';
import Trash2 from '@lucide/svelte/icons/trash-2';
import Undo2 from '@lucide/svelte/icons/undo-2';
import Users from '@lucide/svelte/icons/users';
import X from '@lucide/svelte/icons/x';
	import { Combobox } from 'bits-ui';
	import { mode } from 'mode-watcher';
	import { toast } from 'svelte-sonner';
	import { goto, invalidateAll } from '$app/navigation';
import { page } from '$app/state';
	import { getFlatColor } from '$lib/colors';
import AvatarCircle from '$lib/components/detail/avatar-circle.svelte';
import DetailCard from '$lib/components/detail/card.svelte';
import DetailSection from '$lib/components/detail/section.svelte';
import StatusBadge from '$lib/components/detail/status-badge.svelte';
import DialogHeader from '$lib/components/dialog-header.svelte';
import DialogShell from '$lib/components/dialog-shell.svelte';
import DrawerActionFooter from '$lib/components/drawer-action-footer.svelte';
import DrawerShell from '$lib/components/drawer-shell.svelte';
import EditableField from '$lib/components/editable-field.svelte';
import EntityHeaderCard from '$lib/components/entity-header-card.svelte';
import FilterBar from '$lib/components/filter-bar.svelte';
import FlatLifecycleCard from '$lib/components/flat-lifecycle-card.svelte';
import FlatSpotCards from '$lib/components/flat-spot-cards.svelte';
import FlatTextField from '$lib/components/flat-text-field.svelte';
import IconButton from '$lib/components/icon-button.svelte';
import IdentityRow from '$lib/components/identity-row.svelte';
import RadioCardRow from '$lib/components/radio-card-row.svelte';
import SearchField from '$lib/components/search-field.svelte';
import SpotFlightStrip, { type FlightEndpoint, type FlightMove } from '$lib/components/spot-flight-strip.svelte';
import { Button } from '$lib/components/ui/button';
import * as Card from '$lib/components/ui/card';
import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { DIALOG_FOOTER_CLASS, formatSpotNumber, isValidSpotNumber } from '$lib/constants';
	import { containerAvatar, containerTitle, type SpotContainer, spotChipProps } from '$lib/spot-containers';
	import { apiFetch } from '$lib/utils/api';
	import { rankComboboxMatches } from '$lib/utils/combobox';
	import { notifyResult } from '$lib/utils/toasts';
import ConfirmDialog, { type ConfirmAction } from '../_components/confirm-dialog.svelte';
import SpotMercatoBoard from '../_components/spot-mercato-board.svelte';

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

	function openSpotDetail(spotNumber: string, opts: { pushUrl?: boolean } = {}) {
		spotDetailNum = spotNumber;
		editingSpotDesc = false;
		spotDetailOpen = true;
		// Explicit user opens always win over a stale strip flag.
		strippingSpotParam = false;
		// Deep link: opening the drawer pushes ?spot= (back button closes it);
		// URL-driven opens pass pushUrl: false to avoid stacking entries.
		if (opts.pushUrl !== false) {
			const params = new URLSearchParams(window.location.search);
			if (params.get('spot') !== spotNumber) {
				params.set('spot', spotNumber);
				goto(`?${params.toString()}`, { keepFocus: true, noScroll: true });
			}
		}
	}

	// Deep link (?spot=): open the drawer on load and on back/forward.
	// data.spots is the full list (mosaic pagination is client-side), so an
	// unknown number simply drops the param — no fetch fallback needed.
	$effect(() => {
		const spot = page.url.searchParams.get('spot');
		if (!spot) {
			strippingSpotParam = false; // strip landed — re-arm
			// Back button out of the drawer: URL lost ?spot= while it is
			// still open — close it.
			if (spotDetailOpen) spotDetailOpen = false;
			return;
		}
		if (strippingSpotParam) return; // close in flight — do NOT reopen
		if (spotDetailNum === spot && spotDetailOpen) return;
		if (data.spots.some((s) => s.number === spot)) {
			openSpotDetail(spot, { pushUrl: false });
		} else {
			const params = new URLSearchParams(window.location.search);
			params.delete('spot');
			goto(`?${params.toString()}`, { replaceState: true, keepFocus: true, noScroll: true });
		}
	});

	// Spot description inline edit (server-truth: display reads spotDetail, draft is local)
	let editingSpotDesc = $state(false);
	let spotDescDraft = $state('');
	let savingSpotDesc = $state(false);

	async function commitSpotDescription(): Promise<void> {
		if (!spotDetail) return;
		const trimmed = spotDescDraft.trim();
		if (trimmed === (spotDetail.description ?? '')) {
			editingSpotDesc = false;
			return;
		}
		savingSpotDesc = true;
		const result = await apiFetch(
			`/api/spots/${encodeURIComponent(spotDetail.number)}`,
			{
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ description: trimmed || null })
			},
			'Impossible de modifier la place de parking'
		);
		if (result.ok) {
			toast.success(`Place de parking "${spotDetail.number}" mise à jour`);
			await invalidateAll();
			editingSpotDesc = false;
		} else {
			notifyResult(result, null, 'Impossible de modifier la place de parking');
		}
		savingSpotDesc = false;
	}
	let spotDetailOpen = $state(false);
	// Set while the close-strip navigation (?spot= removal) is in flight: the
	// URL still carries the param but the drawer is intentionally closed — the
	// deep-link effect must not reopen it (that close→reopen→close churn
	// orphans vaul overlays and eats all pointer events).
	let strippingSpotParam = $state(false);
	const isDark = $derived(mode.current === 'dark');
	let newSpotNumber = $state('');
	let newSpotDescription = $state('');
	let swapTarget = $state<(typeof data.spots)[0] | null>(null);
	let swapFlatNumber = $state('');
	let swapLoading = $state(false);
	/** Destination tab; the spot's current state is hidden (nothing to confirm there) */
	let swapMode = $state<'lot' | 'pool' | 'limbo'>('lot');
	/** Lot combobox (login-style search) for the affectation dialog */
	let swapComboValue = $state('');
	let swapSearchValue = $state('');
	let swapComboOpen = $state(false);
	let swapComboInputEl = $state<HTMLInputElement | null>(null);
	let swapComboRetriggering = $state(false);

	const swapFlatItems = $derived(
		data.flatOptions.map((f) => ({
			value: f.number,
			label: f.number,
			haystack: `${f.number} ${f.displayName ?? ''}`.toLowerCase()
		}))
	);

	const filteredSwapFlatItems = $derived(
		rankComboboxMatches(swapFlatItems, swapSearchValue, (item) => item.haystack, (item) => item.label).map(
			({ value, label }) => ({ value, label })
		)
	);

	// Typing a full lot number selects it without a dropdown click (login parity)
	$effect(() => {
		const match = data.flatOptions.find(
			(f) => f.number.toLowerCase() === swapSearchValue.trim().toLowerCase()
		);
		if (match) swapFlatNumber = match.number;
	});

	// bits-ui quirk: re-dispatch input while open so the dropdown re-filters (login parity)
	$effect(() => {
		const _ = filteredSwapFlatItems;
		if (!swapComboOpen) return;
		const frame = requestAnimationFrame(() => {
			if (swapComboOpen && swapComboInputEl) {
				swapComboRetriggering = true;
				swapComboInputEl.dispatchEvent(new Event('input', { bubbles: true }));
				swapComboRetriggering = false;
			}
		});
		return () => cancelAnimationFrame(frame);
	});

	// Derived
	const sharedSpots = $derived(data.spots.filter((s) => s.status === 'shared'));
	const unassignedSpots = $derived(
		data.spots.filter((s) => s.status === 'unassigned').sort((a, b) => (a.number < b.number ? -1 : 1))
	);
	const boundSpots = $derived(
		data.spots.filter((s) => s.flatNumber).sort((a, b) => (a.number < b.number ? -1 : 1))
	);

	interface AffectationPreview {
		source: FlightEndpoint;
		destination: FlightEndpoint;
		movingSpot: string;
		strikeSpot: string | null;
		move: FlightMove | null;
		ariaLabel: string;
	}

	function sortedSpotNumbers(spots: typeof data.spots): string[] {
		return spots
			.map((spot) => spot.number)
			.slice()
			.sort((a, b) => (a < b ? -1 : 1));
	}

	// One-leg illustration for the actionable destination. Exchange behavior stays out
	// of this dialog: the strip always animates the target spot itself forward.
	/** Lifecycle color per spot number for flight strips — shared resolver. */
	function spotStatusOf(spotNumber: string) {
		const { spotStatus, spotTint } = spotChipProps(data.spots, spotNumber, isDark);
		if (!spotStatus) return null;
		return { status: spotStatus, tint: spotTint };
	}

	/** SpotContainer for the detail drawer header avatar (holder's color). */
	function spotContainerFor(spot: { status: 'shared' | 'assigned' | 'unassigned'; flatNumber: string | null }): SpotContainer {
		return spot.flatNumber
			? { kind: 'lot', flatNumber: spot.flatNumber, displayName: null }
			: spot.status === 'shared'
				? { kind: 'pool' }
				: { kind: 'limbo' };
	}

	const operationPreview = $derived.by((): AffectationPreview | null => {
		const target = swapTarget;
		if (!target) return null;
		const movingSpot = target.number;
		const sourceIsPending = !target.flatNumber && target.status === 'unassigned';
		const sourceContainer: SpotContainer = target.flatNumber
			? {
					kind: 'lot',
					flatNumber: target.flatNumber,
					displayName: data.ownerNames?.[target.flatNumber] ?? null
				}
			: target.status === 'shared'
				? { kind: 'pool' }
				: { kind: 'limbo' };
		const sourceTitle = containerTitle(sourceContainer);
		const sourceSpots = target.flatNumber
			? sortedSpotNumbers(data.spots.filter((spot) => spot.flatNumber === target.flatNumber))
			: target.status === 'shared'
				? sortedSpotNumbers(sharedSpots)
				: sortedSpotNumbers(unassignedSpots);

		const sourceAvatar = containerAvatar(sourceContainer, isDark);

		let destination: FlightEndpoint | null = null;
		if (swapMode === 'lot' && swapFlatNumber) {
			const destContainer: SpotContainer = {
				kind: 'lot',
				flatNumber: swapFlatNumber,
				displayName: data.ownerNames?.[swapFlatNumber] ?? null
			};
			destination = {
				title: containerTitle(destContainer),
				avatar: containerAvatar(destContainer, isDark),
				spots: sortedSpotNumbers(
					data.spots.filter((spot) => spot.flatNumber === swapFlatNumber)
				)
			};
		} else if (swapMode === 'pool' && target.status !== 'shared') {
			destination = {
				title: containerTitle({ kind: 'pool' }),
				avatar: containerAvatar({ kind: 'pool' }, isDark),
				spots: sortedSpotNumbers(sharedSpots)
			};
		} else if (swapMode === 'limbo' && target.status !== 'unassigned') {
			destination = {
				title: containerTitle({ kind: 'limbo' }),
				avatar: containerAvatar({ kind: 'limbo' }, isDark),
				spots: sortedSpotNumbers(unassignedSpots),
				singleLine: true,
				showEllipsis: true
			};
		}
		if (!destination) {
			return {
				source: {
					title: sourceTitle,
					avatar: sourceAvatar,
					spots: [movingSpot, ...sourceSpots.filter((spot) => spot !== movingSpot)],
					singleLine: sourceIsPending,
					showEllipsis: sourceIsPending
				},
				destination: {
					title: swapMode === 'lot' ? 'Lot…' : 'Destination…',
					spots: [],
					muted: true
				},
				movingSpot,
				strikeSpot: null,
				move: null,
				ariaLabel:
					swapMode === 'lot'
						? `Aperçu : choisissez un lot pour la place ${movingSpot}`
						: `Aperçu : choisissez une destination pour la place ${movingSpot}`
			};
		}
		const validDestination = destination;
		return {
			source: {
				title: sourceTitle,
				avatar: sourceAvatar,
				spots: [movingSpot, ...sourceSpots.filter((spot) => spot !== movingSpot)],
				singleLine: sourceIsPending,
				showEllipsis: sourceIsPending
			},
			destination: {
				...validDestination,
				spots: validDestination.spots.filter((spot) => spot !== movingSpot)
			},
			movingSpot,
			strikeSpot: movingSpot,
			move: {
				key: `${movingSpot}|${target.status}|${target.flatNumber ?? ''}|${swapMode}|${swapFlatNumber}`,
				direction: 'forward',
				spot: movingSpot,
				showPreview: true
			},
			ariaLabel: `Aperçu : la place ${movingSpot} rejoint ${validDestination.title}`
		};
	});

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
	const spotPills = [
		{ value: 'shared', label: 'Partagées' },
		{ value: 'assigned', label: 'Attribuées' },
		{ value: 'unassigned', label: 'Non affectée' }
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
					unassigned: 'Aucune place non affectée.'
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

	async function addSpot(force = false) {
		if (!newSpotValid) return;

		const result = await apiFetch<{ conflicts?: unknown[] }>(
			'/api/spots',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					number: normalizedNewSpot,
					description: newSpotDescription.trim() || null,
					...(force ? { force: true } : {})
				})
			},
			"Impossible d'ajouter la place de parking"
		);

		if (result.ok) {
			toast.success(`Place de parking "${formatSpotNumber(normalizedNewSpot)}" ajoutée`);
			newSpotNumber = '';
			newSpotDescription = '';
			spotDialogOpen = false;
			invalidateAll();
		} else {
			if (result.status === 409 && (result.data?.conflicts?.length ?? 0) > 0) {
				// Race: bound after render — refresh so the inline transfer box appears
				toast.warning('Cette place vient d’être attribuée — données actualisées');
				invalidateAll();
			} else {
				notifyResult(result, null, "Impossible d'ajouter la place de parking");
			}
		}
	}

	async function deleteSpot(spotNumber: string) {
		const result = await apiFetch(
			`/api/spots/${encodeURIComponent(spotNumber)}`,
			{ method: 'DELETE' },
			'Impossible de supprimer la place de parking'
		);
		if (result.ok) {
			toast.success(`Place de parking "${spotNumber}" supprimée`);
			spotDetailOpen = false;
			spotDetailNum = null;
			invalidateAll();
		} else {
			notifyResult(result, null, 'Impossible de supprimer la place de parking');
		}
	}

	function confirmDeleteSpot(spotNumber: string) {
		confirmAction = { type: 'deleteSpot', spotNumber };
	}

	/** Siding move between pool and limbo (strand-checked server-side).
	 *  Returns whether the server accepted the move (callers close on true). */
	async function moveSpotStatus(spotNumber: string, status: 'shared' | 'unassigned'): Promise<boolean> {
		const result = await apiFetch(
			`/api/spots/${encodeURIComponent(spotNumber)}`,
			{
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status })
			},
			'Impossible de modifier la place'
		);
		if (result.ok) {
			toast.success(
				status === 'shared'
					? `Place de parking "${spotNumber}" mise en commun`
					: `Place de parking "${spotNumber}" non affectée`
			);
			invalidateAll();
			return true;
		} else {
			notifyResult(result, null, 'Impossible de modifier la place');
			return false;
		}
	}
	function showSwapSpot(s: (typeof data.spots)[0]) {
		swapTarget = s;
		swapFlatNumber = '';
		swapComboValue = '';
		swapSearchValue = '';
		swapComboOpen = false;
		swapMode = 'lot';
		openDialog = 'swapSpot';
	}

	async function executeSwap() {
		if (!swapTarget || !swapFlatNumber) return;
		swapLoading = true;
		const result = await apiFetch(
			'/api/admin/spots/swap',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					spotNumber: swapTarget.number,
					flatNumber: swapFlatNumber
				})
			},
			"Impossible d'affecter la place de parking"
		);
		if (result.ok) {
			toast.success(`Place de parking "${swapTarget.number}" assignée`);
			openDialog = null;
			swapTarget = null;
			invalidateAll();
		} else {
			notifyResult(result, null, "Impossible d'affecter la place de parking");
		}
		swapLoading = false;
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
			<Card.Description>Gérez les places partagées, les attributions et les places non affectées.</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			<FilterBar
				bind:search={spotQuery}
				groupLabel="Filtrer par statut"
				pills={spotPills.map((pill) => ({
					value: pill.value,
					label: pill.label,
					selected: selectedSpotStatuses.includes(pill.value),
					solidClass:
						pill.value === 'shared'
							? 'bg-primary on-solid border-transparent font-semibold'
							: pill.value === 'assigned'
								? 'bg-booking-busy on-solid border-transparent font-semibold'
								: 'bg-foreground on-solid border-transparent font-semibold',
					mutedClass:
						pill.value === 'shared'
							? 'bg-primary/15 text-primary hover:opacity-90'
							: pill.value === 'assigned'
								? 'bg-booking-busy/15 text-booking-busy hover:opacity-90'
								: 'bg-muted text-muted-foreground hover:opacity-90'
				}))}
				onToggle={toggleSpotStatus}
			/>
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

		<!-- Bourse aux places: staged drag-and-drop rebalancing across lots, pool, and pending -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Bourse aux places</Card.Title>
			<Card.Description>
				Sélectionnez des lots et des places, réorganisez-les par glisser-déposer, puis appliquez en une fois.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<SpotMercatoBoard spots={data.spots} flatOptions={data.flatOptions} />
		</Card.Content>
	</Card.Root>

<!-- Drawer: Spot detail -->
<DrawerShell
	bind:open={spotDetailOpen}
	onClose={(o) => {
		if (!o) {
			spotDetailNum = null;
			editingSpotDesc = false;
			// Deep link: closing drops ?spot= so refresh/back doesn't reopen.
			// The flag suppresses the deep-link effect until the navigation
			// lands — without it the effect reopens mid-exit (URL still has
			// ?spot=), churning vaul presence into orphaned overlays.
			const params = new URLSearchParams(window.location.search);
			if (params.has('spot')) {
				params.delete('spot');
				strippingSpotParam = true;
				goto(`?${params.toString()}`, { replaceState: true, keepFocus: true, noScroll: true });
			}
		}
	}}
>
		{#if spotDetail}
			{@const spotOwnerName = spotDetail.flatNumber
				? (data.ownerNames[spotDetail.flatNumber] ?? spotDetail.flatNumber)
				: null}
			{@const spotContainer = spotContainerFor(spotDetail)}
			{@const spotColor = containerAvatar(spotContainer, isDark).tint}
				<EntityHeaderCard title="Place {spotDetail.number}">
					{#snippet avatar()}
						<AvatarCircle tint={spotColor}>
							<CarFront class="h-6 w-6" />
						</AvatarCircle>
					{/snippet}
					{#snippet status()}
						{#if spotOwnerName}
							<StatusBadge status="assigned">Assignée</StatusBadge>
						{:else if spotDetail.status === 'unassigned'}
							<StatusBadge status="unassigned">Non affectée</StatusBadge>
						{:else}
							<StatusBadge status="shared">Partagée</StatusBadge>
						{/if}
					{/snippet}
				</EntityHeaderCard>

				<DetailSection title="Lot">
					{#if spotDetail.flatNumber}
						{@const lotColor = getFlatColor(spotDetail.flatNumber, isDark)}
						<DetailCard
							href="/admin/lots?lot={encodeURIComponent(spotDetail.flatNumber)}"
							class="hoverable-card"
						>
							<IdentityRow
								avatar={{ initial: spotDetail.flatNumber, tint: lotColor }}
								title={spotDetail.flatNumber}
								subtitle={spotOwnerName !== spotDetail.flatNumber ? spotOwnerName : null}
							>
								{#snippet trailing()}
									<ChevronRight class="h-4 w-4 shrink-0 text-muted-foreground" />
								{/snippet}
							</IdentityRow>
						</DetailCard>
					{:else if spotDetail.status === 'unassigned'}
						<DetailCard>
							<IdentityRow
								avatar={{ initial: '?', tint: null }}
								title="Pas encore assignée"
							/>
						</DetailCard>
					{:else if spotDetail.status === 'shared'}
						{@const poolCount = data.spots.filter((s) => s.status === 'shared').length}
						<DetailCard>
							<IdentityRow
								avatar={{ icon: Users, tint: containerAvatar({ kind: 'pool' }, isDark).tint }}
								title="Places partagées"
								subtitle="{poolCount} place{poolCount > 1 ? 's' : ''} partagée{poolCount > 1
									? 's'
									: ''} · réservable par tous"
								subtitleSize="xs"
							/>
						</DetailCard>
					{/if}
					<Button variant="outline" class="w-full mt-3" onclick={() => showSwapSpot(spotDetail)}>
						<ArrowLeftRight class="h-4 w-4 mr-2" />Affecter la place
					</Button>
					{#if spotDetail.status === 'unassigned'}
						<Button
							variant="default"
							class="w-full mt-2"
							onclick={() => moveSpotStatus(spotDetail.number, 'shared')}
						>
							<Check class="h-4 w-4 mr-2" />Mettre en commun
						</Button>
					{/if}
				</DetailSection>

				<DetailSection title="Informations">
					<DetailCard>
						<div>
							<p class="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Description</p>
							{#snippet descDisplay()}
								<p class="text-sm font-semibold break-words">
									{spotDetail.description ?? '—'}
								</p>
							{/snippet}
							<EditableField
								editing={editingSpotDesc}
								editable={false}
								editLabel="Modifier la description"
								onStart={() => {
									// Required but unused: all commit buttons live below the content
								}}
								multiline
								rows={3}
								hideCommitIcon
								bind:value={spotDescDraft}
								initial={spotDetail.description ?? ''}
								placeholder="ex. Place handicapée"
								ariaLabel="Description de la place"
								inputClass="text-sm"
								committable
								disabled={savingSpotDesc}
								focusOnOpen={editingSpotDesc}
								onCommit={commitSpotDescription}
								onCancel={() => (editingSpotDesc = false)}
								display={descDisplay}
							/>
							{#if editingSpotDesc}
								<div class="flex justify-end gap-1 mt-2">
									<IconButton
										icon={Check}
										label="Valider"
										tone="success"
										disabled={savingSpotDesc}
										onclick={commitSpotDescription}
									/>
									<IconButton
										icon={X}
										label="Annuler"
										disabled={savingSpotDesc}
										onclick={() => (editingSpotDesc = false)}
									/>
								</div>
							{:else}
									<div class="flex justify-end gap-1 mt-2">
										<IconButton
											icon={Pencil}
											label="Modifier la description"
											onclick={() => {
												spotDescDraft = spotDetail.description ?? '';
												editingSpotDesc = true;
											}}
										/>
									</div>
								{/if}
						</div>
					</DetailCard>
				</DetailSection>

				<DetailSection title="Cycle de vie">
					<FlatLifecycleCard
						createdAt={spotDetail.createdAt}
						createdLabel="Ajoutée le"
						pendingLabel={null}
					/>
				</DetailSection>
				<DrawerActionFooter
					actions={[
						...(!spotDetail.flatNumber && spotDetail.status === 'shared'
							? [
									{
										label: 'Retirer des places partagées',
										icon: Undo2,
										tone: 'secondary' as const,
										onclick: () => moveSpotStatus(spotDetail.number, 'unassigned')
									}
								]
							: []),
						{
							label: 'Supprimer la place',
							icon: Trash2,
							tone: 'destructive',
							onclick: () => confirmDeleteSpot(spotDetail.number)
						}
					]}
				/>
		{/if}
</DrawerShell>

<!-- Dialog: Ajouter -->
<DialogShell
	kind="dialog"
	open={spotDialogOpen}
	onClose={() => (spotDialogOpen = false)}
>
	<DialogHeader
		kind="dialog"
		icon={CarFront}
		title="Ajouter une place de parking"
		subtitle="La place sera créée sans affectation."
		onClose={() => (spotDialogOpen = false)}
	/>
		<div class="space-y-4">
			<FlatTextField
				label="Numéro"
				placeholder="ex. 36"
				uppercase
				maxlength={2}
				bind:value={newSpotNumber}
				error={newSpotNumber && !newSpotValid
					? 'Format requis : 1 ou 2 chiffres (ex. 3, 01, 36)'
					: null}
			/>
			<FlatTextField
				label="Description"
				placeholder="ex. Place de parking handicapée"
				required={false}
				bind:value={newSpotDescription}
			/>
			{#if shareConflictHolder}
				<div class="notice-warning text-sm">
					<p>
						Place <strong>{formatSpotNumber(normalizedNewSpot)}</strong> attribuée au lot
						<strong>{shareConflictHolder}</strong>.
					</p>
					<p class="text-muted-foreground">La libérer vers les places partagées ?</p>
					<div class="mt-2 flex gap-2">
						<Button size="sm" variant="default" onclick={() => addSpot(true)}>
							Libérer la place
						</Button>
						<Button size="sm" variant="outline" onclick={() => (newSpotNumber = '')}>Annuler</Button>
					</div>
				</div>
			{/if}
		</div>
		<Dialog.Footer class={DIALOG_FOOTER_CLASS}>
			<Button variant="outline" onclick={() => (spotDialogOpen = false)}>Annuler</Button>
			<Button variant="default" onclick={() => addSpot()} disabled={!newSpotValid || shareConflictHolder !== null}>Ajouter</Button>
		</Dialog.Footer>
	</DialogShell>

<!-- Dialog: Affecter une place (lot / places partagées / non affectée) -->
<DialogShell
	kind="dialog"
	size="md"
	open={openDialog === 'swapSpot'}
	onClose={() => {
		openDialog = null;
		swapTarget = null;
	}}
>
	{#if swapTarget}
		<DialogHeader
			kind="dialog"
			icon={ArrowLeftRight}
			title={`Affecter la place de parking ${swapTarget.number}`}
			subtitle="Choisissez la destination de cette place."
			onClose={() => {
				openDialog = null;
				swapTarget = null;
			}}
		/>
			<div class="space-y-4">
				<div class="space-y-2" role="radiogroup" aria-label="Destination">
					<RadioCardRow
						name="swap-destination"
						value="lot"
						checked={swapMode === 'lot'}
						onSelect={() => (swapMode = 'lot')}
						icon={House}
						title="Un lot"
						subtitle="Assigner à un lot existant"
					>
						{#snippet children()}
							{#if swapMode === 'lot'}
								<div class="w-44 shrink-0">
									<div class="flex items-center gap-2">
										<Label for="swap-flat" class="shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wide">
											Lot
										</Label>
										{#if data.flatOptions.length > 0}
											<div class="min-w-0 flex-1">
												<Combobox.Root
													type="single"
													bind:value={swapComboValue}
													bind:open={swapComboOpen}
													items={filteredSwapFlatItems}
													onValueChange={(v) => {
														if (v) swapFlatNumber = v;
													}}
													onOpenChangeComplete={(open) => {
														if (!open) swapSearchValue = '';
													}}
												>
													<SearchField
														value={swapSearchValue}
														onClear={() => {
															swapSearchValue = '';
															swapComboOpen = false;
														}}
														class="w-full"
													>
													<Combobox.Input
														id="swap-flat"
														bind:ref={swapComboInputEl}
														oninput={(e) => {
															if (swapComboRetriggering) return;
															swapSearchValue = e.currentTarget.value;
															swapComboOpen = e.currentTarget.value.trim().length > 0;
														}}
													placeholder="Rechercher…"
													class="dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full min-w-0 rounded-lg border bg-transparent py-1 pr-8 pl-8 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-3 md:text-sm"
													/>
													</SearchField>
													<Combobox.Portal>
														<Combobox.Content
															class="bg-popover text-popover-foreground border-border z-[60] w-[var(--bits-combobox-anchor-width)] min-w-52 rounded-lg border shadow-md"
															sideOffset={4}
														>
															<Combobox.Viewport class="p-1">
																{#each filteredSwapFlatItems as item (item.value)}
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
											</div>
										{:else}
											<span class="text-muted-foreground min-w-0 flex-1 text-sm">Aucun lot configuré.</span>
										{/if}
									</div>
								</div>
							{/if}
						{/snippet}
					</RadioCardRow>

					{#if swapTarget.status !== 'shared'}
						<RadioCardRow
							name="swap-destination"
							value="pool"
							checked={swapMode === 'pool'}
							onSelect={() => (swapMode = 'pool')}
							icon={Users}
							title="Places partagées"
							subtitle="Deviendra réservable"
						/>
					{/if}

					{#if swapTarget.status !== 'unassigned'}
						<RadioCardRow
							name="swap-destination"
							value="limbo"
							checked={swapMode === 'limbo'}
							onSelect={() => (swapMode = 'limbo')}
							icon={Clock}
							title="Non affectée"
							subtitle="Sans affectation pour l'instant"
						/>
					{/if}
				</div>
				{#if operationPreview}
					<SpotFlightStrip
						source={operationPreview.source}
						destination={operationPreview.destination}
						move={operationPreview.move}
						strikeSpot={operationPreview.strikeSpot}
						spotStatusOf={spotStatusOf}
						ariaLabel={operationPreview.ariaLabel}
					/>
				{/if}
			</div>
		{/if}
		<Dialog.Footer class={DIALOG_FOOTER_CLASS}>
			<Button variant="outline" onclick={() => (openDialog = null)}>Annuler</Button>
			{#if !swapTarget || swapMode === 'lot'}
				<Button
					variant="default"
					onclick={executeSwap}
					disabled={!swapTarget || !swapFlatNumber || swapLoading}
				>
					Appliquer
				</Button>
			{:else if swapMode === 'pool'}
				<Button
					variant="default"
					onclick={async () => {
						if (!swapTarget) return;
						if (await moveSpotStatus(swapTarget.number, 'shared')) openDialog = null;
					}}
				>
					Appliquer
				</Button>
			{:else}
				<Button
					variant="default"
					onclick={async () => {
						if (!swapTarget) return;
						if (await moveSpotStatus(swapTarget.number, 'unassigned')) openDialog = null;
					}}
				>
					Appliquer
				</Button>
			{/if}
		</Dialog.Footer>
	</DialogShell>

<!-- Confirmation dialog (shared) -->
<ConfirmDialog action={confirmAction} onClose={() => (confirmAction = null)} onExecute={executeConfirmAction} />
