<script lang="ts">
	import Pencil from '@lucide/svelte/icons/pencil';
	import X from '@lucide/svelte/icons/x';
	import type { BookingWithFlat } from '$lib/types';
	import { bookingLiveness } from '$lib/utils/time';
	import BookingDetailBody from './booking-detail-body.svelte';
	import DrawerActionFooter from './drawer-action-footer.svelte';
	import DrawerShell from './drawer-shell.svelte';

	interface Props {
		open: boolean;
		onClose?: (open: boolean) => void;
		booking: BookingWithFlat | null;
		/** Page rule for who may modify (calendar: own bookings only; lists: all listed) */
		canModify: boolean;
		/** When provided, the lot cell links there (admin drawer navigates to the lot) */
		lotHref?: string | null;
		/** When provided, the spot cell links there (admin drawer navigates to the spot) */
		spotHref?: string | null;
		onEdit: (id: number) => void;
		onCancel: (id: number) => void;
		onNoteChanged: () => void;
	}

	let {
		open,
		onClose,
		booking,
		canModify,
		lotHref = null,
		spotHref = null,
		onEdit,
		onCancel,
		onNoteChanged
	}: Props = $props();

	// Single rule for the whole app: actions only for modifiable, non-past, non-cancelled bookings.
	const showActions = $derived(
		booking !== null &&
			canModify &&
			booking.status !== 'cancelled' &&
			bookingLiveness(booking.startTime, booking.endTime) !== 'past'
	);
</script>

<!-- Shared booking drawer: one component, one rule, used by every page -->
<DrawerShell {open} {onClose}>
	{#snippet footer()}
		{#if showActions && booking}
			<DrawerActionFooter
				actions={[
					{ label: 'Modifier', icon: Pencil, tone: 'primary' as const, onclick: () => onEdit(booking.id) },
					{
						label: 'Annuler',
						icon: X,
						tone: 'destructive',
						onclick: () => onCancel(booking.id)
					}
				]}
			/>
		{/if}
	{/snippet}
	{#if booking}
		<BookingDetailBody {booking} {onNoteChanged} {lotHref} {spotHref} />
	{/if}
</DrawerShell>
