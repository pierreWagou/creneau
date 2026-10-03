<script lang="ts">
	import { mode } from 'mode-watcher';
	import { getFlatColor, latte, mocha } from '$lib/colors';
	import { Badge } from '$lib/components/ui/badge';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { DISPLAY_NAME_MAX_LENGTH } from '$lib/constants';
	import AdminShield from './admin-shield.svelte';
	import EditableField from './editable-field.svelte';

	interface Props {
		number: string;
		displayName?: string | null;
		/** Badge hidden when absent — only machine-derived statuses may pass a label */
		stateLabel?: string | null;
		stateBadgeClass?: string | null;
		/** Viewer's own flat number — own flat renders primary blue like its calendar bookings */
		ownFlatNumber?: string | null;
		isAdmin?: boolean;
		/** Inline name-edit state (controlled by parent); pencil shown when `onStartEditName` is provided */
		editingName?: boolean;
		nameDraft?: string;
		savingName?: boolean;
		onStartEditName?: () => void;
		onCommitName?: () => void;
		onCancelEditName?: () => void;
		/** Inline number-edit state (controlled by parent); pencil shown when `onStartEditNumber` is provided */
		editingNumber?: boolean;
		numberDraft?: string;
		savingNumber?: boolean;
		onStartEditNumber?: () => void;
		onCommitNumber?: () => void;
		onCancelEditNumber?: () => void;
		/** Draft format error from the parent (flat-number rule); blocks ✓/Enter when set */
		numberError?: string | null;
		/** Admin-role toggle; when provided the shield becomes a tappable toggle button */
		onToggleAdmin?: () => void;
		togglingAdmin?: boolean;
	}

	let {
		number,
		displayName,
		stateLabel = null,
		stateBadgeClass = null,
		ownFlatNumber = null,
		isAdmin = false,
		editingName = false,
		nameDraft = $bindable(''),
		savingName = false,
		onStartEditName,
		onCommitName,
		onCancelEditName,
		editingNumber = false,
		numberDraft = $bindable(''),
		savingNumber = false,
		onStartEditNumber,
		onCommitNumber,
		onCancelEditNumber,
		numberError = null,
		onToggleAdmin,
		togglingAdmin = false
	}: Props = $props();

	// ✓ commits only a non-empty, error-free draft (mirrors spot-draft gating)
	const canCommitNumber = $derived(!savingNumber && numberDraft.trim().length > 0 && !numberError);

	// Shared by the toggle button's aria-label and its tooltip so the two can never disagree
	const toggleAdminLabel = $derived(isAdmin ? 'Retirer les droits administrateur' : 'Rendre administrateur');

	const isDark = $derived(mode.current === 'dark');
	const avatarColor = $derived(
		ownFlatNumber !== null && number === ownFlatNumber
			? isDark
				? mocha.blue
				: latte.blue
			: getFlatColor(number, isDark)
	);
</script>

<div class="rounded-xl border border-border p-4">
	<div class="flex items-center gap-4">
		<div
			class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold {number
				? ''
				: 'bg-muted text-muted-foreground'}"
			style={number
				? `background-color: color-mix(in srgb, ${avatarColor} 18%, transparent); color: ${avatarColor}`
				: undefined}
		>
			{number || '?'}
		</div>
		<div class="flex-1 min-w-0">
			<EditableField
				editing={editingNumber}
				editable={!!onStartEditNumber}
				editLabel="Modifier le numéro"
				onStart={() => onStartEditNumber?.()}
				rowClass="gap-2"
				bind:value={numberDraft}
				initial={number}
				placeholder="ex. B12"
				ariaLabel="Numéro d'appartement"
				uppercase
				inputClass="text-sm font-semibold"
				error={numberError}
				errorDisplay="inline"
				committable={canCommitNumber}
				disabled={savingNumber}
				autofocus={editingNumber}
				onCommit={() => onCommitNumber?.()}
				onCancel={() => onCancelEditNumber?.()}
			>
				{#snippet prefix()}
					<span class="text-base font-semibold whitespace-nowrap shrink-0">Lot</span>
				{/snippet}
				{#snippet display()}
					<p class="text-base font-semibold flex flex-wrap items-center gap-2 min-w-0">
						{#if onToggleAdmin}
							<Tooltip.Provider>
								<Tooltip.Root>
									<Tooltip.Trigger>
										{#snippet child({ props })}
											<button
												{...props}
												type="button"
												class="shrink-0 rounded-md p-0.5 transition-colors {isAdmin
													? 'text-primary hover:!bg-primary/10'
													: 'text-muted-foreground hover:text-foreground hover:!bg-muted'}"
												disabled={togglingAdmin}
												aria-label={toggleAdminLabel}
												onclick={onToggleAdmin}
											>
												<AdminShield active={isAdmin} />
											</button>
										{/snippet}
									</Tooltip.Trigger>
									<Tooltip.Content>
										<p class="text-xs">{toggleAdminLabel}</p>
									</Tooltip.Content>
								</Tooltip.Root>
							</Tooltip.Provider>
						{:else if isAdmin}
							<AdminShield active />
						{/if}
						{#if number}
							<span class="truncate min-w-0">Lot</span>{' '}
							<span class="shrink-0">{number}</span>
						{:else}
							<span class="truncate min-w-0">Nouveau lot</span>
						{/if}
					</p>
				{/snippet}
				{#snippet actions()}
					{#if number && stateLabel}
						<Badge class="shrink-0 {stateBadgeClass}">
							{stateLabel}
						</Badge>
					{/if}
				{/snippet}
			</EditableField>
			<EditableField
				editing={editingName}
				editable={!!onStartEditName}
				editLabel={displayName ? 'Modifier le nom' : 'Ajouter un nom'}
				onStart={() => onStartEditName?.()}
				bind:value={nameDraft}
				initial={displayName ?? ''}
				maxlength={DISPLAY_NAME_MAX_LENGTH}
				placeholder="ex. Jean, Famille Dupont"
				ariaLabel="Nom d'affichage"
				inputClass="text-sm"
				committable={!savingName}
				disabled={savingName}
				autofocus={editingName}
				onCommit={() => onCommitName?.()}
				onCancel={() => onCancelEditName?.()}
			>
				{#snippet display()}
					{#if displayName}
						<p class="text-muted-foreground text-sm truncate">{displayName}</p>
					{:else if onStartEditName}
						<button
							type="button"
							class="w-full text-left"
							aria-label="Ajouter un nom"
							onclick={() => onStartEditName?.()}
						>
							<span class="text-muted-foreground text-sm">—</span>
						</button>
					{/if}
				{/snippet}
			</EditableField>
		</div>
	</div>
</div>
