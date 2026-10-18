<script lang="ts">
	import AsyncButton from './async-button.svelte';
	import ValidationTip from './validation-tip.svelte';

	interface Props {
		valid: boolean;
		showTip?: boolean;
		tipTitle?: string;
		tipItems?: string[];
		submitLabel: string;
		loadingLabel?: string | null;
		disabled?: boolean;
		loading?: boolean;
		type?: 'button' | 'submit';
		class?: string;
		onclick?: (e: MouseEvent) => void;
	}

	let {
		valid,
		showTip = true,
		tipTitle = 'Éléments manquants :',
		tipItems = [],
		submitLabel,
		loadingLabel = null,
		disabled = false,
		loading = false,
		type = 'button',
		class: className = 'w-full',
		onclick
	}: Props = $props();
</script>

{#if !valid}
	<ValidationTip show={showTip} title={tipTitle} items={tipItems}>
		<AsyncButton {type} class={className} disabled>{submitLabel}</AsyncButton>
	</ValidationTip>
{:else}
	<AsyncButton {type} class={className} {disabled} {loading} {loadingLabel} {onclick}
		>{submitLabel}</AsyncButton
	>
{/if}
