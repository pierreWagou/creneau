<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import { RangeCalendar } from '$lib/components/ui/range-calendar';
	import { toast } from 'svelte-sonner';
	import { today, getLocalTimeZone, parseDate, type DateValue } from '@internationalized/date';
	import { TIME_BLOCKS, type TimeBlockKey, padH, getHourFromISO, formatDateISO } from '$lib/utils/time';
	import { DAY_START, DAY_END, type AvailableSlot, type CalendarDayStatus, type BookingWithFlat } from '$lib/types';

	let { data } = $props();

	// Constants
	const tz = getLocalTimeZone();
	const todayDate = today(tz);
	const TOTAL_HOURS = DAY_END - DAY_START;

	// Form state
	let selectedSpotId = $state(data.initialSpotId ?? data.spots[0]?.id ?? 0);
	let calendarValue = $state<{ start: DateValue; end: DateValue } | undefined>(
		data.prefilledDate
			? {
					start: parseDate(data.prefilledDate),
					end: parseDate(data.prefilledEndDate || data.prefilledDate)
				}
			: undefined
	);
	let startHour = $state(data.prefilledStartHour ?? DAY_START);
	let endHour = $state(data.prefilledEndHour ?? DAY_END);
	let multiDayStartHour = $state(data.prefilledStartHour ?? DAY_START);
	let multiDayEndHour = $state(data.prefilledEndHour ?? DAY_END);
	let note = $state('');
	let loading = $state(false);
	let loadingSlots = $state(false);

	// Calendar statuses (for coloring)
	let calendarStatuses = $state<CalendarDayStatus[]>(data.calendarStatuses);

	// Available slots (fetched when user selects dates)
	let availableSlots = $state<AvailableSlot[]>([]);

	// Bookings for the selected date (for capsule display)
	let dayBookings = $state<BookingWithFlat[]>([]);

	// SSE for real-time updates
	let eventSource: EventSource | null = null;

	onMount(() => {
		eventSource = new EventSource('/api/events');
		eventSource.addEventListener('booking_created', () => {
			refreshCalendarStatuses();
			if (hasDateSelection) fetchTimeline();
		});
		eventSource.addEventListener('booking_cancelled', () => {
			refreshCalendarStatuses();
			if (hasDateSelection) fetchTimeline();
		});
	});

	onDestroy(() => {
		eventSource?.close();
	});

	// ============================================================
	// Data fetching
	// ============================================================

	async function refreshCalendarStatuses() {
		const now = new Date();
		const from = formatDateISO(new Date(now.getFullYear(), now.getMonth(), 1));
		const toDate = new Date(now.getFullYear(), now.getMonth() + 3, 0);
		const to = formatDateISO(toDate);

		try {
			const res = await fetch(`/api/calendar-statuses?from=${from}&to=${to}&spotId=${selectedSpotId}`);
			if (res.ok) {
				const result = await res.json();
				calendarStatuses = result.statuses;
			}
		} catch {
			// Silently fail
		}
	}

	async function fetchTimeline() {
		if (!startDateStr) return;
		const from = startDateStr;
		const to = multiDay ? endDateStr : startDateStr;
		if (!from || !to) return;

		try {
			loadingSlots = true;
			const res = await fetch(`/api/timeline?from=${from}&to=${to}&spotId=${selectedSpotId}`);
			if (res.ok) {
				const result = await res.json();
				availableSlots = result.available;
				dayBookings = result.bookings;
			}
		} catch {
			availableSlots = [];
			dayBookings = [];
		} finally {
			loadingSlots = false;
		}
	}

	// Re-fetch calendar statuses when spot changes
	let initialSpotId = data.initialSpotId;
	let isFirstSpotRun = true;
	$effect(() => {
		const currentSpotId = selectedSpotId;
		if (isFirstSpotRun && currentSpotId === initialSpotId) {
			isFirstSpotRun = false;
			return;
		}
		isFirstSpotRun = false;
		refreshCalendarStatuses();
		if (hasDateSelection) fetchTimeline();
	});

	// Fetch available slots when date selection changes
	$effect(() => {
		if (startDateStr) {
			// Also track endDateStr for multi-day
			endDateStr;
			fetchTimeline();
		} else {
			availableSlots = [];
		}
	});

	// ============================================================
	// Derived state
	// ============================================================

	let multiDay = $derived(
		calendarValue?.start && calendarValue?.end
			? calendarValue.start.toString() !== calendarValue.end.toString()
			: false
	);
	let startDateStr = $derived(calendarValue?.start ? calendarValue.start.toString() : '');
	let endDateStr = $derived(calendarValue?.end ? calendarValue.end.toString() : '');
	let hasDateSelection = $derived(calendarValue?.start !== undefined);

	// ============================================================
	// Client-side derivations from available slots
	// ============================================================

	/** Clip available slots to a single day's boundaries, returning hour-based ranges */
	function getDaySlotsForDate(date: string): { start: number; end: number }[] {
		const dayStart = `${date}T${padH(DAY_START)}:00:00`;
		const dayEnd = `${date}T${padH(DAY_END)}:00:00`;

		return availableSlots
			.filter((s) => s.start < dayEnd && s.end > dayStart)
			.map((s) => ({
				start: s.start <= dayStart ? DAY_START : getHourFromISO(s.start),
				end: s.end >= dayEnd ? DAY_END : getHourFromISO(s.end)
			}));
	}

	/** Find a slot spanning from startDate to endDate (for multi-day booking) */
	function getMultiDaySlot(): AvailableSlot | undefined {
		if (!startDateStr || !endDateStr) return undefined;
		// The slot must start on or before end-of-startDate and end on or after start-of-endDate
		const latestStart = `${startDateStr}T${padH(DAY_END)}:00:00`;
		const earliestEnd = `${endDateStr}T${padH(DAY_START)}:00:00`;
		return availableSlots.find((s) => s.start <= latestStart && s.end >= earliestEnd);
	}

	/** Get valid start hours for a single day */
	function getValidStartHours(daySlots: { start: number; end: number }[]): number[] {
		return daySlots.flatMap((s) =>
			Array.from({ length: s.end - s.start }, (_, i) => s.start + i)
		);
	}

	/** Get valid end hours given a start hour (within the same slot) */
	function getValidEndHours(daySlots: { start: number; end: number }[], sHour: number): number[] {
		const slot = daySlots.find((s) => s.start <= sHour && s.end > sHour);
		if (!slot) return [];
		return Array.from({ length: slot.end - sHour }, (_, i) => sHour + 1 + i);
	}

	/** Multi-day: valid start hours on the start date (from slot start to DAY_END) */
	function getMultiDayStartHours(slot: AvailableSlot): number[] {
		const slotStartOnDay = slot.start.startsWith(startDateStr) ? getHourFromISO(slot.start) : DAY_START;
		return Array.from({ length: DAY_END - slotStartOnDay }, (_, i) => slotStartOnDay + i);
	}

	/** Multi-day: valid end hours on the end date (from DAY_START to slot end) */
	function getMultiDayEndHours(slot: AvailableSlot): number[] {
		const slotEndOnDay = slot.end.startsWith(endDateStr) ? getHourFromISO(slot.end) : DAY_END;
		return Array.from({ length: slotEndOnDay - DAY_START }, (_, i) => DAY_START + 1 + i);
	}

	/** Check if a preset range fits within any day slot */
	function isPresetAvailable(daySlots: { start: number; end: number }[], presetStart: number, presetEnd: number): boolean {
		return daySlots.some((s) => s.start <= presetStart && s.end >= presetEnd);
	}

	// ============================================================
	// Derived: computed from available slots
	// ============================================================

	let startDaySlots = $derived(startDateStr ? getDaySlotsForDate(startDateStr) : []);
	let multiDaySlot = $derived(multiDay ? getMultiDaySlot() : undefined);

	let validStartHours = $derived(getValidStartHours(startDaySlots));
	let validEndHoursForSelection = $derived(getValidEndHours(startDaySlots, startHour));

	let multiDayValid = $derived(!multiDay || multiDaySlot !== undefined);
	let multiDayStartHours = $derived(multiDaySlot ? getMultiDayStartHours(multiDaySlot) : []);
	let multiDayEndHoursValid = $derived(multiDaySlot ? getMultiDayEndHours(multiDaySlot) : []);

	// For capsule visualization in multi-day mode
	let multiDaySlotStartH = $derived(multiDayStartHours.length > 0 ? multiDayStartHours[0] : DAY_START);
	let multiDaySlotEndH = $derived(multiDayEndHoursValid.length > 0 ? multiDayEndHoursValid[multiDayEndHoursValid.length - 1] : DAY_END);

	// Full day preset availability
	let fullDayAvailable = $derived(isPresetAvailable(startDaySlots, DAY_START, DAY_END));

	let hasAvailableTime = $derived.by(() => {
		if (!hasDateSelection || loadingSlots) return false;
		if (multiDay) {
			return multiDayValid;
		}
		return validStartHours.length > 0;
	});

	// Bookings for display (from calendar statuses we know the day status,
	// but for booking details we'd need raw bookings — for now show from availability context)
	// We'll fetch bookings inline when needed, or derive from what the page server provides
	// For the capsule visualization, we'll infer booked ranges from gaps in available slots

	/** Get actual bookings for the start day, clipped to day boundaries */
	let startDayBookedRanges = $derived.by(() => {
		if (!startDateStr) return [];
		const dayStart = `${startDateStr}T${padH(DAY_START)}:00:00`;
		const dayEnd = `${startDateStr}T${padH(DAY_END)}:00:00`;

		return dayBookings
			.filter((b) => b.startTime < dayEnd && b.endTime > dayStart)
			.map((b) => ({
				start: b.startTime <= dayStart ? DAY_START : getHourFromISO(b.startTime),
				end: b.endTime >= dayEnd ? DAY_END : getHourFromISO(b.endTime),
				flatNumber: b.flatNumber,
				note: b.note
			}));
	});

	// ============================================================
	// Auto-select hours
	// ============================================================

	let skipAutoSelect = data.prefilledStartHour !== null && data.prefilledEndHour !== null;
	let needsEndHourFromStart = data.prefilledStartHour !== null && data.prefilledEndHour === null;

	$effect(() => {
		if (!hasDateSelection || !hasAvailableTime) return;

		// If both hours were prefilled (from drag-select), skip entirely on first load
		if (skipAutoSelect) {
			skipAutoSelect = false;
			return;
		}

		// If only startHour was prefilled (from click), compute longest end from that hour
		if (needsEndHourFromStart) {
			needsEndHourFromStart = false;
			if (!multiDay && startDaySlots.length > 0) {
				const slot = startDaySlots.find((s) => s.start <= startHour && s.end > startHour);
				if (slot) {
					endHour = slot.end;
				}
			}
			return;
		}

		if (!multiDay) {
			// Select the largest available slot
			if (startDaySlots.length > 0) {
				const largest = [...startDaySlots].sort((a, b) => (b.end - b.start) - (a.end - a.start))[0];
				startHour = largest.start;
				endHour = largest.end;
			}
		} else if (multiDaySlot) {
			// Multi-day: pick first valid start, latest valid end
			if (multiDayStartHours.length > 0) {
				multiDayStartHour = multiDayStartHours[0];
			}
			if (multiDayEndHoursValid.length > 0) {
				multiDayEndHour = multiDayEndHoursValid[multiDayEndHoursValid.length - 1];
			}
		}
	});

	// Ensure endHour stays valid when startHour changes
	$effect(() => {
		if (!startDateStr || multiDay) return;
		const validEnds = getValidEndHours(startDaySlots, startHour);
		if (validEnds.length > 0 && !validEnds.includes(endHour)) {
			endHour = validEnds[validEnds.length - 1];
		}
	});

	// ============================================================
	// Presets
	// ============================================================

	function applyPreset(blockKey: TimeBlockKey) {
		const block = TIME_BLOCKS[blockKey];
		startHour = parseInt(block.start.split(':')[0]);
		endHour = parseInt(block.end.split(':')[0]);
	}

	function applyFullDay() {
		startHour = DAY_START;
		endHour = DAY_END;
	}

	// ============================================================
	// Submit
	// ============================================================

	function getStartTimeStr(): string {
		const h = multiDay ? multiDayStartHour : startHour;
		return `${startDateStr}T${padH(h)}:00:00`;
	}

	function getEndTimeStr(): string {
		const h = multiDay ? multiDayEndHour : endHour;
		const date = multiDay ? (endDateStr || startDateStr) : startDateStr;
		return `${date}T${padH(h)}:00:00`;
	}

	async function handleSubmit() {
		if (!hasDateSelection) return;
		loading = true;

		try {
			const res = await fetch('/api/bookings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					spotId: selectedSpotId,
					startTime: getStartTimeStr(),
					endTime: getEndTimeStr(),
					note: note || null
				})
			});

			const result = await res.json();
			if (res.ok) {
				toast.success('Réservation confirmée !');
				goto('/calendar');
			} else {
				toast.error(result.error || 'Échec de la réservation');
			}
		} catch {
			toast.error('Erreur de connexion');
		} finally {
			loading = false;
		}
	}

	// ============================================================
	// Formatting helpers
	// ============================================================

	function formatDate(dateStr: string): string {
		const d = new Date(dateStr + 'T12:00:00');
		return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' });
	}

	function formatHour(h: number): string {
		return `${padH(h)}:00`;
	}

	function getDayStatus(dateStr: string): string {
		return calendarStatuses.find((d) => d.date === dateStr)?.status ?? 'free';
	}

	// Calendar cell coloring
	let calendarContainer = $state<HTMLElement | null>(null);

	$effect(() => {
		if (!calendarContainer) return;
		calendarStatuses;
		calendarValue;

		requestAnimationFrame(() => {
			const cells = calendarContainer!.querySelectorAll('[data-bits-day]');
			cells.forEach((cell) => {
				const dateAttr = cell.getAttribute('data-value');
				if (!dateAttr) return;
				(cell as HTMLElement).removeAttribute('data-booking-status');
				const status = getDayStatus(dateAttr);
				if (status === 'full' || status === 'partial') {
					(cell as HTMLElement).setAttribute('data-booking-status', status);
				}
			});
		});
	});
