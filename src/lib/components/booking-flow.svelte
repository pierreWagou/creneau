<script lang="ts">
	import { type DateValue, getLocalTimeZone, parseDate, today } from '@internationalized/date';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import { onDestroy, onMount, tick } from 'svelte';
	import { CALENDAR_LOOKAHEAD_MONTHS } from '$lib/constants';
	import AsyncButton from './async-button.svelte';
	import FormField from './form-field.svelte';
	import HourRangePicker from './hour-range-picker.svelte';
	import SpotChip from './spot-chip.svelte';
	import SpotChipPicker, { type SpotChipOption } from './spot-chip-picker.svelte';
	import { Button } from './ui/button';
	import * as Card from './ui/card';
	import { Input } from './ui/input';
	import { Label } from './ui/label';
	import { RangeCalendar } from './ui/range-calendar';
	import './booking-flow.css';
	import { type AvailableSlot, type BookingWithFlat, type CalendarDayStatus, DAY_END, DAY_START } from '$lib/types';
	import { apiFetch } from '$lib/utils/api';
	import { createBookingSSE } from '$lib/utils/sse';
	import { dayBounds, formatDateFr, formatDateISO, formatDateShortFr, getHourFromISO, padH, parseFrDateInput, TIME_BLOCKS, type TimeBlockKey } from '$lib/utils/time';

	export interface BookingSelection {
		spotNumber: string;
		startTime: string;
		endTime: string;
		note?: string | null;
	}

	export interface FlowValidity {
		canSubmit: boolean;
		submitting: boolean;
		spotNumber: string;
	}

	interface Props {
		spots: SpotChipOption[];
		initialSpot?: string | null;
		/** Edit mode: booking id excluded from the timeline so its own slot reads free. */
		excludeBookingId?: number | null;
		calendarStatuses?: CalendarDayStatus[];
		prefilledDate?: string | null;
		prefilledEndDate?: string | null;
		prefilledStartHour?: number | null;
		prefilledEndHour?: number | null;
		prefilledNote?: string | null;
		submitLabel: string;
		submittingLabel?: string;
		/** Hide the summary card + submit button (a parent dialog renders its own footer actions). */
		hideSummary?: boolean;
		/** Reports validity/loading/selection so a parent footer can drive submit (edit mode). */
		onValidityChange?: (state: FlowValidity) => void;
		/** Hide the note field (kept for API compat; the dialog behind stays inert
			while editing, so the visible field is the only writer). */
		showNote?: boolean;
	/** Dialog arrival: first picker glide positions instantly, no motion. */
	instantArrival?: boolean;
		onSubmit: (selection: BookingSelection) => Promise<void> | void;
	}

	let {
		spots,
		initialSpot = null,
		excludeBookingId = null,
		calendarStatuses = [],
		prefilledDate = null,
		prefilledEndDate = null,
		prefilledStartHour = null,
		prefilledEndHour = null,
		prefilledNote = null,
		submitLabel,
		submittingLabel = 'Enregistrement…',
		hideSummary = false,
		onValidityChange,
		showNote = true,
		instantArrival = false,
		onSubmit
	}: Props = $props();

	// Live statuses for the flow's own spot (edit mode mounts with [] and fills in on mount)
	let liveStatuses = $state<CalendarDayStatus[]>(calendarStatuses);

	// Constants
	const tz = getLocalTimeZone();
	const todayDate = today(tz);
	const TOTAL_HOURS = DAY_END - DAY_START;

	// Form state
	let selectedSpot = $state(initialSpot ?? spots[0]?.number ?? '');
	let calendarValue = $state<{ start: DateValue | undefined; end: DateValue | undefined } | undefined>(
		prefilledDate
			? {
					start: parseDate(prefilledDate),
					end: parseDate(prefilledEndDate || prefilledDate)
				}
			: undefined
	);
	// Viewed month (chevron navigation): drives status fetching + repaint.
	// Seeded from the prefilled date when present, so the placeholder month
	// matches the value month from the start (mirrors bits' own sync target).
	let calPlaceholder = $state<DateValue | undefined>(
		prefilledDate ? parseDate(prefilledDate) : undefined
	);
	const viewedMonthKey = $derived(calPlaceholder ? calPlaceholder.toString().slice(0, 7) : '');

	function viewedMonthStart(): Date {
		if (!viewedMonthKey) return new Date();
		const [y, m] = viewedMonthKey.split('-').map(Number);
		return new Date(y, m - 1, 1);
	}

	// One-way calendar flow (value/onValueChange, placeholder/onPlaceholderChange):
	// identity churn from bits can never retrigger anything — assignment happens
	// only when the ISO strings actually differ.
	function rangeKey(r: { start?: DateValue; end?: DateValue } | null | undefined): string {
		return `${r?.start?.toString() ?? ''}|${r?.end?.toString() ?? ''}`;
	}
	function handleCalendarValueChange(v: { start?: DateValue; end?: DateValue } | undefined) {
		const next = v?.start || v?.end ? { start: v?.start, end: v?.end } : undefined;
		if (rangeKey(next) !== rangeKey(calendarValue)) calendarValue = next;
	}
	function handlePlaceholderChange(d: DateValue) {
		if (d.toString() !== calPlaceholder?.toString()) calPlaceholder = d;
	}
	let startHour = $state(prefilledStartHour ?? DAY_START);
	let endHour = $state(prefilledEndHour ?? DAY_END);
	// Bumped on preset taps so the single-day picker glides to the selection.
	let presetGlide = $state(0);
	// Bumped when a date selection resets the hours, so the pickers glide to
	// the new selection (container-locally — the page never moves).
	let dateGlide = $state(0);
	let multiDayStartHour = $state(prefilledStartHour ?? DAY_START);
	let multiDayEndHour = $state(prefilledEndHour ?? DAY_END);
	let note = $state(prefilledNote ?? '');
	let loading = $state(false);
	let loadingSlots = $state(false);

	// Available slots (fetched when user selects dates)
	let availableSlots = $state<AvailableSlot[]>([]);

	// Bookings for the selected date (for capsule display)
	let dayBookings = $state<BookingWithFlat[]>([]);

	// SSE for real-time updates
	let sse: ReturnType<typeof createBookingSSE> | null = null;

	onMount(() => {
		refreshCalendarStatuses(viewedMonthStart());
		const refresh = () => {
			refreshCalendarStatuses(viewedMonthStart());
			if (hasDateSelection) fetchTimeline();
		};
		sse = createBookingSSE({
			onCreated: refresh,
			onCancelled: refresh,
			onUpdated: refresh
		});
		// Mount the calendar one task after our open-storm settles, so bits
		// initializes into stable value/placeholder instead of mid-cascade ones.
		tick().then(() => {
			calendarReady = true;
			// Edit arrival: glide the hour pickers to the prefilled selection.
			// Create mode mounts quiet — the lists stay put until asked.
			if (excludeBookingId !== null) dateGlide += 1;
		});
	});

	onDestroy(() => {
		sse?.destroy();
	});

	// ============================================================
	// Data fetching
	// ============================================================

	// Generation guard: rapid month navigation supersedes in-flight fetches.
	let statusRequestGen = 0;
	let timelineRequestGen = 0;

	async function refreshCalendarStatuses(fromDate = new Date()) {
		const gen = ++statusRequestGen;
		const from = formatDateISO(new Date(fromDate.getFullYear(), fromDate.getMonth(), 1));
		const toDate = new Date(fromDate.getFullYear(), fromDate.getMonth() + CALENDAR_LOOKAHEAD_MONTHS, 0);
		const to = formatDateISO(toDate);

		const result = await apiFetch<{ statuses: CalendarDayStatus[] }>(
			`/api/calendar-statuses?from=${from}&to=${to}&spot=${selectedSpot}${excludeBookingId !== null ? `&exclude=${excludeBookingId}` : ''}`
		);
		if (gen !== statusRequestGen) return; // superseded by a newer range — ignore
		if (result.ok && result.data) {
			liveStatuses = result.data.statuses;
		}
		// Silently fail otherwise
	}

	async function fetchTimeline() {
		if (!startDateStr) return;
		const from = startDateStr;
		const to = multiDay ? endDateStr : startDateStr;
		if (!from || !to) return;

		loadingSlots = true;
		const gen = ++timelineRequestGen;
		const exclude = excludeBookingId !== null ? `&exclude=${excludeBookingId}` : '';
		const result = await apiFetch<{ available: AvailableSlot[]; bookings: BookingWithFlat[] }>(
			`/api/timeline?from=${from}&to=${to}&spot=${selectedSpot}${exclude}`
		);
		if (gen !== timelineRequestGen) return; // superseded — the newer run owns loadingSlots + slots
		loadingSlots = false;
		if (result.ok && result.data) {
			availableSlots = result.data.available;
			dayBookings = result.data.bookings;
		} else {
			availableSlots = [];
			dayBookings = [];
		}
	}

	// Re-fetch calendar statuses when spot changes.
	// The first-run flag (not a previous-value comparison) is load-bearing:
	// in create mode the initial spot arrives with server-side statuses (skip),
	// in edit mode the locked spot arrives with none (must fetch on mount).
	let isFirstSpotRun = true;
	let initialSpotId = initialSpot;
	$effect(() => {
		const currentSpotId = selectedSpot;
		if (isFirstSpotRun && currentSpotId === initialSpotId) {
			isFirstSpotRun = false;
			return;
		}
		isFirstSpotRun = false;
		// Deliberately floating: both fetches are generation-guarded and
		// apiFetch never rejects, so no catch path can strand state.
		void refreshCalendarStatuses(viewedMonthStart());
		if (hasDateSelection) void fetchTimeline();
	});

	// Fetch available slots when date selection changes
	$effect(() => {
		if (startDateStr) {
			// Also track endDateStr for multi-day
			endDateStr;
			void fetchTimeline();
		} else {
			availableSlots = [];
			dayBookings = [];
		}
	});

	// Refetch statuses when chevron navigation moves the viewed month.
	$effect(() => {
		if (!viewedMonthKey) return;
		void refreshCalendarStatuses(viewedMonthStart());
	});

	// ============================================================
	// Derived state
	// ============================================================

	let multiDay = $derived(
		calendarValue?.start && calendarValue?.end ? calendarValue.start.toString() !== calendarValue.end.toString() : false
	);
	let startDateStr = $derived(calendarValue?.start ? calendarValue.start.toString() : '');
	let endDateStr = $derived(calendarValue?.end ? calendarValue.end.toString() : '');
	let hasDateSelection = $derived(calendarValue?.start !== undefined);

	// Editable date boxes (mirror calendarValue; commit on Enter/blur, normalize
	// to canonical format on every commit; skipped while focused mid-typing).
	let startBox = $state('');
	let endBox = $state('');
	let focusedBox = $state<'start' | 'end' | null>(null);
	let dateBoxError = $state('');

	$effect(() => {
		if (focusedBox !== 'start') startBox = startDateStr ? formatDateShortFr(startDateStr) : '';
		if (focusedBox !== 'end')
			endBox = endDateStr
				? formatDateShortFr(endDateStr)
				: startDateStr
					? formatDateShortFr(startDateStr)
					: '';
	});

	function revertDateBox(which: 'start' | 'end', message: string) {
		const fallback = which === 'start' ? startDateStr : endDateStr || startDateStr;
		const text = fallback ? formatDateShortFr(fallback) : '';
		if (which === 'start') startBox = text;
		else endBox = text;
		dateBoxError = message;
	}

	function commitDateBox(which: 'start' | 'end') {
		const iso = parseFrDateInput(which === 'start' ? startBox : endBox);
		if (!iso) {
			revertDateBox(which, 'Utilisez JJ/MM/AAAA ou « 12 octobre 2026 »');
			return;
		}
		if (iso < formatDateISO(new Date())) {
			revertDateBox(which, 'La date ne peut pas être dans le passé');
			return;
		}
		let nextStart = which === 'start' ? iso : startDateStr;
		let nextEnd = which === 'end' ? iso : endDateStr || startDateStr;
		if (nextStart > nextEnd) [nextStart, nextEnd] = [nextEnd, nextStart];
		calendarValue = { start: parseDate(nextStart), end: parseDate(nextEnd) };
		if (which === 'start') startBox = formatDateShortFr(nextStart);
		else endBox = formatDateShortFr(nextEnd);
		dateBoxError = '';
	}

	// ============================================================
	// Client-side derivations from available slots
	// ============================================================

	/** Clip available slots to a single day's boundaries, returning hour-based ranges */
	function getDaySlotsForDate(date: string): { start: number; end: number }[] {
		const { start: dayStart, end: dayEnd } = dayBounds(date);

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
		return daySlots.flatMap((s) => Array.from({ length: s.end - s.start }, (_, i) => s.start + i));
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
	function isPresetAvailable(
		daySlots: { start: number; end: number }[],
		presetStart: number,
		presetEnd: number
	): boolean {
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
	let multiDaySlotEndH = $derived(
		multiDayEndHoursValid.length > 0 ? multiDayEndHoursValid[multiDayEndHoursValid.length - 1] : DAY_END
	);

	// Full day preset availability
	let fullDayAvailable = $derived(isPresetAvailable(startDaySlots, DAY_START, DAY_END));

	let hasAvailableTime = $derived.by(() => {
		if (!hasDateSelection || loadingSlots) return false;
		if (multiDay) {
			return multiDayValid;
		}
		return validStartHours.length > 0;
	});

	/** Get actual bookings for the start day, clipped to day boundaries */
	let startDayBookedRanges = $derived.by(() => {
		if (!startDateStr) return [];
		const { start: dayStart, end: dayEnd } = dayBounds(startDateStr);

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

	let skipAutoSelect = prefilledStartHour !== null && prefilledEndHour !== null;
	let needsEndHourFromStart = prefilledStartHour !== null && prefilledEndHour === null;
	// Termination fingerprint (plain let, like isFirstSpotRun — deliberately
	// non-reactive): auto-select picks defaults at most once per date range.
	// Without it, any downstream dep bump re-runs this effect and its
	// dateGlide++ keeps the flush cascade alive forever (effect_update_depth_exceeded).
	// Bonus: refetches can never clobber hours the user picked themselves.
	let lastAutoKey = '';

	$effect(() => {
		// Edit mode: hours arrive prefilled and correct — auto-select is a
		// create-mode convenience. Running it here clobbers the booking's
		// hours with the largest free slot, so it stays off when editing.
		if (excludeBookingId !== null) return;
		if (!hasDateSelection || !hasAvailableTime) return;

		// If both hours were prefilled (from drag-select), skip entirely on first load
		if (skipAutoSelect) {
			skipAutoSelect = false;
			// Prefilled hours are user intent: mark the range done so the main
			// branch below never clobbers them (same as the fingerprint).
			lastAutoKey = `${startDateStr}|${endDateStr}`;
			dateGlide++;
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
			// Completed prefill counts as user intent for this range too.
			lastAutoKey = `${startDateStr}|${endDateStr}`;
			dateGlide++;
			return;
		}

		const autoKey = `${startDateStr}|${endDateStr}`;
		if (autoKey === lastAutoKey) return;
		lastAutoKey = autoKey;

		if (!multiDay) {
			// Select the largest available slot
			if (startDaySlots.length > 0) {
				const largest = [...startDaySlots].sort((a, b) => b.end - b.start - (a.end - a.start))[0];
				startHour = largest.start;
				endHour = largest.end;
				dateGlide++;
			}
		} else if (multiDaySlot) {
			// Multi-day: pick first valid start, latest valid end
			if (multiDayStartHours.length > 0) {
				multiDayStartHour = multiDayStartHours[0];
			}
			if (multiDayEndHoursValid.length > 0) {
				multiDayEndHour = multiDayEndHoursValid[multiDayEndHoursValid.length - 1];
			}
			dateGlide++;
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
		startHour = parseInt(block.start.split(':')[0], 10);
		endHour = parseInt(block.end.split(':')[0], 10);
		presetGlide++;
	}

	function applyFullDay() {
		startHour = DAY_START;
		endHour = DAY_END;
		presetGlide++;
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
		const date = multiDay ? endDateStr || startDateStr : startDateStr;
		return `${date}T${padH(h)}:00:00`;
	}

	async function handleSubmit() {
		if (!hasDateSelection) return;
		loading = true;

		try {
			await onSubmit({
				spotNumber: selectedSpot,
				startTime: getStartTimeStr(),
				endTime: getEndTimeStr(),
				note: showNote ? note || null : undefined
			});
		} finally {
			loading = false;
		}
	}

	/** Footer-driven submit (edit dialog): same path + loading guard as the summary button. */
	export function submit(): Promise<void> {
		return handleSubmit();
	}

	// Parent footer mirror (edit mode): same conditions as the summary card.
	$effect(() => {
		onValidityChange?.({
			canSubmit: hasDateSelection && !loadingSlots && hasAvailableTime && multiDayValid && !loading,
			submitting: loading,
			spotNumber: selectedSpot
		});
	});

	// ============================================================
	// Formatting helpers
	// ============================================================

	function formatHour(h: number): string {
		return `${padH(h)}:00`;
	}

	function getDayStatus(dateStr: string): string {
		return liveStatuses.find((d) => d.date === dateStr)?.status ?? 'free';
	}

	function getDayRatio(dateStr: string): number {
		return liveStatuses.find((d) => d.date === dateStr)?.ratio ?? 0;
	}

	// Minimum visible tone: even a 5% booked day reads (tunable; mirrored by
	// the legend gradient low end in booking-flow.css).
	const RATIO_FLOOR = 0.15;

	// Calendar cell coloring
	let calendarContainer = $state<HTMLElement | null>(null);
	// Gate for the RangeCalendar (see onMount): bits must mount into settled props.
	let calendarReady = $state(false);

	$effect(() => {
		if (!calendarContainer) return;
		liveStatuses;
		calendarValue;
		viewedMonthKey;

		requestAnimationFrame(() => {
			const todayIso = formatDateISO(new Date());
			const cells = calendarContainer?.querySelectorAll('[data-bits-day]');
			cells?.forEach((cell) => {
				const el = cell as HTMLElement;
				const dateAttr = el.getAttribute('data-value');
				el.removeAttribute('data-booking-status');
				el.style.removeProperty('--fill');
				if (!dateAttr) return;
				// Past days are unreservable: never painted.
				if (dateAttr < todayIso) return;
				const status = getDayStatus(dateAttr);
				if (status === 'free') return;
				const ratio = getDayRatio(dateAttr);
				if (ratio <= 0) return;
				el.setAttribute('data-booking-status', status);
				el.style.setProperty('--fill', `${Math.round(Math.max(ratio, RATIO_FLOOR) * 100)}%`);
			});
		});
	});
</script>

<div class="space-y-4">
	<!-- Date selection -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Quand avez-vous besoin de la place de parking ?</Card.Title>
			<p class="text-muted-foreground text-sm">Sélectionnez un jour ou une plage de dates</p>
		</Card.Header>
		<Card.Content class="space-y-4">
			{#if spots.length > 1}
				<SpotChipPicker options={spots} value={selectedSpot} onSelect={(n) => (selectedSpot = n)} />
			{:else if spots.length === 1}
				{@const only = spots[0]}
				<div class="flex items-center gap-2">
					<span class="text-muted-foreground text-sm">Place de parking</span>
					<SpotChip label={only.number} size="md" status={only.status ?? null} tint={only.tint ?? null} />
				</div>
			{/if}

		<div class="relative flex justify-center" bind:this={calendarContainer}>
			{#if calendarReady}
				<RangeCalendar
					value={calendarValue}
					onValueChange={handleCalendarValueChange}
					placeholder={calPlaceholder}
					onPlaceholderChange={handlePlaceholderChange}
					locale="fr-FR"
					weekdayFormat="short"
					minValue={todayDate}
					buttonVariant="outline"
					class="[--cell-size:--spacing(9)] sm:[--cell-size:--spacing(12)]"
				/>
			{/if}
		</div>

		<div class="text-muted-foreground grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
			<span class="text-right">Partiellement réservé</span>
			<span class="booking-scale-legend border-booking-busy/60 h-3 w-24 rounded-sm border" aria-hidden="true"></span>
			<span>Complet</span>
		</div>

		{#if hasDateSelection}
			<div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
				<input
					type="text"
					aria-label="Date de début"
					bind:value={startBox}
					onfocus={() => (focusedBox = 'start')}
					onblur={() => {
						commitDateBox('start');
						focusedBox = null;
					}}
					onkeydown={(e) => {
						if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
					}}
					oninput={() => {
						dateBoxError = '';
					}}
					class="border-input bg-background h-10 min-w-0 rounded-lg border px-3 text-center text-sm"
				/>
				<span class="text-muted-foreground" aria-hidden="true">–</span>
				<input
					type="text"
					aria-label="Date de fin"
					bind:value={endBox}
					onfocus={() => (focusedBox = 'end')}
					onblur={() => {
						commitDateBox('end');
						focusedBox = null;
					}}
					onkeydown={(e) => {
						if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
					}}
					oninput={() => {
						dateBoxError = '';
					}}
					class="border-input bg-background h-10 min-w-0 rounded-lg border px-3 text-center text-sm"
				/>
			</div>
			{#if dateBoxError}
				<p class="text-destructive text-center text-xs">{dateBoxError}</p>
			{/if}
		{/if}
		</Card.Content>
	</Card.Root>

	<!-- Loading state -->
	{#if hasDateSelection && loadingSlots}
		<Card.Root>
			<Card.Content class="py-6 text-center">
				<LoaderCircle class="text-primary mx-auto h-5 w-5 animate-spin" />
				<p class="text-muted-foreground mt-2 text-sm">Recherche des créneaux disponibles…</p>
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- Multi-day not possible -->
	{#if hasDateSelection && !loadingSlots && multiDay && !multiDayValid}
		<Card.Root class="border-destructive/50">
			<Card.Content class="py-4">
				<p class="text-destructive text-sm font-medium">Réservation sur plusieurs jours impossible</p>
				<p class="text-muted-foreground mt-1 text-sm">
					Aucun créneau continu n'est disponible sur toute la période sélectionnée. Une réservation existante bloque la
					continuité.
				</p>
				<p class="text-muted-foreground mt-3 text-sm">
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
							<div class="bg-muted border-border/60 relative mx-1 h-10 rounded-[10px] border">
								<!-- Booked ranges -->
								{#each startDayBookedRanges as range (`${range.start}-${range.end}-${range.flatNumber}`)}
									<div
										class="bg-booking-busy/70 absolute top-[4px] bottom-[4px] flex items-center justify-center overflow-hidden rounded-[6px]"
										style="left: calc({((range.start - DAY_START) / TOTAL_HOURS) *
											100}% + 4px); width: calc({((range.end - range.start) / TOTAL_HOURS) * 100}% - 8px);"
									>
										<span class="text-accent-foreground truncate px-1 text-[9px] font-medium">
											{range.flatNumber}{range.note ? ` · ${range.note}` : ''}
										</span>
									</div>
								{/each}
								<!-- User's selection -->
								<div
									class="bg-primary absolute top-[4px] bottom-[4px] rounded-[6px] shadow-sm transition-all duration-200"
									style="left: calc({((startHour - DAY_START) / TOTAL_HOURS) * 100}% + 4px); width: calc({((endHour -
										startHour) /
										TOTAL_HOURS) *
										100}% - 8px);"
								></div>
							</div>
							<div class="text-muted-foreground flex justify-between px-3 text-[10px]">
								<span>0h</span>
								<span>6h</span>
								<span>12h</span>
								<span>18h</span>
								<span>24h</span>
							</div>
						</div>

						<!-- Quick presets -->
						<div class="space-y-2">
							<span class="text-muted-foreground text-xs font-medium">Créneaux rapides</span>
							<div class="space-y-3">
								<Button
									variant={!fullDayAvailable
										? 'ghost'
										: startHour === DAY_START && endHour === DAY_END
											? 'default'
											: 'outline'}
									size="sm"
									class="w-full text-xs {!fullDayAvailable ? 'opacity-40' : ''}"
									disabled={!fullDayAvailable}
									onclick={applyFullDay}
								>
									Journée entière
								</Button>
								<div class="grid grid-cols-3 gap-3">
									{#each Object.entries(TIME_BLOCKS) as [key, block]}
										{@const presetStart = parseInt(block.start.split(':')[0])}
										{@const presetEnd = parseInt(block.end.split(':')[0])}
										{@const available = isPresetAvailable(startDaySlots, presetStart, presetEnd)}
										{@const presetSelected = startHour === presetStart && endHour === presetEnd}
										<Button
											variant={!available ? 'ghost' : presetSelected ? 'default' : 'outline'}
											size="sm"
											class="text-xs {!available ? 'opacity-40' : ''}"
											disabled={!available}
											onclick={() => applyPreset(key as TimeBlockKey)}
										>
											{block.label}
										</Button>
									{/each}
								</div>
							</div>
						</div>

						<!-- Time pair picker -->
						<div class="space-y-1">
							<div class="grid grid-cols-2 gap-2 px-3">
								<Label class="text-xs font-medium">Début</Label>
								<Label class="text-right text-xs font-medium">Fin</Label>
							</div>
							<HourRangePicker
								startHour={startHour}
								endHour={endHour}
								validStartHours={validStartHours}
								validEndHours={validEndHoursForSelection}
								glideSignal={presetGlide + dateGlide}
								instantFirstGlide={instantArrival}
								onStart={(h) => (startHour = h)}
								onEnd={(h) => (endHour = h)}
							/>
						</div>

						<!-- Available slots summary -->
						{#if startDaySlots.length > 1}
							<p class="text-muted-foreground text-sm">
								{startDaySlots.length} créneaux disponibles : {startDaySlots
									.map((s) => `${formatHour(s.start)}-${formatHour(s.end)}`)
									.join(', ')}
							</p>
						{/if}
					</div>
				{:else if multiDaySlot}
					<!-- Multi-day -->
					<div class="space-y-4">
						<!-- Start day -->
						<div class="space-y-2">
							<Label>Début — {formatDateFr(startDateStr)}</Label>
							<div class="space-y-1.5">
								<div class="bg-muted border-border/60 relative mx-1 h-8 rounded-[9px] border">
									<!-- Booked part before the available slot -->
									{#if multiDaySlotStartH > DAY_START}
										<div
										class="bg-booking-busy/70 absolute top-[3px] bottom-[3px] rounded-[5px]"
										style="left: calc(0% + 3px); width: calc({((multiDaySlotStartH - DAY_START) / TOTAL_HOURS) *
											100}% - 6px);"
										></div>
									{/if}
									<!-- User's selection -->
									<div
										class="bg-primary absolute top-[3px] bottom-[3px] rounded-[5px] shadow-sm transition-all duration-200"
										style="left: calc({((multiDayStartHour - DAY_START) / TOTAL_HOURS) *
											100}% + 3px); width: calc({((DAY_END - multiDayStartHour) / TOTAL_HOURS) * 100}% - 6px);"
									></div>
								</div>
								<div class="text-muted-foreground flex justify-between px-3 text-[10px]">
									<span>0h</span>
									<span>6h</span>
									<span>12h</span>
									<span>18h</span>
									<span>24h</span>
								</div>
							</div>
							<HourRangePicker
								startHour={multiDayStartHour}
								endHour={DAY_END}
								validStartHours={multiDayStartHours}
								validEndHours={[DAY_END]}
								label="Heure de début"
								glideSignal={dateGlide}
								instantFirstGlide={instantArrival}
								onStart={(h) => (multiDayStartHour = h)}
								onEnd={() => {
									// Fixed end (midnight) — single enabled option, nothing to change.
								}}
							/>
							{#if multiDaySlotStartH > DAY_START}
								<p class="text-muted-foreground text-sm">
									Disponible à partir de {formatHour(multiDaySlotStartH)} — votre réservation couvrira jusqu'à {DAY_END}h.
								</p>
							{/if}
						</div>

						<!-- End day -->
						<div class="space-y-2">
							<Label>Fin — {formatDateFr(endDateStr)}</Label>
							<div class="space-y-1.5">
								<div class="bg-muted border-border/60 relative mx-1 h-8 rounded-[9px] border">
									<!-- User's selection -->
									<div
										class="bg-primary absolute top-[3px] bottom-[3px] rounded-[5px] shadow-sm transition-all duration-200"
										style="left: calc(0% + 3px); width: calc({((multiDayEndHour - DAY_START) / TOTAL_HOURS) *
											100}% - 6px);"
									></div>
									<!-- Booked part after the available slot -->
									{#if multiDaySlotEndH < DAY_END}
										<div
										class="bg-booking-busy/70 absolute top-[3px] bottom-[3px] rounded-[5px]"
										style="left: calc({((multiDaySlotEndH - DAY_START) / TOTAL_HOURS) *
											100}% + 3px); width: calc({((DAY_END - multiDaySlotEndH) / TOTAL_HOURS) * 100}% - 6px);"
										></div>
									{/if}
								</div>
								<div class="text-muted-foreground flex justify-between px-3 text-[10px]">
									<span>0h</span>
									<span>6h</span>
									<span>12h</span>
									<span>18h</span>
									<span>24h</span>
								</div>
							</div>
							<HourRangePicker
								startHour={DAY_START}
								endHour={multiDayEndHour}
								validStartHours={[DAY_START]}
								validEndHours={multiDayEndHoursValid}
								label="Heure de fin"
								glideSignal={dateGlide}
								instantFirstGlide={instantArrival}
								onStart={() => {
									// Fixed start (midnight) — single enabled option, nothing to change.
								}}
								onEnd={(h) => (multiDayEndHour = h)}
							/>
							{#if multiDaySlotEndH < DAY_END}
								<p class="text-muted-foreground text-sm">
									Disponible jusqu'à {formatHour(multiDaySlotEndH)} — votre réservation couvrira depuis {DAY_START}h.
								</p>
							{/if}
						</div>
					</div>
				{/if}
				{#if hideSummary && showNote && multiDayValid}
					<FormField label="Note" for="note">
						<Input id="note" type="text" placeholder="ex. livraison prévue" bind:value={note} />
					</FormField>
				{/if}
			</Card.Content>
		</Card.Root>
	{:else if hasDateSelection && !loadingSlots && !hasAvailableTime && !multiDay}
		<Card.Root>
			<Card.Content class="py-6 text-center">
				<p class="text-destructive font-medium">Aucun créneau disponible</p>
				<p class="text-muted-foreground mt-1 text-sm">
					Cette date est entièrement réservée. Veuillez choisir une autre date.
				</p>
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- Confirmation (create mode — edit dialogs render their own footer) -->
	{#if !hideSummary && hasDateSelection && !loadingSlots && hasAvailableTime && multiDayValid}
		<Card.Root>
			<Card.Header>
				<Card.Title>Résumé</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-4">
				{#if showNote}
					<FormField label="Note" for="note">
						<Input id="note" type="text" placeholder="ex. livraison prévue" bind:value={note} />
					</FormField>
				{/if}

				<AsyncButton class="w-full" disabled={loading} {loading} loadingLabel={submittingLabel} onclick={handleSubmit}>
					{submitLabel}
				</AsyncButton>
			</Card.Content>
		</Card.Root>
	{/if}
</div>
