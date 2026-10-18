<script lang="ts">
	import { isPast, parseISO } from 'date-fns';
	import { mode } from 'mode-watcher';
	import { onDestroy, onMount, tick } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import BookingCancelDialog from '$lib/components/booking-cancel-dialog.svelte';
	import BookingDrawer from '$lib/components/booking-drawer.svelte';
	import BookingEditDialog from '$lib/components/booking-edit-dialog.svelte';
	import BookingTicketCard from '$lib/components/booking-ticket-card.svelte';
	import FilterBar from '$lib/components/filter-bar.svelte';
	import PaginationNav from '$lib/components/pagination-nav.svelte';
	import SearchField from '$lib/components/search-field.svelte';
	import * as Card from '$lib/components/ui/card';
	import { BOOKINGS_PAGE_SIZE } from '$lib/constants';
	import { spotChipProps } from '$lib/spot-containers';
	import { createBookingDeepLink } from '$lib/utils/booking-deep-link.svelte';
	import { findBookingById, splitBookingsByLiveness } from '$lib/utils/bookings';
	import { createBookingSSE } from '$lib/utils/sse';
	import { bookingLiveness } from '$lib/utils/time';

	let { data } = $props();

	let sse: ReturnType<typeof createBookingSSE> | null = null;
	let searchInput = $state('');
	let selectedLiveness = $state<('ongoing' | 'upcoming' | 'past')[]>([]);
	let listPage = $state(1);
	let selectedBookingId = $state<number | null>(null);
	// Visibility source for the drawer (the content id persists through the
	// exit animation so the panel never slides out empty).
	let drawerOpen = $state(false);
	let editingBookingId = $state<number | null>(null);
	let cancellingBookingId = $state<number | null>(null);
	const isDark = $derived(mode.current === 'dark');

	// Drawer deep link (?booking=id): highlight + scroll via the shared helper,
	// with admin-only auto-open + URL sync in the effect below.
	const deepLink = createBookingDeepLink();

	onMount(() => {
		sse = createBookingSSE({
			onCreated: () => invalidateAll(),
			onCancelled: () => invalidateAll(),
			onUpdated: () => invalidateAll()
		});
		deepLink.scrollToHighlighted();
	});

	onDestroy(() => {
		sse?.destroy();
	});

	const selectedBooking = $derived(findBookingById(data.bookings, selectedBookingId) ?? null);
	const editBooking = $derived(findBookingById(data.bookings, editingBookingId) ?? null);

	function openDrawer(id: number, pushUrl = true) {
		selectedBookingId = id;
		drawerOpen = true;
		if (pushUrl) {
			const params = new URLSearchParams(window.location.search);
			params.set('booking', String(id));
			goto(`?${params.toString()}`, { keepFocus: true, noScroll: true });
		}
	}

	// Stripped on close; the param effect must not reopen mid-flight.
	let strippingBookingParam = false;
	function closeDrawer() {
		drawerOpen = false;
		if (page.url.searchParams.has('booking')) {
			strippingBookingParam = true;
			const params = new URLSearchParams(window.location.search);
			params.delete('booking');
			goto(`?${params.toString()}`, { replaceState: true, keepFocus: true, noScroll: true });
		}
	}

	/** Modifier opens the edit dialog over the open drawer (drawer untouched — cf. conflict dialog). */
	function openEditDialog(id: number) {
		editingBookingId = id;
	}

	function confirmCancel(id: number) {
		cancellingBookingId = id;
	}

	function toggleLiveness(value: 'ongoing' | 'upcoming' | 'past') {
		selectedLiveness = selectedLiveness.includes(value)
			? selectedLiveness.filter((s) => s !== value)
			: [...selectedLiveness, value];
	}

	const q = $derived(searchInput.trim().toLowerCase());
	const filtered = $derived(
		q
			? data.bookings.filter((b) =>
					[b.spotNumber, b.flatNumber, b.flatDisplayName ?? '', b.note ?? ''].some((v) =>
						v.toLowerCase().includes(q)
					)
				)
			: data.bookings
	);

	const split = $derived(splitBookingsByLiveness(filtered));
	const ongoing = $derived(split.ongoing);
	const upcoming = $derived(split.upcoming);
	const past = $derived(split.past);

	// One list, most recent start on top. Empty selection shows everything.
	const visible = $derived(
		(selectedLiveness.length === 0
			? [...ongoing, ...upcoming, ...past]
			: [
					...(selectedLiveness.includes('ongoing') ? ongoing : []),
					...(selectedLiveness.includes('upcoming') ? upcoming : []),
					...(selectedLiveness.includes('past') ? past : [])
				]
		).sort((a, b) => b.startTime.localeCompare(a.startTime))
	);

	const totalPages = $derived(Math.max(1, Math.ceil(visible.length / BOOKINGS_PAGE_SIZE)));
	const pageItems = $derived(visible.slice((listPage - 1) * BOOKINGS_PAGE_SIZE, listPage * BOOKINGS_PAGE_SIZE));

	// Reset to page 1 when the list scope changes; step back when it shrinks.
	// Skipped while resolving a deep link (the resolver sets its own page).
	let resolvingDeepLink = false;
	$effect(() => {
		searchInput;
		selectedLiveness;
		if (resolvingDeepLink) return;
		listPage = 1;
	});
	$effect(() => {
		if (listPage > totalPages) listPage = totalPages;
	});

	// Deep link (?booking=id): open the drawer on load and on back/forward,
	// resolving filter + page first (same auto-open + URL sync as my-bookings).
	// Unknown ids drop the param.
	$effect(() => {
		const raw = page.url.searchParams.get('booking');
		data.bookings;
		if (!raw) {
			strippingBookingParam = false; // strip landed — re-arm
			// Back button out of the drawer: URL lost ?booking= while it is
			// still open — close it.
			if (drawerOpen) closeDrawer();
			return;
		}
		if (strippingBookingParam) return; // close in flight — do NOT reopen
		if (!/^\d+$/.test(raw)) {
			dropBookingParam();
			return;
		}
		const id = Number(raw);
		if (drawerOpen && selectedBookingId === id) return; // already open — hold (no resolve churn)
		const target = findBookingById(data.bookings, id);
		if (!target) {
			dropBookingParam();
			return;
		}
		const liveness = bookingLiveness(target.startTime, target.endTime);
		const scope = data.bookings
			.filter((b) => bookingLiveness(b.startTime, b.endTime) === liveness)
			.sort((a, b) => b.startTime.localeCompare(a.startTime));
		resolvingDeepLink = true;
		searchInput = '';
		selectedLiveness = [liveness];
		listPage = Math.floor(scope.findIndex((b) => b.id === target.id) / BOOKINGS_PAGE_SIZE) + 1;
		openDrawer(target.id, false);
		tick().then(() => {
			deepLink.scrollToHighlighted();
			resolvingDeepLink = false;
		});
	});

	function dropBookingParam() {
		const params = new URLSearchParams(window.location.search);
		params.delete('booking');
		goto(`?${params.toString()}`, { replaceState: true, keepFocus: true, noScroll: true });
	}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>Réservations</Card.Title>
		<Card.Description>Toutes les réservations des résidents, à venir et passées.</Card.Description>
	</Card.Header>
	<Card.Content class="space-y-4">
	<FilterBar
		bind:search={searchInput}
		groupLabel="Filtrer par période"
		pills={[
			{
				value: 'upcoming',
				label: 'À venir',
				selected: selectedLiveness.includes('upcoming'),
				solidClass: 'bg-success on-solid border-transparent font-semibold',
				mutedClass: 'bg-success/15 text-success hover:opacity-90'
			},
			{
				value: 'ongoing',
				label: 'En cours',
				selected: selectedLiveness.includes('ongoing'),
				solidClass: 'bg-primary on-solid border-transparent font-semibold',
				mutedClass: 'bg-primary/15 text-primary hover:opacity-90'
			},
			{
				value: 'past',
				label: 'Passées',
				selected: selectedLiveness.includes('past'),
				solidClass: 'bg-foreground on-solid border-transparent font-semibold',
				mutedClass: 'bg-muted text-muted-foreground hover:opacity-90'
			}
		]}
		onToggle={toggleLiveness}
	/>

	{#if ongoing.length + upcoming.length + past.length === 0}
		<p class="text-muted-foreground text-sm">
			{q ? 'Aucune réservation ne correspond à cette recherche.' : "Il n'y a aucune réservation."}
		</p>
	{:else}
		{#if visible.length === 0}
			<p class="text-muted-foreground text-sm">Aucune réservation ne correspond à ce filtre.</p>
		{:else}
			<div class="grid gap-3 sm:grid-cols-2">
				{#each pageItems as booking (booking.id)}
					{@const isPastBooking = isPast(parseISO(booking.endTime))}
					<BookingTicketCard
						variant={isPastBooking ? 'past' : 'standard'}
						bookingId={booking.id}
						spotNumber={booking.spotNumber}
						startTime={booking.startTime}
						endTime={booking.endTime}
						status={booking.status}
						highlighted={deepLink.highlightedId === String(booking.id)}
						{...spotChipProps(data.spots, booking.spotNumber, isDark)}
						onOpen={() => openDrawer(booking.id)}
					/>
				{/each}
			</div>
			{#if totalPages > 1}
				<div class="flex justify-end">
					<PaginationNav page={listPage} totalPages={totalPages} onPage={(p) => (listPage = p)} />
				</div>
			{/if}
		{/if}
	{/if}
	</Card.Content>
</Card.Root>

<!-- Dialog: Cancel confirmation -->
<BookingCancelDialog
	bookingId={cancellingBookingId}
	onClose={() => (cancellingBookingId = null)}
	onCancelled={() => {
		invalidateAll();
		drawerOpen = false;
	}}
/>

<!-- Shared booking drawer (detail + Modifier/Annuler) -->
<BookingDrawer
	open={drawerOpen}
	onClose={(o) => {
		if (!o) {
			closeDrawer();
		}
	}}
	booking={selectedBooking}
	canModify
	lotHref={selectedBooking ? `/admin/lots?lot=${encodeURIComponent(selectedBooking.flatNumber)}` : null}
	spotHref={selectedBooking ? `/admin/spots?spot=${encodeURIComponent(selectedBooking.spotNumber)}` : null}
	onEdit={openEditDialog}
	onCancel={confirmCancel}
	onNoteChanged={() => invalidateAll()}
/>

<!-- Edit dialog stacks over the open drawer (drawer untouched — cf. conflict dialog) -->
<BookingEditDialog
	booking={editBooking}
	spots={data.spots}
	{isDark}
	onClose={() => (editingBookingId = null)}
	onSaved={() => invalidateAll()}
/>
