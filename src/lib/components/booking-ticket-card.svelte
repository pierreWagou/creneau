<script lang="ts">
	import Info from '@lucide/svelte/icons/info';
	import { formatBookingRangeFr } from '$lib/utils/time';
	import BookingStatusPill from './booking-status-pill.svelte';
	import DetailCard from './detail/card.svelte';
	import IconButton from './icon-button.svelte';
	import SpotChip, { type SpotLifecycleStatus } from './spot-chip.svelte';

	interface Props {
		bookingId: number;
		spotNumber: string;
		startTime: string;
		endTime: string;
		variant: 'hero' | 'standard' | 'past';
		highlighted?: boolean;
		/** Booking lifecycle — cancelled paints the red Annulée pill. */
		status?: 'active' | 'cancelled';
		/** Spot lifecycle color (shared blue / unassigned grey / assigned lot tint). */
		spotStatus?: SpotLifecycleStatus | null;
		spotTint?: string | null;
		onOpen: () => void;
	}

	let {
		bookingId,
		spotNumber,
		startTime,
		endTime,
		variant,
		highlighted = false,
		status = 'active',
		spotStatus = null,
		spotTint = null,
		onOpen
	}: Props = $props();

	/** Compact date-only title (hours stay drawer-only): `lun. 5 mai`, `5 → 7 mai`, `30 avr. → 2 mai`. */
	const dateTitle = $derived(formatBookingRangeFr(startTime, endTime));
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions: row click is a mouse/touch shortcut; the icon-buttons are the keyboard/screen-reader path -->
<div
	role="presentation"
	data-booking-id={bookingId}
	onclick={onOpen}
	class="cursor-pointer"
>
	<DetailCard
		class="relative p-4 hoverable-card {highlighted
			? 'ring-2 ring-primary'
			: ''} {variant === 'hero' ? 'border-primary/40 bg-primary/[0.10] shadow-lg shadow-primary/25' : ''}"
	>
		<div class="flex items-center gap-3">
			<div class="min-w-0 flex-1">
				<div class="flex min-w-0 flex-1 items-center gap-2">
					<SpotChip
						label={spotNumber}
						size="md"
						status={spotStatus}
						tint={spotTint}
					/>
					<p class="{variant === 'hero' ? 'text-lg' : 'text-base'} min-w-0 shrink truncate font-semibold">
						{dateTitle}
					</p>
				</div>
			</div>
			<BookingStatusPill {startTime} {endTime} {status} />
			<div class="flex shrink-0 items-center gap-1">
				<IconButton
					icon={Info}
					label="Voir détails"
					onclick={(e) => {
						e.stopPropagation();
						onOpen();
					}}
				/>
			</div>
		</div>
	</DetailCard>
</div>
