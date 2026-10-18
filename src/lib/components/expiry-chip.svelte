<script lang="ts">
	import Clock from '@lucide/svelte/icons/clock';
	import { MS_PER_HOUR } from '$lib/constants';
	import { formatCompactDateTimeFr, formatCountdownDuration } from '$lib/utils/time';

	/**
	 * Invitation countdown pill: bordered chip with clock icon, full expiry
	 * date in a native tooltip, destructive tones under one hour. Renders
	 * nothing when there is no expiry or it already passed (lazy reap
	 * normally prevents the latter; render nothing rather than a dead state).
	 */
	interface Props {
		expiresAt: string | null;
	}

	let { expiresAt }: Props = $props();

	const chip = $derived.by(() => {
		if (!expiresAt) return null;
		const diff = new Date(expiresAt).getTime() - Date.now();
		if (diff <= 0) return null;
		return {
			text: `Expire dans ${formatCountdownDuration(diff)}`,
			urgent: diff < MS_PER_HOUR,
			title: formatCompactDateTimeFr(expiresAt)
		};
	});
</script>

{#if chip}
	<span
		class="pill-chip {chip.urgent
			? 'border-destructive/30 bg-destructive/10 text-destructive'
			: 'border-warning/40 bg-warning/10 text-warning'}"
		title={chip.title}
	>
		<Clock class="h-3 w-3" />
		{chip.text}
	</span>
{/if}
