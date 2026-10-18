<script lang="ts">
	import Pencil from '@lucide/svelte/icons/pencil';
	import { toast } from 'svelte-sonner';
	import { DIALOG_FOOTER_CLASS } from '$lib/constants';
	import { type SpotDirectoryEntry, spotChipProps } from '$lib/spot-containers';
	import type { BookingWithFlat } from '$lib/types';
	import { apiFetch } from '$lib/utils/api';
	import { dateKey, getHourFromISO } from '$lib/utils/time';
import { notifyMailFailed, notifyResult } from '$lib/utils/toasts';
	import AsyncButton from './async-button.svelte';
	import BookingFlow, { type BookingSelection, type FlowValidity } from './booking-flow.svelte';
	import DialogHeader from './dialog-header.svelte';
	import DialogShell from './dialog-shell.svelte';
	import type { SpotChipOption } from './spot-chip-picker.svelte';
	import * as AlertDialog from './ui/alert-dialog';

	interface Props {
		booking: BookingWithFlat | null;
		/** Full spot directory — options resolve to shared spots plus the booking's own. */
		spots: SpotDirectoryEntry[];
		isDark: boolean;
		onClose: () => void;
		onSaved: () => void;
	}

	let { booking, spots, isDark, onClose, onSaved }: Props = $props();

	let flowRef = $state<{ submit: () => Promise<void> } | null>(null);
	let flowState = $state<FlowValidity>({ canSubmit: false, submitting: false, spotNumber: '' });

	// Picker options: shared pool resolved through the single chip resolver,
	// plus the booking's own spot unioned in (it may have left `shared`
	// since the booking was made — the selection must never vanish).
	const spotOptions = $derived.by((): SpotChipOption[] => {
		if (!booking) return [];
		const options = spots
			.filter((s) => s.status === 'shared')
			.map((s): SpotChipOption => {
				const { spotStatus, spotTint } = spotChipProps(spots, s.number, isDark);
				return { number: s.number, status: spotStatus, tint: spotTint };
			});
		if (!options.some((o) => o.number === booking.spotNumber)) {
			const { spotStatus, spotTint } = spotChipProps(spots, booking.spotNumber, isDark);
			options.unshift({ number: booking.spotNumber, status: spotStatus, tint: spotTint });
		}
		return options;
	});

	async function saveEditFlow(selection: BookingSelection) {
		if (!booking) return;
		const result = await apiFetch<{ mailFailed?: boolean }>(
			`/api/bookings/${booking.id}`,
			{
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					startTime: selection.startTime,
					endTime: selection.endTime,
					note: selection.note ?? null,
					spotNumber: selection.spotNumber
				})
			},
			'Impossible de modifier'
		);
		if (result.ok) {
			toast.success('Réservation modifiée');
			notifyMailFailed(result.data?.mailFailed);
			onClose();
			onSaved();
		} else {
			notifyResult(result, null, 'Impossible de modifier');
		}
	}
</script>

<!-- Same primitive as the working conflict/cancel dialogs (AlertDialog, z-60).
	E dismissal is explicit (X / Modifier) — no overlay/Esc dismiss, like theirs. -->
<DialogShell kind="alert" size="lg" open={booking !== null} {onClose}>
	<DialogHeader
		kind="alert"
		icon={Pencil}
		title="Modifier la réservation"
		subtitle={booking ? `Place ${flowState.spotNumber || booking.spotNumber}` : null}
		{onClose}
	/>
		{#if booking}
			<BookingFlow
				bind:this={flowRef}
				spots={spotOptions}
				initialSpot={booking.spotNumber}
				excludeBookingId={booking.id}
				prefilledDate={dateKey(booking.startTime)}
				prefilledEndDate={dateKey(booking.endTime)}
				prefilledStartHour={getHourFromISO(booking.startTime)}
				prefilledEndHour={getHourFromISO(booking.endTime)}
				prefilledNote={booking.note}
				submitLabel="Modifier"
				instantArrival
				hideSummary
				onValidityChange={(s) => (flowState = s)}
				onSubmit={saveEditFlow}
			/>
			<AlertDialog.Footer class={DIALOG_FOOTER_CLASS}>
				<AlertDialog.Cancel>Annuler</AlertDialog.Cancel>
				<AsyncButton
					disabled={!flowState.canSubmit || flowState.submitting}
					loading={flowState.submitting}
					onclick={() => flowRef?.submit()}
				>
					Modifier
				</AsyncButton>
			</AlertDialog.Footer>
		{/if}
	</DialogShell>
