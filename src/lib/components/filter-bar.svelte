<script lang="ts" generics="T extends string">
	import SearchField from './search-field.svelte';
	import { Input } from './ui/input';

	export interface FilterBarPill<T extends string = string> {
		value: T;
		label: string;
		selected: boolean;
		solidClass: string;
		mutedClass: string;
	}

	interface Props<T extends string> {
		search?: string;
		searchPlaceholder?: string;
		/** Screen-reader label for the pill group */
		groupLabel: string;
		pills: FilterBarPill<T>[];
		onSearchInput?: () => void;
		onSearchFocus?: () => void;
		onSearchBlur?: () => void;
		onToggle: (value: T) => void;
	}

	let {
		search = $bindable(''),
		searchPlaceholder = 'Rechercher…',
		groupLabel,
		pills,
		onSearchInput,
		onSearchFocus,
		onSearchBlur,
		onToggle
	}: Props<T> = $props();
</script>

<div class="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
	<SearchField
		value={search}
		onClear={() => {
			search = '';
			onSearchInput?.();
		}}
		class="w-full sm:w-44"
	>
		<Input
			placeholder={searchPlaceholder}
			bind:value={search}
			oninput={onSearchInput}
			onfocus={onSearchFocus}
			onblur={onSearchBlur}
			class="h-9 w-full pr-8 pl-8 text-sm"
		/>
	</SearchField>
	<div class="flex min-w-0 flex-1 gap-2 overflow-x-auto" role="group" aria-label={groupLabel}>
		{#each pills as pill (pill.value)}
			<button
				type="button"
				class="h-7 shrink-0 rounded-full border px-2.5 sm:px-3 text-xs font-medium tabular-nums transition-colors {pill.selected
					? pill.solidClass
					: pill.mutedClass}"
				aria-pressed={pill.selected}
				onclick={() => onToggle(pill.value)}
			>
				{pill.label}
			</button>
		{/each}
	</div>
</div>
