<script lang="ts">
import MoveRight from '@lucide/svelte/icons/move-right';
import type { Snippet } from 'svelte';
import { BOUNCE_DURATION_MS, CONFLICT_CHIP_CAP, FLIGHT_DURATION_MS, SPOT_STRIP_COMPACT_COUNT } from '$lib/constants';
import { prefersReducedMotion } from '$lib/utils/motion';
import type { SpotChipState, SpotLifecycleStatus } from './spot-chip.svelte';
import SpotChip from './spot-chip.svelte';
import SpotChipList from './spot-chip-list.svelte';
import SpotEndpointCard from './spot-endpoint-card.svelte';

	export interface FlightEndpoint {
		title: string;
		spots: string[];
		/** Leading avatar; defaults to the title initial in muted tones. */
		avatar?: { initial: string; tint: string | null };
		muted?: boolean;
		titleMuted?: boolean;
		note?: string;
		singleLine?: boolean;
		showEllipsis?: boolean;
	}

	export type FlightDirection = 'forward' | 'backward' | 'bounce';

	export interface FlightMove {
		key: string;
		direction: FlightDirection;
		spot: string;
		showPreview?: boolean;
	}

	interface Props {
		source: FlightEndpoint;
		destination: FlightEndpoint;
		move: FlightMove | null;
		strikeSpot?: string | null;
		/** Lifecycle color per spot number (board/conflict resolvers); absent = legacy tones. */
		spotStatusOf?: (spot: string) => { status: SpotLifecycleStatus; tint?: string | null } | null;
		ariaLabel: string;
		role?: 'img' | 'radiogroup';
		framed?: boolean;
		sourceCard?: Snippet<[Snippet]>;
		destinationCard?: Snippet<[Snippet]>;
		center?: Snippet;
		}

	let {
		source,
		destination,
		move,
		strikeSpot = null,
		spotStatusOf,
		ariaLabel,
		role = 'img',
		framed = true,
		sourceCard,
		destinationCard,
		center,
	}: Props = $props();

	function endpointAvatar(endpoint: FlightEndpoint): { initial: string; tint: string | null } {
		return endpoint.avatar ?? { initial: endpoint.title.charAt(0).toUpperCase(), tint: null };
	}

	type FlightPhase = 'idle' | 'arming' | 'flying' | 'landed';
	type GhostOrigin = 'source' | 'destination' | null;
	type PreviewMode = 'hidden' | 'shown';

	interface GhostGeometry {
		left: number;
		top: number;
		width: number;
		height: number;
	}

	interface PendingFlight {
		key: string;
		direction: FlightDirection;
		spot: string;
		showPreview: boolean;
	}

	let phase: FlightPhase = $state('idle');
	let ghostOrigin: GhostOrigin = $state(null);
	let ghostGeometry: GhostGeometry | null = $state(null);
	let preview: PreviewMode = $state('hidden');
	let flightRun = 0;
	let frame = 0;
	let activeFlight: Animation | null = null;
	let stripEl: HTMLDivElement | null = $state(null);

	function sourceTone(spot: string): SpotChipState {
		const status = spotStatusOf?.(spot) ?? null;
		if (spot !== movingSpot) return { tone: 'muted', status: status?.status ?? null, tint: status?.tint ?? null };
		return {
			tone: strikeSpot === spot ? 'struck' : 'highlight',
			status: status?.status ?? null,
			tint: status?.tint ?? null,
			fly: 'src',
			ghosted: ghostGeometry !== null
		};
	}

	function destinationTone(spot: string): SpotChipState {
		const status = spotStatusOf?.(spot) ?? null;
		return { tone: 'muted', status: status?.status ?? null, tint: status?.tint ?? null };
	}

	const movingSpot = $derived(move?.spot ?? '');
	const destinationMuted = $derived(destination.muted === true);
	const canPreview = $derived(
		move?.direction === 'forward' &&
			move.showPreview === true &&
			movingSpot.length > 0 &&
			!destination.muted
	);

	function queryMarker(selector: string): HTMLElement | null {
		if (!stripEl) return null;
		const element = stripEl.querySelector(selector);
		return element instanceof HTMLElement ? element : null;
	}

	function stopFlight() {
		activeFlight?.cancel();
		activeFlight = null;
	}

	function finishFlight(run: number, pending: PendingFlight) {
		if (run !== flightRun) return;
		activeFlight = null;
		ghostOrigin = null;
		ghostGeometry = null;
		if (pending.direction === 'forward' && pending.showPreview) {
			preview = 'shown';
			phase = 'landed';
		} else if (pending.direction === 'backward') {
			preview = 'hidden';
			phase = 'landed';
		} else {
			preview = 'hidden';
			phase = 'idle';
		}
	}

	function measureFlight(pending: PendingFlight): {
		geometry: GhostGeometry;
		dx: number;
		dy: number;
	} | null {
		if (!stripEl || typeof window === 'undefined') return null;
		const sourceChip = queryMarker('[data-fly-src]');
		const destinationChips = queryMarker('[data-fly-dst]');
		const home = queryMarker('[data-fly-home]');
		const slot = queryMarker('[data-fly-slot]');
		if (!sourceChip) return null;

		const bounds = stripEl.getBoundingClientRect();
		const chip = sourceChip.getBoundingClientRect();
		const centerX = chip.left + chip.width / 2;
		const centerY = chip.top + chip.height / 2;

		if (pending.direction === 'backward') {
			if (!destinationChips) return null;
			const start = destinationChips.getBoundingClientRect();
			const startX = start.left + start.width / 2;
			const startY = start.top + start.height / 2;
			return {
				geometry: {
					left: startX - bounds.left - chip.width / 2,
					top: startY - bounds.top - chip.height / 2,
					width: chip.width,
					height: chip.height
				},
				dx: centerX - startX,
				dy: centerY - startY
			};
		}

		if (pending.direction === 'bounce') {
			if (!home) return null;
			const wall = home.getBoundingClientRect();
			return {
				geometry: {
					left: chip.left - bounds.left,
					top: chip.top - bounds.top,
					width: chip.width,
					height: chip.height
				},
				dx: wall.right - 2 - centerX,
				dy: 0
			};
		}

		if (!slot) return null;
		const end = slot.getBoundingClientRect();
		return {
			geometry: {
				left: chip.left - bounds.left,
				top: chip.top - bounds.top,
				width: chip.width,
				height: chip.height
			},
			dx: end.left + end.width / 2 - centerX,
			dy: end.top + end.height / 2 - centerY
		};
	}

	function playMeasuredFlight(
		run: number,
		pending: PendingFlight,
		geometry: GhostGeometry,
		dx: number,
		dy: number
	) {
		ghostGeometry = geometry;
		ghostOrigin = pending.direction === 'backward' ? 'destination' : 'source';
		phase = 'flying';
		frame = requestAnimationFrame(() => {
			if (run !== flightRun) return;
			const ghostEl = queryMarker('[data-fly-ghost]');
			if (!ghostEl) {
				finishFlight(run, pending);
				return;
			}
			const flight =
				pending.direction === 'bounce'
					? ghostEl.animate(
							[
								{ transform: 'translateX(0px)', opacity: 1 },
								{ transform: `translateX(${dx}px)`, opacity: 1, offset: 0.45 },
								{ transform: 'translateX(0px)', opacity: 1 }
							],
							{ duration: BOUNCE_DURATION_MS, easing: 'ease-in-out' }
						)
					: ghostEl.animate(
							[
								{ transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
								{
									transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 12}px) scale(1.04)`,
									opacity: 1,
									offset: 0.55
								},
								{ transform: `translate(${dx}px, ${dy}px) scale(1)`, opacity: 0 }
							],
							{ duration: FLIGHT_DURATION_MS, easing: 'ease-in-out' }
						);
			activeFlight = flight;
			flight.onfinish = () => finishFlight(run, pending);
			flight.oncancel = () => {
				activeFlight = null;
			};
		});
	}

	$effect(() => {
		const pending: PendingFlight | null = move?.key
			? {
					key: move.key,
					direction: move.direction,
					spot: move.spot,
					showPreview: move.showPreview === true
				}
			: null;
		const muted = destinationMuted;
		const run = ++flightRun;
		let cancelled = false;

		ghostOrigin = null;
		ghostGeometry = null;
		preview = 'hidden';
		phase = 'idle';
		cancelAnimationFrame(frame);
		stopFlight();
		if (!pending?.key || !pending.spot || !pending.direction) return;
		if (pending.direction === 'forward' && (!pending.showPreview || muted)) return;
		if (prefersReducedMotion()) {
			finishFlight(run, pending);
			return;
		}

		phase = 'arming';
		frame = requestAnimationFrame(() => {
			frame = requestAnimationFrame(() => {
				if (cancelled || run !== flightRun) return;
				const measurement = measureFlight(pending);
				if (!measurement) {
					finishFlight(run, pending);
					return;
				}
				if (Math.hypot(measurement.dx, measurement.dy) < 4) {
					finishFlight(run, pending);
					return;
				}
				playMeasuredFlight(run, pending, measurement.geometry, measurement.dx, measurement.dy);
			});
		});
		return () => {
			cancelled = true;
			cancelAnimationFrame(frame);
			stopFlight();
			ghostOrigin = null;
			ghostGeometry = null;
			preview = 'hidden';
			phase = 'idle';
		};
	});
</script>

{#snippet sourceChips()}
	<SpotChipList
		spots={source.spots}
		size="sm"
		cap={source.singleLine
			? canPreview
				? SPOT_STRIP_COMPACT_COUNT - 1
				: SPOT_STRIP_COMPACT_COUNT
			: CONFLICT_CHIP_CAP}
		ellipsis={source.showEllipsis === true}
		singleLine={source.singleLine === true}
		toneOf={sourceTone}
	/>
{/snippet}

{#snippet sourceContent()}
	<span class="block truncate text-sm font-semibold {source.titleMuted || source.muted ? 'text-muted-foreground' : ''}">
		{source.title}
	</span>
	{#if source.note}
		<span class="sr-only">{source.note}</span>
	{/if}
	{@render sourceChips()}
{/snippet}

{#snippet destinationPreview()}
	{#if canPreview}
		{#if preview === 'hidden'}
			<SpotChip label={movingSpot} size="sm" tone="preview" fly="slot" invisible />
		{:else}
			<SpotChip label={movingSpot} size="sm" tone="preview" fly="preview" />
		{/if}
	{/if}
{/snippet}

	{#snippet destinationChips()}
		<SpotChipList
			spots={destination.spots}
			size="sm"
			cap={destination.singleLine
				? canPreview
					? SPOT_STRIP_COMPACT_COUNT - 1
					: SPOT_STRIP_COMPACT_COUNT
				: CONFLICT_CHIP_CAP}
			ellipsis={destination.showEllipsis === true}
			singleLine={destination.singleLine === true}
			flyDst
			toneOf={destinationTone}
			trailing={destinationPreview}
		/>
	{/snippet}

{#snippet destinationContent()}
	<span class="block truncate text-sm font-semibold {destination.titleMuted || destination.muted ? 'text-muted-foreground' : ''}">
		{destination.title}
	</span>
	{#if destination.note}
		<span class="sr-only">{destination.note}</span>
	{/if}
	{@render destinationChips()}
{/snippet}

{#snippet stripBody()}
	{#if sourceCard}
		{@render sourceCard(sourceContent)}
	{:else}
		<SpotEndpointCard
			title={source.title}
			note={source.note}
			muted={source.muted}
			titleMuted={source.titleMuted}
			dashed={source.muted}
			homeMarker
			class="flex-1"
			chips={sourceChips}
			avatar={endpointAvatar(source)}
		/>
	{/if}
	{#if center}
		{@render center()}
	{:else}
		<span class="flex items-center" aria-hidden="true">
			<MoveRight class="h-4 w-4 shrink-0 text-muted-foreground" />
		</span>
	{/if}
	{#if destinationCard}
		{@render destinationCard(destinationContent)}
	{:else}
		<SpotEndpointCard
			title={destination.title}
			note={destination.note}
			muted={destination.muted}
			titleMuted={destination.titleMuted}
			dashed={destination.muted}
			class="flex-1"
			chips={destinationChips}
			avatar={endpointAvatar(destination)}
		/>
	{/if}
{/snippet}

{#snippet ghostLayer()}
	{#if ghostOrigin && ghostGeometry}
		<SpotChip
			label={movingSpot}
			size="sm"
			tone="ghost"
			fly="ghost"
			flyBounce={move?.direction === 'bounce'}
			class="pointer-events-none absolute z-10 whitespace-nowrap shadow-md"
			style="left: {ghostGeometry.left}px; top: {ghostGeometry.top}px; width: {ghostGeometry.width}px; height: {ghostGeometry.height}px; text-align: center;"
		/>
	{/if}
{/snippet}

{#snippet stripInner()}
	<div class="relative flex items-stretch gap-1.5" data-fly-strip bind:this={stripEl}>
		{@render stripBody()}
		{@render ghostLayer()}
	</div>
{/snippet}

{#if framed}
	{#if role === 'radiogroup'}
		<div
			class="rounded-lg border p-3"
			role="radiogroup"
			aria-label={ariaLabel}
			data-flight-status={phase}
			data-flight-direction={move?.direction ?? 'idle'}
			data-flight-key={move?.key ?? 'none'}
		>
			{@render stripInner()}
		</div>
	{:else}
		<div
			class="rounded-lg border p-3"
			role="img"
			aria-label={ariaLabel}
			data-flight-status={phase}
			data-flight-direction={move?.direction ?? 'idle'}
			data-flight-key={move?.key ?? 'none'}
		>
			{@render stripInner()}
		</div>
	{/if}
{:else if role === 'radiogroup'}
	<div
		class="relative flex items-stretch gap-1.5"
		role="radiogroup"
		aria-label={ariaLabel}
		data-fly-strip
		data-flight-status={phase}
		data-flight-direction={move?.direction ?? 'idle'}
		data-flight-key={move?.key ?? 'none'}
		bind:this={stripEl}
	>
		{@render stripBody()}
		{@render ghostLayer()}
	</div>
{:else}
	<div
		class="relative flex items-stretch gap-1.5"
		role="img"
		aria-label={ariaLabel}
		data-fly-strip
		data-flight-status={phase}
		data-flight-direction={move?.direction ?? 'idle'}
		data-flight-key={move?.key ?? 'none'}
		bind:this={stripEl}
	>
		{@render stripBody()}
		{@render ghostLayer()}
	</div>
{/if}
