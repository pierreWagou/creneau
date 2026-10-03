<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { Button } from '$lib/components/ui/button';
	import ValidationTip from './validation-tip.svelte';

	/**
	 * Bundled commit indicator: answers "can this draft commit?" in one fixed
	 * button-geometry box (h-7 w-7, the icon-sm basis), so ✓ / warning / spacer
	 * swaps can never misalign. Shared by InlineEditField and the PIN card.
	 */
	interface Props {
		state: 'ready' | 'invalid' | 'empty' | 'busy';
		onCommit: () => void;
		/** Tooltip message for the invalid state; null → bare icon (message shown elsewhere) */
		warningTip?: string | null;
	}

	let { state, onCommit, warningTip = null }: Props = $props();
</script>

<span class="inline-flex h-7 w-7 shrink-0 items-center justify-center">
	{#if state === 'ready'}
		<Button
			type="button"
			variant="ghost"
			size="icon-sm"
			class="text-success hover:text-success hover:!bg-success/10"
			aria-label="Valider"
			onclick={onCommit}
		>
			<Check class="h-3.5 w-3.5" />
		</Button>
	{:else if state === 'invalid'}
		{#if warningTip}
			<ValidationTip show message={warningTip}>
				<span class="inline-flex text-warning" aria-hidden="true">
					<TriangleAlert class="h-3.5 w-3.5" />
				</span>
			</ValidationTip>
		{:else}
			<span class="inline-flex text-warning" aria-hidden="true">
				<TriangleAlert class="h-3.5 w-3.5" />
			</span>
		{/if}
	{:else if state === 'busy'}
		<Button type="button" variant="ghost" size="icon-sm" class="shrink-0" disabled aria-label="Valider">
			<Check class="h-3.5 w-3.5" />
		</Button>
	{/if}
</span>
