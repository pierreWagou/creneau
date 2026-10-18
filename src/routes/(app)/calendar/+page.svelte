<script lang="ts">
	import { Calendar, DayGrid, Interaction, TimeGrid } from '@event-calendar/core';
	import { computePosition, flip, offset, shift } from '@floating-ui/dom';
	import './calendar.css';
import CirclePlus from '@lucide/svelte/icons/circle-plus';
	import { format, parseISO } from 'date-fns';
	import { mode } from 'mode-watcher';
	import { onDestroy, onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { getFlatColor, latte, mocha } from '$lib/colors';
	import BookingCancelDialog from '$lib/components/booking-cancel-dialog.svelte';
	import BookingDrawer from '$lib/components/booking-drawer.svelte';
	import BookingEditDialog from '$lib/components/booking-edit-dialog.svelte';
	import EmptyState from '$lib/components/empty-state.svelte';
	import { Button } from '$lib/components/ui/button';
	import { MOBILE_BREAKPOINT_PX, POPOVER_OFFSET_PX, TOAST_DURATION_MS, TOOLTIP_DELAY_MS, TOOLTIP_OFFSET_PX } from '$lib/constants';
	import { spotChipProps } from '$lib/spot-containers';
	import { type BookingWithFlat, DAY_END, DAY_START } from '$lib/types';
	import { apiFetch } from '$lib/utils/api';
	import { findBookingById } from '$lib/utils/bookings';
	import { createBookingSSE } from '$lib/utils/sse';
import { formatDateISO, getHourFromISO, padH, toISOLocal } from '$lib/utils/time';
	import { notifyResult } from '$lib/utils/toasts';
	import '@event-calendar/core/index.css';

	let { data } = $props();

	let isMobile = $state(false);
	let sse: ReturnType<typeof createBookingSSE> | null = null;

	// Track dark mode for the calendar container class
	let isDark = $derived(mode.current === 'dark');

	// Visible range for the stacked month/year header title (pushed onto the
	// library h2 as data attributes — see calendar.css — since event-calendar
	// exposes no custom title renderer).
	const initialDateParam = $page.url.searchParams.get('date');
	let viewStart = $state<Date>(initialDateParam ? new Date(initialDateParam) : new Date());
	let viewEnd = $state<Date>(initialDateParam ? new Date(initialDateParam) : new Date());
	// Anchor for the stacked month/year header title: the range midpoint, so month
	// view (whose range starts on a Monday of the previous month) titles the
	// viewed month instead of the leading week.
	const titleAnchor = $derived(new Date((viewStart.getTime() + viewEnd.getTime()) / 2));
	const titleMonth = $derived(titleAnchor.toLocaleDateString('fr-FR', { month: 'long' }));
	const titleYear = $derived(titleAnchor.getFullYear());

	function syncTitleAttributes() {
		const title = document.querySelector('.ec-container .ec-title');
		if (!title) return;
		title.setAttribute('data-month', titleMonth);
		title.setAttribute('data-year', String(titleYear));
	}

	$effect(() => {
		// Track both so the attributes refresh on any range change.
		titleMonth;
		titleYear;
		syncTitleAttributes();
	});

	// --- Drawer state (shared booking detail) ---
	let selectedBookingId = $state<number | null>(null);
	let editingBookingId = $state<number | null>(null);
	let cancellingBookingId = $state<number | null>(null);

	// --- Tooltip state ---
	let tooltipBooking = $state<BookingWithFlat | null>(null);
	let tooltipEl = $state<HTMLDivElement | null>(null);
	let tooltipAnchorEl: HTMLElement | null = null;
	let tooltipTimeout: ReturnType<typeof setTimeout> | null = null;

	// Convert bookings to calendar events
	function bookingsToEvents(bookings: BookingWithFlat[]) {
		const now = new Date();
		return bookings.map((b) => {
			const isOwn = b.flatNumber === data.flat.number;
			const isPast = new Date(b.endTime) < now;
			return {
				id: String(b.id),
				start: b.startTime,
				end: b.endTime,
				title: '',
				startEditable: isOwn && !isPast,
				durationEditable: isOwn && !isPast,
				classNames: isPast ? ['ec-event-past'] : [],
				backgroundColor: getFlatColor(b.flatNumber, isDark),
				textColor: isDark ? mocha.base : latte.base,
				extendedProps: { booking: b }
			};
		});
	}

	let bookings = $state<BookingWithFlat[]>(data.bookings);
	let events = $derived(bookingsToEvents(bookings));

	function checkMobile() {
		isMobile = window.innerWidth < MOBILE_BREAKPOINT_PX;
	}

	// --- Formatting helpers ---
	function formatTooltipLine(booking: BookingWithFlat): string {
		const name = booking.flatDisplayName
			? `${booking.flatNumber} — ${booking.flatDisplayName}`
			: booking.flatNumber;
		const s = parseISO(booking.startTime);
		const e = parseISO(booking.endTime);
		return `${name} · ${format(s, "HH'h'mm")}–${format(e, "HH'h'mm")}`;
	}

	// --- Popover positioning ---
	async function positionTooltip() {
		if (!tooltipEl || !tooltipAnchorEl) return;
		const { x, y } = await computePosition(tooltipAnchorEl, tooltipEl, {
			placement: 'top',
			middleware: [offset(TOOLTIP_OFFSET_PX), flip(), shift({ padding: POPOVER_OFFSET_PX })]
		});
		tooltipEl.style.left = `${x}px`;
		tooltipEl.style.top = `${y}px`;
	}

	// --- Event handlers ---
	function handleEventClick(info: any) {
		info.jsEvent.preventDefault();
		info.jsEvent.stopPropagation();

		// Close tooltip if open
		tooltipBooking = null;
		if (tooltipTimeout) clearTimeout(tooltipTimeout);

		const booking = info.event.extendedProps.booking as BookingWithFlat;
		selectedBookingId = booking.id;
	}

	function handleEventMouseEnter(info: any) {
		const booking = info.event.extendedProps.booking as BookingWithFlat;
		tooltipAnchorEl = info.el;

		// Show after 300ms delay
		if (tooltipTimeout) clearTimeout(tooltipTimeout);
		tooltipTimeout = setTimeout(() => {
			tooltipBooking = booking;
			requestAnimationFrame(() => positionTooltip());
		}, TOOLTIP_DELAY_MS);
	}

	function handleEventMouseLeave() {
		if (tooltipTimeout) clearTimeout(tooltipTimeout);
		tooltipBooking = null;
	}

	const selectedBooking = $derived(findBookingById(bookings, selectedBookingId) ?? null);
	const editBooking = $derived(findBookingById(bookings, editingBookingId) ?? null);

	function confirmCancel(id: number) {
		cancellingBookingId = id;
	}

	/** Modifier opens the edit dialog over the open drawer (drawer untouched — cf. conflict dialog). */
	function openEditDialog(id: number) {
		editingBookingId = id;
	}

	// --- Drag & Resize ---
	async function handleEventUpdate(info: any) {
		const booking = info.event.extendedProps.booking as BookingWithFlat;

		// Reject if not own booking
		if (booking.flatNumber !== data.flat.number) {
			info.revert();
			toast.error('Vous ne pouvez déplacer que vos propres réservations');
			return;
		}

		const newStart = toISOLocal(info.event.start);
		const newEnd = toISOLocal(info.event.end);

		// Reject if the booking has already ended
		if (new Date(booking.endTime) < new Date()) {
			info.revert();
			toast.error('Impossible de modifier une réservation passée');
			return;
		}

		// Prevent moving to the past
		if (new Date(newStart) < new Date()) {
			info.revert();
			toast.error('Impossible de placer une réservation dans le passé');
			return;
		}

		const oldStart = booking.startTime;
		const oldEnd = booking.endTime;

		const result = await apiFetch<{ booking: BookingWithFlat }>(
			`/api/bookings/${booking.id}`,
			{
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ startTime: newStart, endTime: newEnd })
			},
			'Impossible de modifier la réservation'
		);

		if (result.ok && result.data) {
			const { booking: updated } = result.data;
			bookings = bookings.map((b) => (b.id === updated.id ? updated : b));
			toast.success('Réservation modifiée', {
				action: {
					label: 'Annuler',
					onClick: () => undoMove(booking.id, oldStart, oldEnd)
				},
				duration: TOAST_DURATION_MS
			});
		} else if (!result.ok) {
			info.revert();
			notifyResult(result, null, 'Impossible de modifier la réservation');
		}
	}

	async function undoMove(bookingId: number, startTime: string, endTime: string) {
		const result = await apiFetch<{ booking: BookingWithFlat }>(
			`/api/bookings/${bookingId}`,
			{
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ startTime, endTime })
			},
			"Le créneau original n'est plus disponible"
		);

		if (result.ok && result.data) {
			const { booking: updated } = result.data;
			bookings = bookings.map((b) => (b.id === updated.id ? updated : b));
			toast.success('Modification annulée');
		} else if (!result.ok) {
			notifyResult(result, null, "Le créneau original n'est plus disponible");
			invalidateAll();
		}
	}

	// --- Lifecycle ---
	onMount(() => {
		checkMobile();
		window.addEventListener('resize', checkMobile);

		fitSlotHeight();
		if (gridWrap && typeof ResizeObserver !== 'undefined') {
			fitObserver = new ResizeObserver(() => fitSlotHeight());
			fitObserver.observe(gridWrap);
		}

		sse = createBookingSSE({
			onCreated: (booking) => {
				bookings = [...bookings, booking];
			},
			onCancelled: (data) => {
				bookings = bookings.filter((b) => b.id !== data.id);
				if (selectedBookingId === data.id) selectedBookingId = null;
			},
			onUpdated: (updated) => {
				bookings = bookings.map((b) => (b.id === updated.id ? updated : b));
			}
		});
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('resize', checkMobile);
		}
		sse?.destroy();
		fitObserver?.disconnect();
		if (tooltipTimeout) clearTimeout(tooltipTimeout);
	});

	function handleDateClick(info: any) {
		if (info.date instanceof Date) {
			const date = formatDateISO(info.date);
			const hour = info.date.getHours();
			const params = new URLSearchParams();
			params.set('date', date);
			if (hour >= 0 && hour < 24) {
				params.set('startHour', String(hour));
			}
			goto(`/book?${params.toString()}`);
		}
	}

	function handleSelect(info: any) {
		const start = info.start;
		const end = info.end;
		if (!start || !end) return;

		const startDate = start instanceof Date ? formatDateISO(start) : String(start).split('T')[0];
		let endDate = end instanceof Date ? formatDateISO(end) : String(end).split('T')[0];
		const startHour = start instanceof Date ? start.getHours() : getHourFromISO(String(start));
		let endHour = end instanceof Date ? end.getHours() : getHourFromISO(String(end), DAY_END);

		// Midnight (00:00 next day) means end-of-day (24:00) on the previous day
		if (endHour === 0) {
			const prevDay = new Date(end.getTime() - 1);
			endDate = formatDateISO(prevDay);
			endHour = DAY_END;
		}

		const params = new URLSearchParams();
		params.set('date', startDate);
		if (startDate !== endDate) {
			params.set('endDate', endDate);
		}
		params.set('startHour', String(startHour));
		params.set('endHour', String(endHour));

		goto(`/book?${params.toString()}`);
	}

	let plugins = [TimeGrid, DayGrid, Interaction];

	// --- Auto-fit slot height (no body scroll) ---
	// The wrapper height is viewport-fixed, so measuring it never loops back
	// into slotHeight. Refit on resize (observer) + view/date changes (datesSet).
	const FIT_SLOTS = DAY_END - DAY_START;
	const MIN_SLOT_HEIGHT_PX = 12;
	let gridWrap = $state<HTMLDivElement | null>(null);
	let slotHeight = $state(24);

	function fitSlotHeight() {
		if (!gridWrap) return;
		const main = gridWrap.querySelector('.ec-main');
		const header = gridWrap.querySelector('.ec-header');
		if (!main || !header) return;
		const avail = main.clientHeight - header.clientHeight;
		if (avail <= 0) return;
		slotHeight = Math.max(MIN_SLOT_HEIGHT_PX, Math.floor(avail / FIT_SLOTS));
		// Absorb the 0–23px floor remainder into the all-day row (whose own
		// minimum already holds one slotHeight — hence 25 shares), keeping the
		// hour grid flush with the card bottom on whole pixels only.
		const allday = header.querySelector('.ec-all-day');
		if (!allday) {
			gridWrap.style.setProperty('--ec-allday-extra', '0px');
			return;
		}
		const headerRest = header.clientHeight - allday.clientHeight;
		const extra = main.clientHeight - headerRest - (FIT_SLOTS + 1) * slotHeight;
		gridWrap.style.setProperty('--ec-allday-extra', `${Math.max(0, Math.round(extra))}px`);
	}

	let fitObserver: ResizeObserver | null = null;

	let calendarOptions = $derived({
		view: isMobile ? 'timeGridDay' : 'timeGridWeek',
		date: $page.url.searchParams.get('date') ?? undefined,
		headerToolbar: {
			start: 'prev,next today',
			center: 'title',
			end: isMobile ? 'dayGridMonth,timeGridDay' : 'dayGridMonth,timeGridWeek,timeGridDay'
		},
		locale: 'fr',
		allDayContent: 'Journée',
		slotHeight,
		slotMinTime: `${padH(DAY_START)}:00:00`,
		slotMaxTime: `${padH(DAY_END)}:00:00`,
		slotDuration: '01:00:00',
		slotLabelInterval: '04:00:00',
		firstDay: 1,
		nowIndicator: true,
		editable: false,
		selectable: true,
		selectBackgroundColor: isDark ? 'rgba(137, 180, 250, 0.4)' : 'rgba(30, 102, 245, 0.4)',
		select: handleSelect,
		dateClick: handleDateClick,
		eventClick: handleEventClick,
		eventMouseEnter: handleEventMouseEnter,
		eventMouseLeave: handleEventMouseLeave,
		eventDrop: handleEventUpdate,
		eventResize: handleEventUpdate,
		datesSet: (info: any) => {
			viewStart = info.start;
			viewEnd = info.end;
			// Post-library-update path (covers h2 node replacement on view change).
			syncTitleAttributes();
			// Header height may have changed with the view — refit the slots.
			requestAnimationFrame(() => fitSlotHeight());
		},
		eventContent: (info: any) => {
			// Let EC use default rendering for internal preview/pointer events (selection feedback)
			if (info.event.display === 'preview' || info.event.display === 'pointer') return undefined;
			return {
				html: `<span style="display:flex;align-items:center;justify-content:center;height:100%;font-size:0.7rem;font-weight:600">${info.event.extendedProps.booking.flatNumber}</span>`
			};
		},
		events,
		buttonText: {
			today: "Aujourd'hui",
			timeGridWeek: 'Semaine',
			dayGridMonth: 'Mois',
			timeGridDay: 'Jour'
		},
		// Same day-header format on both time-grid views (the library defaults
		// `lun. 12/10` on week and bare `lundi` on day — inconsistent).
		views: {
			dayGridMonth: { dayMaxEvents: true },
			timeGridWeek: { dayHeaderFormat: { weekday: 'short', day: 'numeric' } },
			timeGridDay: { dayHeaderFormat: { weekday: 'short', day: 'numeric' } }
		}
	});
