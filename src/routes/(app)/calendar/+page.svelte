<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { Calendar, TimeGrid, DayGrid, List, Interaction } from '@event-calendar/core';
	import '@event-calendar/core/index.css';
	import type { BookingWithFlat } from '$lib/server/bookings';

	let { data } = $props();

	let isMobile = $state(false);
	let eventSource: EventSource | null = null;

	// Convert bookings to calendar events
	function bookingsToEvents(bookings: BookingWithFlat[]) {
		return bookings.map((b) => ({
			id: String(b.id),
			start: b.startTime,
			end: b.endTime,
			title: `${b.flatDisplayName || b.flatNumber}${b.label ? ` (${b.label})` : ''}`,
			backgroundColor: b.flatId === data.user.id ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
			textColor: b.flatId === data.user.id ? 'hsl(var(--primary-foreground))' : 'hsl(var(--background))',
			extendedProps: { booking: b }
		}));
	}

	let events = $state(bookingsToEvents(data.bookings));

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
			events = [...events, ...bookingsToEvents([booking])];
		});
		eventSource.addEventListener('booking_cancelled', (e) => {
			const { id } = JSON.parse(e.data);
			events = events.filter((ev) => ev.id !== String(id));
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
		const startHour = start instanceof Date ? start.getHours() : parseInt(String(start).split('T')[1]?.substring(0, 2) || '0');
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
		slotMinTime: '00:00:00',
		slotMaxTime: '24:00:00',
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
		},
		eventClick: (info: any) => {
			const booking = info.event.extendedProps?.booking;
			if (booking) {
				// Ouvrir un dialogue de détails ici
			}
		}
	});
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h2 class="text-2xl font-bold">Planning Parking</h2>
		<a href="/book">
			<button class="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">
				Réserver
			</button>
		</a>
	</div>

	{#if data.slots.length === 0}
		<div class="rounded-lg border bg-card p-8 text-center">
			<p class="text-muted-foreground">Aucune place de parking configurée.</p>
			{#if data.user.isAdmin}
				<p class="mt-2 text-sm text-muted-foreground">Allez dans <a href="/admin" class="underline">Admin</a> pour ajouter des places.</p>
			{/if}
		</div>
	{:else}
		<div class="ec-container">
			<Calendar {plugins} options={calendarOptions} />
		</div>
	{/if}
</div>

<style>
	.ec-container {
		--ec-border-color: hsl(var(--border));
		--ec-bg-color: hsl(var(--background));
		--ec-text-color: hsl(var(--foreground));
		--ec-today-bg-color: hsl(var(--accent));
		--ec-highlight-color: hsl(var(--primary) / 0.1);
		--ec-button-bg-color: hsl(var(--secondary));
		--ec-button-active-bg-color: hsl(var(--primary));
		--ec-button-active-text-color: hsl(var(--primary-foreground));
	}

	:global(.ec) {
		font-family: inherit;
		border-radius: var(--radius);
		border: 1px solid hsl(var(--border));
	}

	:global(.ec-event) {
		border-radius: calc(var(--radius) - 2px);
		font-size: 0.75rem;
		font-weight: 500;
	}

	:global(.ec-toolbar) {
		padding: 0.75rem;
	}

	:global(.ec-button) {
		border-radius: calc(var(--radius) - 2px);
		font-size: 0.8rem;
	}
</style>