</script>

<div class="mx-auto max-w-md space-y-4">
	<h2 class="text-2xl font-bold tracking-tight">Réserver une place</h2>

	<!-- Date selection -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Quand avez-vous besoin de la place ?</Card.Title>
			<p class="text-sm text-muted-foreground">Sélectionnez un jour ou une plage de dates</p>
		</Card.Header>
		<Card.Content class="space-y-3">
			{#if data.spots.length > 1}
				<div class="space-y-2">
					<Label for="spot">Place de parking</Label>
					<select id="spot" bind:value={selectedSpotId} class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
						{#each data.spots as s}
							<option value={s.id}>{s.name}</option>
						{/each}
					</select>
				</div>
			{/if}

			<div class="relative flex justify-center" bind:this={calendarContainer}>
				<RangeCalendar
					bind:value={calendarValue}
					locale="fr-FR"
					weekdayFormat="short"
					minValue={todayDate}
				/>
			</div>

			<div class="flex items-center gap-4 text-xs text-muted-foreground justify-center">
				<span class="flex items-center gap-1">
					<span class="h-3 w-3 rounded-sm bg-accent/40 border border-accent/60"></span> Partiellement réservé
				</span>
				<span class="flex items-center gap-1">
					<span class="h-3 w-3 rounded-sm bg-accent/70 border border-accent/80"></span> Complet
				</span>
			</div>

			{#if hasDateSelection}
				<div class="rounded-md bg-muted p-3 text-sm">
					{#if multiDay}
						<p><span class="font-medium">Du</span> {formatDate(startDateStr)} <span class="font-medium">au</span> {formatDate(endDateStr)}</p>
					{:else}
						<p><span class="font-medium">Date :</span> {formatDate(startDateStr)}</p>
					{/if}
				</div>
			{/if}
		</Card.Content>
	</Card.Root>

	<!-- Loading state -->
	{#if hasDateSelection && loadingSlots}
		<Card.Root>
			<Card.Content class="py-6 text-center">
				<div class="h-5 w-5 mx-auto animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
				<p class="text-sm text-muted-foreground mt-2">Recherche des créneaux disponibles...</p>
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- Multi-day not possible -->
	{#if hasDateSelection && !loadingSlots && multiDay && !multiDayValid}
		<Card.Root class="border-destructive/50">
			<Card.Content class="py-4">
				<p class="text-sm text-destructive font-medium">Réservation sur plusieurs jours impossible</p>
				<p class="text-sm text-muted-foreground mt-1">
					Aucun créneau continu n'est disponible sur toute la période sélectionnée. Une réservation existante bloque la continuité.
				</p>
				<p class="text-xs text-muted-foreground mt-3">
					Essayez de réduire la plage de dates ou réservez chaque jour séparément.
				</p>
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- Time selection -->
	{#if hasDateSelection && !loadingSlots && hasAvailableTime}
		<Card.Root>
			<Card.Header>
				<Card.Title>Horaires</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-4">
				{#if !multiDay}
					<!-- Single day -->
					<div class="space-y-4">
						<!-- Time capsule -->
						<div class="space-y-1.5">
							<div class="relative h-10 rounded-[10px] bg-muted border border-border/60 mx-1">
								<!-- Booked ranges -->
								{#each startDayBookedRanges as range}
									<div
										class="absolute top-[4px] bottom-[4px] rounded-[6px] bg-accent/70 flex items-center justify-center overflow-hidden"
										style="left: calc({((range.start - DAY_START) / TOTAL_HOURS) * 100}% + 4px); width: calc({((range.end - range.start) / TOTAL_HOURS) * 100}% - 8px);"
									>
										<span class="text-[9px] font-medium text-accent-foreground truncate px-1">
											{range.flatNumber}{range.note ? ` · ${range.note}` : ''}
										</span>
									</div>
								{/each}
								<!-- User's selection -->
								<div
									class="absolute top-[4px] bottom-[4px] rounded-[6px] bg-primary shadow-sm transition-all duration-200"
									style="left: calc({((startHour - DAY_START) / TOTAL_HOURS) * 100}% + 4px); width: calc({((endHour - startHour) / TOTAL_HOURS) * 100}% - 8px);"
								></div>
							</div>
							<div class="flex justify-between text-[10px] text-muted-foreground px-3">
								<span>0h</span>
								<span>6h</span>
								<span>12h</span>
								<span>18h</span>
								<span>24h</span>
							</div>
						</div>

						<!-- Quick presets -->
						<div class="space-y-2">
							<span class="text-xs text-muted-foreground font-medium">Créneaux rapides</span>
							<div class="space-y-2">
								<Button
									variant={fullDayAvailable ? 'outline' : 'ghost'}
									size="sm"
									class="w-full text-xs {!fullDayAvailable ? 'opacity-40 line-through' : ''}"
									disabled={!fullDayAvailable}
									onclick={applyFullDay}
								>
									Journée entière
								</Button>
								<div class="grid grid-cols-3 gap-2">
									{#each Object.entries(TIME_BLOCKS) as [key, block]}
										{@const presetStart = parseInt(block.start.split(':')[0])}
										{@const presetEnd = parseInt(block.end.split(':')[0])}
										{@const available = isPresetAvailable(startDaySlots, presetStart, presetEnd)}
										<Button
											variant={available ? 'outline' : 'ghost'}
											size="sm"
											class="text-xs {!available ? 'opacity-40 line-through' : ''}"
											disabled={!available}
											onclick={() => applyPreset(key as TimeBlockKey)}
										>
											{block.label}
										</Button>
									{/each}
								</div>
							</div>
						</div>

						<!-- Dropdowns -->
						<div class="grid grid-cols-2 gap-3">
							<div class="space-y-1">
								<Label for="start-hour">Début</Label>
								<select
									id="start-hour"
									bind:value={startHour}
									class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
								>
									{#each Array.from({ length: TOTAL_HOURS }, (_, i) => DAY_START + i) as h}
										{@const isValid = validStartHours.includes(h)}
										<option value={h} disabled={!isValid}>
											{formatHour(h)}{!isValid ? ' (réservé)' : ''}
										</option>
									{/each}
								</select>
							</div>
							<div class="space-y-1">
								<Label for="end-hour">Fin</Label>
								<select
									id="end-hour"
									bind:value={endHour}
									class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
								>
									{#each Array.from({ length: TOTAL_HOURS }, (_, i) => DAY_START + 1 + i) as h}
										{#if h > startHour}
											{@const isValid = validEndHoursForSelection.includes(h)}
											<option value={h} disabled={!isValid}>
												{formatHour(h)}{!isValid ? ' (conflit)' : ''}
											</option>
										{/if}
									{/each}
								</select>
							</div>
						</div>

						<!-- Available slots summary -->
						{#if startDaySlots.length > 1}
							<p class="text-xs text-muted-foreground">
								{startDaySlots.length} créneaux disponibles : {startDaySlots.map(s => `${formatHour(s.start)}-${formatHour(s.end)}`).join(', ')}
							</p>
						{/if}
					</div>
				{:else if multiDaySlot}
					<!-- Multi-day -->
					<div class="space-y-4">
						<!-- Start day -->
						<div class="space-y-2">
							<Label>Début — {formatDate(startDateStr)}</Label>
							<div class="space-y-1.5">
								<div class="relative h-8 rounded-[9px] bg-muted border border-border/60 mx-1">
									<!-- Booked part before the available slot -->
									{#if multiDaySlotStartH > DAY_START}
										<div
											class="absolute top-[3px] bottom-[3px] rounded-[5px] bg-accent/70"
											style="left: calc(0% + 3px); width: calc({((multiDaySlotStartH - DAY_START) / TOTAL_HOURS) * 100}% - 6px);"
										></div>
									{/if}
									<!-- User's selection -->
									<div
										class="absolute top-[3px] bottom-[3px] rounded-[5px] bg-primary shadow-sm transition-all duration-200"
										style="left: calc({((multiDayStartHour - DAY_START) / TOTAL_HOURS) * 100}% + 3px); width: calc({((DAY_END - multiDayStartHour) / TOTAL_HOURS) * 100}% - 6px);"
									></div>
								</div>
								<div class="flex justify-between text-[10px] text-muted-foreground px-3">
									<span>0h</span>
									<span>6h</span>
									<span>12h</span>
									<span>18h</span>
									<span>24h</span>
								</div>
							</div>
							<select bind:value={multiDayStartHour} class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
								{#each Array.from({ length: TOTAL_HOURS }, (_, i) => DAY_START + i) as h}
									{@const isValid = multiDayStartHours.includes(h)}
									<option value={h} disabled={!isValid}>
										{formatHour(h)}{!isValid ? ' (conflit)' : ''}
									</option>
								{/each}
							</select>
							{#if multiDaySlotStartH > DAY_START}
								<p class="text-xs text-muted-foreground">
									Disponible à partir de {formatHour(multiDaySlotStartH)} — votre réservation couvrira jusqu'à {DAY_END}h.
								</p>
							{/if}
						</div>

						<!-- End day -->
						<div class="space-y-2">
							<Label>Fin — {formatDate(endDateStr)}</Label>
							<div class="space-y-1.5">
								<div class="relative h-8 rounded-[9px] bg-muted border border-border/60 mx-1">
									<!-- User's selection -->
									<div
										class="absolute top-[3px] bottom-[3px] rounded-[5px] bg-primary shadow-sm transition-all duration-200"
										style="left: calc(0% + 3px); width: calc({((multiDayEndHour - DAY_START) / TOTAL_HOURS) * 100}% - 6px);"
									></div>
									<!-- Booked part after the available slot -->
									{#if multiDaySlotEndH < DAY_END}
										<div
											class="absolute top-[3px] bottom-[3px] rounded-[5px] bg-accent/70"
											style="left: calc({((multiDaySlotEndH - DAY_START) / TOTAL_HOURS) * 100}% + 3px); width: calc({((DAY_END - multiDaySlotEndH) / TOTAL_HOURS) * 100}% - 6px);"
										></div>
									{/if}
								</div>
								<div class="flex justify-between text-[10px] text-muted-foreground px-3">
									<span>0h</span>
									<span>6h</span>
									<span>12h</span>
									<span>18h</span>
									<span>24h</span>
								</div>
							</div>
							<select bind:value={multiDayEndHour} class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
								{#each Array.from({ length: TOTAL_HOURS }, (_, i) => DAY_START + 1 + i) as h}
									{@const isValid = multiDayEndHoursValid.includes(h)}
									<option value={h} disabled={!isValid}>
										{formatHour(h)}{!isValid ? ' (conflit)' : ''}
									</option>
								{/each}
							</select>
							{#if multiDaySlotEndH < DAY_END}
								<p class="text-xs text-muted-foreground">
									Disponible jusqu'à {formatHour(multiDaySlotEndH)} — votre réservation couvrira depuis {DAY_START}h.
								</p>
							{/if}
						</div>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	{:else if hasDateSelection && !loadingSlots && !hasAvailableTime && !multiDay}
		<Card.Root>
			<Card.Content class="py-6 text-center">
				<p class="text-destructive font-medium">Aucun créneau disponible</p>
				<p class="text-sm text-muted-foreground mt-1">Cette date est entièrement réservée. Veuillez choisir une autre date.</p>
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- Confirmation -->
	{#if hasDateSelection && !loadingSlots && hasAvailableTime && multiDayValid}
		<Card.Root>
			<Card.Header>
				<Card.Title>Résumé</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-3">
				<div class="rounded-md bg-muted p-3 text-sm space-y-1">
					{#if multiDay}
						<p><span class="font-medium">Du</span> {formatDate(startDateStr)} à {formatHour(multiDayStartHour)}</p>
						<p><span class="font-medium">Au</span> {formatDate(endDateStr)} à {formatHour(multiDayEndHour)}</p>
					{:else}
						<p><span class="font-medium">Date :</span> {formatDate(startDateStr)}</p>
						<p><span class="font-medium">Horaire :</span> {formatHour(startHour)} → {formatHour(endHour)}</p>
					{/if}
					{#if data.spots.length > 1}
						<p><span class="font-medium">Place :</span> {data.spots.find((s: { id: number; name: string }) => s.id === selectedSpotId)?.name}</p>
					{/if}
				</div>

				<div class="space-y-2">
					<Label for="note">Note (optionnel)</Label>
					<Input id="note" type="text" placeholder="ex. livraison prévue" bind:value={note} />
				</div>

				<Button class="w-full" disabled={loading} onclick={handleSubmit}>
					{loading ? 'Réservation...' : 'Confirmer la réservation'}
				</Button>
			</Card.Content>
		</Card.Root>
	{/if}
</div>

<style>
	:global([data-booking-status="partial"]:not([data-range-middle]):not([data-range-start]):not([data-range-end])) {
		background-color: hsl(var(--accent) / 0.4);
	}
	:global([data-booking-status="full"]:not([data-range-middle]):not([data-range-start]):not([data-range-end])) {
		background-color: hsl(var(--accent) / 0.7);
	}
	:global([data-booking-status]:not([data-selected]):hover) {
		background-color: hsl(var(--primary) / 0.15) !important;
	}
	:global([data-booking-status][data-range-start]),
	:global([data-booking-status][data-range-end]) {
		background-color: hsl(var(--primary)) !important;
		color: hsl(var(--primary-foreground)) !important;
	}
</style>
