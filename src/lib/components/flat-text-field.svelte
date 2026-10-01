<script lang="ts">
	import { Input } from '$lib/components/ui/input';

	interface Props {
		value?: string;
		label: string;
		placeholder?: string;
		required?: boolean;
		uppercase?: boolean;
		maxlength?: number | null;
		error?: string | null;
		hint?: string | null;
	}

	let {
		value = $bindable(''),
		label,
		placeholder = '',
		required = true,
		uppercase = false,
		maxlength = null,
		error = null,
		hint = null
	}: Props = $props();
</script>

<div>
	<p class="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
		{label}
		{#if required}<span class="text-destructive">*</span>{/if}
	</p>
	<Input
		{placeholder}
		maxlength={maxlength ?? undefined}
		bind:value
		oninput={() => {
			if (uppercase) value = value.toUpperCase();
		}}
		class="h-10 text-base {error ? 'border-destructive' : ''}"
	/>
	{#if error}
		<p class="text-destructive text-xs mt-1.5">{error}</p>
	{:else if hint}
		<p class="text-muted-foreground text-xs mt-1.5">{hint}</p>
	{/if}
</div>
