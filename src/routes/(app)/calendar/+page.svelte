<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { Calendar, TimeGrid, DayGrid, List, Interaction } from '@event-calendar/core';
	import '@event-calendar/core/index.css';
	import { Button } from '$lib/components/ui/button';
	import { mode } from 'mode-watcher';
	import CirclePlus from '@lucide/svelte/icons/circle-plus';
	import { DAY_START, DAY_END, type BookingWithFlat } from '$lib/types';
	import { padH } from '$lib/utils/time';

	let { data } = $props();

	let isMobile = $state(false);
	let eventSource: EventSource | null = null;

	// Track dark mode for the calendar container class
	let isDark = $derived(mode.current === 'dark');

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

	function getFlatColor(flatId: number): string {
		const colors = isDark ? FLAT_COLORS_DARK : FLAT_COLORS_LIGHT;
		return colors[flatId % colors.length];
	}

	// Convert bookings to calendar events
	function bookingsToEvents(bookings: BookingWithFlat[]) {
		return bookings.map((b) => {
			const isOwn = b.flatId === data.flat.id;
			return {
				id: String(b.id),
				start: b.startTime,
				end: b.endTime,
				title: `${b.flatNumber}${b.note ? ` · ${b.note}` : ''}`,
				backgroundColor: isOwn ? (isDark ? '#89b4fa' : '#1e66f5') : getFlatColor(b.flatId),
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

	onMount(() => {
		checkMobile();
		window.addEventListener('resize', checkMobile);

		// Set up SSE for real-time updates
		eventSource = new EventSource('/api/events');
		eventSource.addEventListener('booking_created', (e) => {
			const booking = JSON.parse(e.data) as BookingWithFlat;
			bookings = [...bookings, booking];
		});
		eventSource.addEventListener('booking_cancelled', (e) => {
			const { id } = JSON.parse(e.data);
			bookings = bookings.filter((b) => b.id !== id);
		});
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('resize', checkMobile);
		}
		eventSource?.close();
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
			start instanceof Date ? start.getHours() : parseInt(String(start).split('T')[1]?.substring(0, 2) || '0');
		const endHour = end instanceof Date ? end.getHours() : parseInt(String(end).split('T')[1]?.substring(0, 2) || '24');

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
		selectable: true,
		select: handleSelect,
		dateClick: handleDateClick,
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
		border: none !important;
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
