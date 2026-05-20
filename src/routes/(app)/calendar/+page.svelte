<script lang="ts">
	import { Calendar, DayGrid, Interaction, List, TimeGrid } from '@event-calendar/core';
	import { computePosition, flip, offset, shift } from '@floating-ui/dom';
	import CirclePlus from '@lucide/svelte/icons/circle-plus';
	import { differenceInHours, format, isSameDay, parseISO } from 'date-fns';
	import { fr } from 'date-fns/locale';
	import { mode } from 'mode-watcher';
	import { onDestroy, onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { goto, invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { type BookingWithFlat, DAY_END, DAY_START } from '$lib/types';
	import { padH } from '$lib/utils/time';
	import '@event-calendar/core/index.css';

	let { data } = $props();

	let isMobile = $state(false);
	let eventSource: EventSource | null = null;

	// Track dark mode for the calendar container class
	let isDark = $derived(mode.current === 'dark');

	// --- Popover state ---
	let popoverBooking = $state<BookingWithFlat | null>(null);
	let popoverEl = $state<HTMLDivElement | null>(null);
	let popoverAnchorEl: HTMLElement | null = null;
	let confirmingCancel = $state(false);

	// --- Tooltip state ---
	let tooltipBooking = $state<BookingWithFlat | null>(null);
	let tooltipEl = $state<HTMLDivElement | null>(null);
	let tooltipAnchorEl: HTMLElement | null = null;
	let tooltipTimeout: ReturnType<typeof setTimeout> | null = null;

	// Catppuccin colors for different apartments (no blue/orange — reserved for primary/accent)
	const FLAT_COLORS_LIGHT = [
		'#8839ef', // mauve
		'#179299', // teal
		'#e64553', // maroon
		'#ea76cb', // pink
		'#40a02b', // green
		'#df8e1d', // yellow
		'#7287fd', // lavender
		'#d20f39' // red
	];
	const FLAT_COLORS_DARK = [
		'#cba6f7', // mauve
		'#94e2d5', // teal
		'#eba0ac', // maroon
		'#f5c2e7', // pink
		'#a6e3a1', // green
		'#f9e2af', // yellow
		'#b4befe', // lavender
		'#f38ba8' // red
	];

	function getFlatColor(flatNumber: string): string {
		const colors = isDark ? FLAT_COLORS_DARK : FLAT_COLORS_LIGHT;
		let hash = 0;
		for (let i = 0; i < flatNumber.length; i++) {
			hash = flatNumber.charCodeAt(i) + ((hash << 5) - hash);
		}
		return colors[Math.abs(hash) % colors.length];
	}

	// Convert bookings to calendar events
	function bookingsToEvents(bookings: BookingWithFlat[]) {
		return bookings.map((b) => {
			const isOwn = b.flatNumber === data.flat.number;
			return {
				id: String(b.id),
				start: b.startTime,
				end: b.endTime,
				title: '',
				editable: isOwn,
				backgroundColor: isOwn ? (isDark ? '#89b4fa' : '#1e66f5') : getFlatColor(b.flatNumber),
				textColor: isDark ? '#1e1e2e' : '#eff1f5',
				extendedProps: { booking: b }
			};
		});
	}

	let bookings = $state<BookingWithFlat[]>(data.bookings);
	let events = $derived(bookingsToEvents(bookings));

	function checkMobile() {
		isMobile = window.innerWidth < 768;
	}

	// --- Formatting helpers ---
	function formatPopoverTime(start: string, end: string): string {
		const s = parseISO(start);
		const e = parseISO(end);
		if (isSameDay(s, e)) {
			return `${format(s, "HH'h'mm")} → ${format(e, "HH'h'mm")}`;
		}
		return `${format(s, "EEE d, HH'h'mm", { locale: fr })} → ${format(e, "EEE d, HH'h'mm", { locale: fr })}`;
	}

	function formatPopoverDuration(start: string, end: string): string {
		const hours = differenceInHours(parseISO(end), parseISO(start));
		if (hours < 24) return `${hours}h`;
		const days = Math.ceil(hours / 24);
		return `${days} jour${days > 1 ? 's' : ''}`;
	}

	function formatTooltipLine(booking: BookingWithFlat): string {
		const name = booking.flatDisplayName
			? `${booking.flatNumber} — ${booking.flatDisplayName}`
			: booking.flatNumber;
		const s = parseISO(booking.startTime);
		const e = parseISO(booking.endTime);
		return `${name} · ${format(s, "HH'h'mm")}–${format(e, "HH'h'mm")}`;
	}

	// --- Popover positioning ---
	async function positionPopover() {
		if (!popoverEl || !popoverAnchorEl) return;
		const { x, y } = await computePosition(popoverAnchorEl, popoverEl, {
			placement: 'top',
			middleware: [offset(8), flip(), shift({ padding: 8 })]
		});
		popoverEl.style.left = `${x}px`;
		popoverEl.style.top = `${y}px`;
	}

	async function positionTooltip() {
		if (!tooltipEl || !tooltipAnchorEl) return;
		const { x, y } = await computePosition(tooltipAnchorEl, tooltipEl, {
			placement: 'top',
			middleware: [offset(6), flip(), shift({ padding: 8 })]
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
		popoverAnchorEl = info.el;
		popoverBooking = booking;
		confirmingCancel = false;

		// Position after render
		requestAnimationFrame(() => positionPopover());
	}

	function handleEventMouseEnter(info: any) {
		// Don't show tooltip if popover is open
		if (popoverBooking) return;

		const booking = info.event.extendedProps.booking as BookingWithFlat;
		tooltipAnchorEl = info.el;

		// Show after 300ms delay
		if (tooltipTimeout) clearTimeout(tooltipTimeout);
		tooltipTimeout = setTimeout(() => {
			tooltipBooking = booking;
			requestAnimationFrame(() => positionTooltip());
		}, 300);
	}

	function handleEventMouseLeave() {
		if (tooltipTimeout) clearTimeout(tooltipTimeout);
		tooltipBooking = null;
	}

	function closePopover() {
		popoverBooking = null;
		confirmingCancel = false;
	}

	function handleClickOutside(e: MouseEvent) {
		if (!popoverBooking) return;
		if (popoverEl && !popoverEl.contains(e.target as Node)) {
			closePopover();
		}
	}

	async function cancelBooking() {
		if (!popoverBooking) return;
		const res = await fetch(`/api/bookings/${popoverBooking.id}`, { method: 'DELETE' });
		if (res.ok) {
			toast.success('Réservation annulée');
			closePopover();
			invalidateAll();
		} else {
			const result = await res.json();
			toast.error(result.error || "Impossible d'annuler");
		}
	}

	// --- Drag & Resize ---
	function toISOLocal(d: Date): string {
		const year = d.getFullYear();
		const month = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		const hours = String(d.getHours()).padStart(2, '0');
		const minutes = String(d.getMinutes()).padStart(2, '0');
		return `${year}-${month}-${day}T${hours}:${minutes}:00`;
	}

	async function handleEventDrop(info: any) {
		// Only allow drag in time grid views (not month view)
		if (info.view.type === 'dayGridMonth') {
			info.revert();
			return;
		}

		const booking = info.event.extendedProps.booking as BookingWithFlat;
		const newStart = toISOLocal(info.event.start);
		const newEnd = toISOLocal(info.event.end);
		const oldStart = booking.startTime;
		const oldEnd = booking.endTime;

		const res = await fetch(`/api/bookings/${booking.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ startTime: newStart, endTime: newEnd })
		});

		if (res.ok) {
			const { booking: updated } = await res.json();
			bookings = bookings.map((b) => (b.id === updated.id ? updated : b));
			toast.success('Réservation modifiée', {
				action: {
					label: 'Annuler',
					onClick: () => undoMove(booking.id, oldStart, oldEnd)
				},
				duration: 5000
			});
		} else {
			info.revert();
			const result = await res.json();
			toast.error(result.error || 'Impossible de déplacer la réservation');
		}
	}

	async function handleEventResize(info: any) {
		// Only allow resize in time grid views (not month view)
		if (info.view.type === 'dayGridMonth') {
			info.revert();
			return;
		}

		const booking = info.event.extendedProps.booking as BookingWithFlat;
		const newStart = toISOLocal(info.event.start);
		const newEnd = toISOLocal(info.event.end);
		const oldStart = booking.startTime;
		const oldEnd = booking.endTime;

		const res = await fetch(`/api/bookings/${booking.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ startTime: newStart, endTime: newEnd })
		});

		if (res.ok) {
			const { booking: updated } = await res.json();
			bookings = bookings.map((b) => (b.id === updated.id ? updated : b));
			toast.success('Réservation modifiée', {
				action: {
					label: 'Annuler',
					onClick: () => undoMove(booking.id, oldStart, oldEnd)
				},
				duration: 5000
			});
		} else {
			info.revert();
			const result = await res.json();
			toast.error(result.error || 'Impossible de redimensionner la réservation');
		}
	}

	async function undoMove(bookingId: number, startTime: string, endTime: string) {
		const res = await fetch(`/api/bookings/${bookingId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ startTime, endTime })
		});

		if (res.ok) {
			const { booking: updated } = await res.json();
			bookings = bookings.map((b) => (b.id === updated.id ? updated : b));
			toast.success('Modification annulée');
		} else {
			const result = await res.json();
			toast.error(result.error || "Le créneau original n'est plus disponible");
			invalidateAll();
		}
	}

	// --- Lifecycle ---
	onMount(() => {
		checkMobile();
		window.addEventListener('resize', checkMobile);
		document.addEventListener('click', handleClickOutside, true);

		// Set up SSE for real-time updates
		eventSource = new EventSource('/api/events');
		eventSource.addEventListener('booking_created', (e) => {
			const booking = JSON.parse(e.data) as BookingWithFlat;
			bookings = [...bookings, booking];
		});
		eventSource.addEventListener('booking_cancelled', (e) => {
			const { id } = JSON.parse(e.data);
			bookings = bookings.filter((b) => b.id !== id);
			// Close popover if the cancelled booking is the one being viewed
			if (popoverBooking?.id === id) closePopover();
		});
		eventSource.addEventListener('booking_updated', (e) => {
			const updated = JSON.parse(e.data) as BookingWithFlat;
			bookings = bookings.map((b) => (b.id === updated.id ? updated : b));
			// Update popover if the updated booking is the one being viewed
			if (popoverBooking?.id === updated.id) popoverBooking = updated;
		});
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('resize', checkMobile);
			document.removeEventListener('click', handleClickOutside, true);
		}
		eventSource?.close();
		if (tooltipTimeout) clearTimeout(tooltipTimeout);
	});

	function handleDateClick(info: any) {
		const rawDate = info.dateStr || info.date?.toISOString();
		if (rawDate) {
			const date = rawDate.split('T')[0];
			const hour = info.date instanceof Date ? info.date.getHours() : null;
			const params = new URLSearchParams();
			params.set('date', date);
			if (hour !== null && hour >= 0 && hour < 24) {
				params.set('startHour', String(hour));
			}
			goto(`/book?${params.toString()}`);
		}
	}

	function handleSelect(info: any) {
		const start = info.start;
		const end = info.end;
		if (!start || !end) return;

		const startDate = start instanceof Date ? start.toISOString().split('T')[0] : String(start).split('T')[0];
		const endDate = end instanceof Date ? end.toISOString().split('T')[0] : String(end).split('T')[0];
		const startHour =
			start instanceof Date ? start.getHours() : parseInt(String(start).split('T')[1]?.substring(0, 2) || '0', 10);
		const endHour = end instanceof Date ? end.getHours() : parseInt(String(end).split('T')[1]?.substring(0, 2) || '24', 10);

		const params = new URLSearchParams();
		params.set('date', startDate);
		if (startDate !== endDate) {
			params.set('endDate', endDate);
		}
		params.set('startHour', String(startHour));
		params.set('endHour', String(endHour));

		goto(`/book?${params.toString()}`);
	}

	let plugins = [TimeGrid, DayGrid, List, Interaction];

	let calendarOptions = $derived({
		view: isMobile ? 'timeGridDay' : 'timeGridWeek',
		headerToolbar: {
			start: 'prev,next today',
			center: 'title',
			end: isMobile ? 'dayGridMonth,timeGridDay' : 'dayGridMonth,timeGridWeek,timeGridDay'
		},
		locale: 'fr',
		slotMinTime: `${padH(DAY_START)}:00:00`,
		slotMaxTime: `${padH(DAY_END)}:00:00`,
		slotDuration: '01:00:00',
		firstDay: 1,
		nowIndicator: true,
		editable: true,
		selectable: true,
		select: handleSelect,
		dateClick: handleDateClick,
		eventClick: handleEventClick,
		eventMouseEnter: handleEventMouseEnter,
		eventMouseLeave: handleEventMouseLeave,
		eventDrop: handleEventDrop,
		eventResize: handleEventResize,
		eventContent: (info: any) => ({
			html: `<span style="display:flex;align-items:center;justify-content:center;height:100%;font-size:0.7rem;font-weight:600">${info.event.extendedProps.booking.flatNumber}</span>`
		}),
		events,
		buttonText: {
			today: "Aujourd'hui",
			timeGridWeek: 'Semaine',
			dayGridMonth: 'Mois',
			timeGridDay: 'Jour'
		}
	});
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h2 class="text-2xl font-bold tracking-tight">Planning Parking</h2>
		<a href="/book">
			<Button size="sm" class="cursor-pointer gap-1.5">
				<CirclePlus class="h-4 w-4" />
				Réserver
			</Button>
		</a>
	</div>

	{#if data.spots.length === 0}
		<div class="bg-card rounded-lg border p-8 text-center">
			<p class="text-muted-foreground">Aucune place de parking configurée.</p>
			{#if data.flat.isAdmin}
				<p class="text-muted-foreground mt-2 text-sm">
					Allez dans <a href="/admin" class="underline">Admin</a> pour ajouter des places.
				</p>
			{/if}
		</div>
	{:else}
		<div class="ec-container" class:ec-dark={isDark}>
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

<!-- Click popover -->
{#if popoverBooking}
	<div
		bind:this={popoverEl}
		class="bg-popover text-popover-foreground fixed z-50 w-64 rounded-lg border p-4 shadow-lg"
	>
		<div class="space-y-2">
			<p class="font-medium">
				{popoverBooking.flatNumber}{popoverBooking.flatDisplayName ? ` — ${popoverBooking.flatDisplayName}` : ''}
			</p>
			<p class="text-muted-foreground text-sm">
				{formatPopoverTime(popoverBooking.startTime, popoverBooking.endTime)} · {formatPopoverDuration(popoverBooking.startTime, popoverBooking.endTime)}
			</p>
			{#if popoverBooking.note}
				<p class="text-muted-foreground text-sm">{popoverBooking.note}</p>
			{/if}

			{#if popoverBooking.flatNumber === data.flat.number}
				<div class="border-border border-t pt-2">
					{#if confirmingCancel}
						<div class="flex items-center gap-2">
							<Button size="sm" variant="destructive" onclick={cancelBooking}>Confirmer</Button>
							<Button size="sm" variant="ghost" onclick={() => (confirmingCancel = false)}>Non</Button>
						</div>
					{:else}
						<Button size="sm" variant="destructive" class="w-full" onclick={() => (confirmingCancel = true)}>
							Annuler la réservation
						</Button>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	/* Force our palette onto the EC calendar in both light and dark modes.
	   EC defines vars on .ec — we override on .ec-container .ec for higher specificity. */
	:global(.ec-container .ec) {
		font-family: inherit;
		border-radius: var(--radius);
		border: 1px solid hsl(var(--border));
		overflow: hidden;

		/* Core colors */
		--ec-bg-color: hsl(var(--card));
		--ec-text-color: hsl(var(--foreground));
		--ec-border-color: hsl(var(--border));
		--ec-today-bg-color: hsl(var(--primary) / 0.06);
		--ec-highlight-color: hsl(var(--primary) / 0.12);
		--ec-now-indicator-color: hsl(var(--primary));
		--ec-popup-bg-color: hsl(var(--card));

		/* Events — peach for existing bookings */
		--ec-event-bg-color: hsl(var(--accent));
		--ec-event-text-color: hsl(var(--accent-foreground));

		/* Buttons */
		--ec-button-bg-color: hsl(var(--card));
		--ec-button-border-color: hsl(var(--border));
		--ec-button-text-color: hsl(var(--foreground));
		--ec-button-active-bg-color: hsl(var(--primary));
		--ec-button-active-border-color: hsl(var(--primary));
		--ec-button-active-text-color: hsl(var(--primary-foreground));

		/* Grayscale scale mapped to our palette */
		--ec-color-400: hsl(var(--muted-foreground));
		--ec-color-300: hsl(var(--border));
		--ec-color-200: hsl(var(--muted));
		--ec-color-100: hsl(var(--card));
		--ec-color-50: hsl(var(--background));
	}

	/* Dark mode — override EC's built-in oklch dark values */
	:global(.ec-dark.ec-container .ec) {
		color-scheme: dark;
		--ec-bg-color: hsl(var(--card));
		--ec-text-color: hsl(var(--foreground));
		--ec-border-color: hsl(var(--border));
		--ec-today-bg-color: hsl(var(--primary) / 0.1);
		--ec-highlight-color: hsl(var(--primary) / 0.18);
		--ec-now-indicator-color: hsl(var(--primary));
		--ec-popup-bg-color: hsl(var(--card));
		--ec-event-bg-color: hsl(var(--accent));
		--ec-event-text-color: hsl(var(--accent-foreground));
		--ec-button-bg-color: hsl(var(--card));
		--ec-button-border-color: hsl(var(--border));
		--ec-button-text-color: hsl(var(--foreground));
		--ec-button-active-bg-color: hsl(var(--primary));
		--ec-button-active-border-color: hsl(var(--primary));
		--ec-button-active-text-color: hsl(var(--primary-foreground));
		--ec-color-400: hsl(var(--muted-foreground));
		--ec-color-300: hsl(var(--border));
		--ec-color-200: hsl(var(--muted));
		--ec-color-100: hsl(var(--card));
		--ec-color-50: hsl(var(--background));
		--ec-bg-event-opacity: 0.5;
	}

	:global(.ec-container .ec .ec-event) {
		border-radius: calc(var(--radius) - 2px);
		font-size: 0.75rem;
		font-weight: 500;
		border: none;
		cursor: pointer;
	}

	:global(.ec-container .ec .ec-toolbar) {
		padding: 0.75rem 1rem;
	}

	:global(.ec-container .ec .ec-title) {
		font-size: 1rem;
		font-weight: 600;
	}

	:global(.ec-container .ec .ec-button) {
		border-radius: calc(var(--radius) - 2px);
		font-size: 0.8rem;
		font-weight: 500;
		transition:
			background-color 0.15s,
			border-color 0.15s,
			color 0.15s;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	/* Center the prev/next arrow icons within their buttons */
	:global(.ec-container .ec .ec-icon) {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	:global(.ec-container .ec .ec-icon.ec-prev:after) {
		inset-inline-start: 1px;
	}

	:global(.ec-container .ec .ec-icon.ec-next:after) {
		inset-inline-start: -1px;
	}

	/* Add gaps between buttons within button groups */
	:global(.ec-container .ec .ec-button-group) {
		gap: 0.375rem;
	}

	:global(.ec-container .ec .ec-button-group .ec-button:not(:first-child)) {
		margin-inline-start: 0;
		border-radius: calc(var(--radius) - 2px);
	}

	:global(.ec-container .ec .ec-button-group .ec-button:not(:last-child)) {
		border-radius: calc(var(--radius) - 2px);
	}

	:global(.ec-container .ec .ec-button:not(:disabled):hover) {
		background-color: hsl(var(--muted));
		border-color: hsl(var(--border));
		color: hsl(var(--foreground));
	}

	:global(.ec-container .ec .ec-button.ec-active:not(:disabled):hover) {
		background-color: hsl(var(--primary) / 0.85);
		border-color: hsl(var(--primary) / 0.85);
		color: hsl(var(--primary-foreground));
	}

	/* Time slot labels */
	:global(.ec-container .ec .ec-time) {
		font-size: 0.7rem;
		color: hsl(var(--muted-foreground));
	}

	/* Day headers */
	:global(.ec-container .ec .ec-day-head) {
		font-size: 0.75rem;
		font-weight: 500;
	}

	/* Scrollbar styling */
	:global(.ec-container .ec .ec-body) {
		scrollbar-color: hsl(var(--border)) transparent;
	}
</style>
