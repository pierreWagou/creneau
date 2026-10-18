<script lang="ts">
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import { mode } from 'mode-watcher';
	import { onDestroy, onMount, tick } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import BookingCancelDialog from '$lib/components/booking-cancel-dialog.svelte';
	import BookingDrawer from '$lib/components/booking-drawer.svelte';
	import BookingEditDialog from '$lib/components/booking-edit-dialog.svelte';
	import BookingTicketCard from '$lib/components/booking-ticket-card.svelte';
	import CountBadge from '$lib/components/count-badge.svelte';
	import EmptyState from '$lib/components/empty-state.svelte';
	import PageColumn from '$lib/components/page-column.svelte';
	import PaginationNav from '$lib/components/pagination-nav.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { BOOKINGS_PAGE_SIZE } from '$lib/constants';
	import { spotChipProps } from '$lib/spot-containers';
	import { createBookingDeepLink } from '$lib/utils/booking-deep-link.svelte';
	import { findBookingById, splitBookingsByLiveness } from '$lib/utils/bookings';
	import { createBookingSSE } from '$lib/utils/sse';

	let { data } = $props();

	let sse: ReturnType<typeof createBookingSSE> | null = null;
	let cancellingBookingId = $state<number | null>(null);
	let selectedBookingId = $state<number | null>(null);
	// Visibility source for the drawer (the content id persists through the
	// exit animation so the panel never slides out empty).
	let drawerOpen = $state(false);
	let editingBookingId = $state<number | null>(null);
	let pastPage = $state(1);
	const isDark = $derived(mode.current === 'dark');

	// Drawer deep link (?booking=id): highlight + scroll via the shared helper,
	// with auto-open + URL sync mirroring the admin Réservations tab.
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

	function confirmCancel(id: number) {
		cancellingBookingId = id;
	}

	const selectedBooking = $derived(findBookingById(data.bookings, selectedBookingId) ?? null);
	const editBooking = $derived(findBookingById(data.bookings, editingBookingId) ?? null);

	function openDrawer(
		booking: { id: number; startTime: string; endTime: string; note?: string | null },
		pushUrl = true
	) {
		selectedBookingId = booking.id;
		drawerOpen = true;
		if (pushUrl) {
			const params = new URLSearchParams(window.location.search);
			params.set('booking', String(booking.id));
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

	// Séparer en à venir et passées (ongoing first chronologically = same order)
	const split = $derived(splitBookingsByLiveness(data.bookings));
	// Cancelled bookings stay hidden unless the toggle asks for them.
	let showCancelled = $state(false);
	const hasCancelled = $derived(data.bookings.some((b) => b.status === 'cancelled'));
	const upcoming = $derived(
		[...split.ongoing, ...split.upcoming].filter((b) => showCancelled || b.status !== 'cancelled')
	);
	const past = $derived(split.past.filter((b) => showCancelled || b.status !== 'cancelled'));

	const pastTotalPages = $derived(Math.max(1, Math.ceil(past.length / BOOKINGS_PAGE_SIZE)));
	const pastItems = $derived(past.slice((pastPage - 1) * BOOKINGS_PAGE_SIZE, pastPage * BOOKINGS_PAGE_SIZE));

	// Step back when the list shrinks below the page (e.g. after data refresh).
	$effect(() => {
		if (pastPage > pastTotalPages) pastPage = pastTotalPages;
	});

	// Deep link (?booking=id): open the drawer on load and on back/forward.
	// Upcoming is unpaginated; past bookings resolve their page first.
	// Unknown ids drop the param. data.bookings holds own bookings only,
	// so ownership holds by construction.
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
		const pastIndex = past.findIndex((b) => b.id === target.id);
		if (pastIndex >= 0) {
			pastPage = Math.floor(pastIndex / BOOKINGS_PAGE_SIZE) + 1;
		}
		openDrawer(target, false);
		tick().then(() => {
			deepLink.scrollToHighlighted();
		});
	});

	function dropBookingParam() {
		const params = new URLSearchParams(window.location.search);
		params.delete('booking');
		goto(`?${params.toString()}`, { replaceState: true, keepFocus: true, noScroll: true });
	}
</script>

<PageColumn>
	<div class="flex items-center justify-between gap-3">
		<h2 class="page-title">Mes réservations</h2>
		{#if hasCancelled}
			<Button variant="outline" size="sm" onclick={() => (showCancelled = !showCancelled)}>
				{showCancelled ? 'Masquer les annulées' : 'Afficher les annulées'}
			</Button>
		{/if}
	</div>

	{#if upcoming.length === 0 && past.length === 0}
		<EmptyState
			icon={CalendarDays}
			title="Aucune réservation"
			message="Réservez une place partagée en quelques secondes."
		>
			<a href="/book">
				<Button variant="default">Réserver une place de parking</Button>
			</a>
		</EmptyState>
	{/if}

	{#if upcoming.length > 0}
		{@const next = upcoming[0]}
		{@const rest = upcoming.slice(1)}
		<Card.Root>
			<Card.Header>
				<Card.Title class="card-title-row">
					À venir
					<CountBadge count={upcoming.length} />
				</Card.Title>
			</Card.Header>
			<Card.Content>
				<div class="space-y-3">
					<BookingTicketCard
						variant="hero"
						bookingId={next.id}
						spotNumber={next.spotNumber}
						startTime={next.startTime}
						endTime={next.endTime}
						status={next.status}
						highlighted={deepLink.highlightedId === String(next.id)}
						{...spotChipProps(data.spots, next.spotNumber, isDark)}
						onOpen={() => openDrawer(next)}
					/>
					{#each rest as booking (booking.id)}
						<BookingTicketCard
							variant="standard"
						bookingId={booking.id}
						spotNumber={booking.spotNumber}
						startTime={booking.startTime}
						endTime={booking.endTime}
						status={booking.status}
						highlighted={deepLink.highlightedId === String(booking.id)}
						{...spotChipProps(data.spots, booking.spotNumber, isDark)}
						onOpen={() => openDrawer(booking)}
					/>
					{/each}
				</div>
			</Card.Content>
		</Card.Root>
	{/if}

	{#if past.length > 0}
		<Card.Root>
			<Card.Header>
				<Card.Title class="text-muted-foreground flex items-center gap-2">
					Passées
					<CountBadge count={past.length} tone="muted" />
				</Card.Title>
			</Card.Header>
			<Card.Content>
				<div class="space-y-3">
					{#each pastItems as booking (booking.id)}
						<BookingTicketCard
							variant="past"
						bookingId={booking.id}
						spotNumber={booking.spotNumber}
						startTime={booking.startTime}
						endTime={booking.endTime}
						status={booking.status}
						highlighted={deepLink.highlightedId === String(booking.id)}
						{...spotChipProps(data.spots, booking.spotNumber, isDark)}
						onOpen={() => openDrawer(booking)}
					/>
					{/each}
					{#if pastTotalPages > 1}
						<div class="flex justify-end">
							<PaginationNav page={pastPage} totalPages={pastTotalPages} onPage={(p) => (pastPage = p)} />
						</div>
					{/if}
				</div>
			</Card.Content>
		</Card.Root>
	{/if}
</PageColumn>

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