</script>

<!-- Viewport fill: column flex, grid absorbs the remainder (57px toolbar; ~60px
	mobile bottom nav). Bottom keeps 57px of air, mirroring the top bar.
	Horizontal gutters come from main's p-4. -->
<div
	class="-my-4 flex h-[calc(100dvh-57px-57px)] flex-col max-md:h-[calc(100dvh-57px-60px-57px)]"
>
	<div class="flex items-center justify-between pt-4">
		<h2 class="page-title">Planning Parking</h2>
		<a href="/book">
			<Button variant="default" size="sm" class="cursor-pointer gap-1.5">
				<CirclePlus class="h-4 w-4" />
				Réserver
			</Button>
		</a>
	</div>

	{#if data.spots.length === 0}
		<EmptyState title="Aucune place de parking configurée.">
			{#if data.flat.isAdmin}
				<p class="text-muted-foreground text-sm">
					Allez dans <a href="/admin/spots" class="inline-link">Admin</a> pour ajouter des places de parking.
				</p>
			{/if}
		</EmptyState>
	{:else}
		<div bind:this={gridWrap} class="ec-container mt-4 min-h-0 flex-1" class:ec-dark={isDark}>
			<Calendar {plugins} options={calendarOptions} />
		</div>
	{/if}
</div>

<!-- Hover tooltip -->
{#if tooltipBooking}
	<div
		bind:this={tooltipEl}
		class="bg-popover text-popover-foreground pointer-events-none fixed z-50 rounded-md border px-3 py-1.5 text-xs shadow-md"
	>
		{formatTooltipLine(tooltipBooking)}
	</div>
{/if}

<BookingCancelDialog
	bookingId={cancellingBookingId}
	onClose={() => (cancellingBookingId = null)}
	onCancelled={() => invalidateAll()}
/>

<!-- Edit dialog stacks over the open drawer (drawer untouched — cf. conflict dialog) -->
<BookingEditDialog
	booking={editBooking}
	spots={data.spotDirectory}
	{isDark}
	onClose={() => (editingBookingId = null)}
	onSaved={() => invalidateAll()}
/>

<!-- Shared booking drawer (detail + Modifier/Annuler for own upcoming bookings) -->
<BookingDrawer
	open={selectedBookingId !== null}
	onClose={(o) => {
		if (!o) {
			selectedBookingId = null;
		}
	}}
	booking={selectedBooking}
	canModify={selectedBooking?.flatNumber === data.flat.number}
	onEdit={openEditDialog}
	onCancel={confirmCancel}
	onNoteChanged={() => invalidateAll()}
/>
