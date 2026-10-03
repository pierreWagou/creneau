<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Tabs from '$lib/components/ui/tabs';
	import { isValidFlatNumber, isValidSpotNumber } from '$lib/constants';
	import type { DescribedSpotConflict } from '$lib/utils/spots';
	import { isValidEmail, isValidPhone } from '$lib/validation';
	import FlatContactsCard from './flat-contacts-card.svelte';
	import FlatLifecycleCard from './flat-lifecycle-card.svelte';
	import FlatProfileCard from './flat-profile-card.svelte';
	import FlatSpotCards from './flat-spot-cards.svelte';
import type { SpotDirectory } from './spot-picker.svelte';
	import ValidationTip from './validation-tip.svelte';

	export interface InlineEditState {
		editing: boolean;
		saving: boolean;
		onStart: () => void;
		onCommit: (value: string) => void;
		onCancel: () => void;
	}

	export interface DetailTab {
		value: string;
		label: string;
		content: Snippet;
	}

	interface Props {
		number: string;
		displayName?: string | null;
		/** Badge hidden when absent — only machine-derived statuses may pass a label */
		stateLabel?: string | null;
		stateBadgeClass?: string | null;
		/** Viewer's own flat number — own flat renders primary blue like its calendar bookings */
		ownFlatNumber?: string | null;
		isAdmin?: boolean;
		spots?: string[];
		descriptions?: Record<string, string | null>;
		/** Pass explicitly in create flows; view flows use onChange handlers */
		spotsEditable?: boolean;
		onSpotsChange?: (spots: string[]) => void;
		/** Conflict marking forwarded to the spots grid (corner badge + tooltip) */
		spotConflicts?: DescribedSpotConflict[];
		/** Mask holder flat numbers in conflict badges/tooltips (public pages) */
		maskHolder?: boolean;
		/** Directory enabling the constrained picker (omitted = legacy free typing) */
		spotDirectory?: SpotDirectory | null;
		/** Rendered just below the spots section (e.g. conflict solve entry) */
		spotsFooter?: Snippet;
		emails?: string[];
		phones?: string[];
		/** Pass explicitly in create flows; view flows use onChange handlers */
		contactsEditable?: boolean;
		onEmailsChange?: (emails: string[]) => void;
		onPhonesChange?: (phones: string[]) => void;
		createdAt?: string | null;
		activatedAt?: string | null;
		createdLabel?: string;
		/** Name editing wiring; omitted = read-only header */
		nameEdit?: InlineEditState | null;
		/** Number editing wiring; omitted = read-only title */
		numberEdit?: InlineEditState | null;
		/** Admin-role toggle; omitted = static shield. Caller gates (active flats, never self) */
		onToggleAdmin?: () => void;
		togglingAdmin?: boolean;
		/** Rendered between lifecycle and the parent's footer (e.g. conflict warning) */
		alert?: Snippet;
		/** Sécurité tab content (e.g. PIN form); omitted = single info view, no tabs */
		security?: Snippet;
		/** Render profile header + security content directly, no tab bar, no info sections */
		securityOnly?: boolean;
		/** Controlled tab value; unbound usage keeps internal default. Parent owns resets. */
		tab?: string;
		/**
		 * Custom tabs. null/undefined = legacy behavior (security ? info/security pair : plain info).
		 * [] = plain info sections, no bar. [one] = its content directly, no bar.
		 * [2+] = tab bar (first tab is the fallback selection).
		 */
		tabs?: DetailTab[] | null;
		/** Show the lifecycle section (hidden pre-creation — no dates exist yet) */
		showLifecycle?: boolean;
		/** Remove-guard parity with creation flows (view flows keep 1) */
		minItems?: number;

		/** Submit section (create mode); absent = no submit UI */
		submitLabel?: string | null;
		submitting?: boolean;
		onSubmit?: () => void;
		/** Mirrored-out form validity for parent submit guards */
		valid?: boolean;
		/** Pin banner + tab bar to the scrollport top (drawer use); off = today's flow layout */
		stickyHeader?: boolean;
	}

	let {
		number = $bindable(''),
		displayName = $bindable(null),
		stateLabel = null,
		stateBadgeClass = null,
		ownFlatNumber = null,
		isAdmin = false,
		spots = $bindable([]),
		descriptions = {},
		onSpotsChange,
		spotConflicts = [],
		maskHolder = false,
		spotDirectory = null,
		spotsFooter,
		emails = $bindable([]),
		phones = $bindable([]),
		onEmailsChange,
		onPhonesChange,
		createdAt,
		activatedAt,
		createdLabel,
		nameEdit = null,
		numberEdit = null,
		onToggleAdmin,
		togglingAdmin = false,
		alert,
		security,
		securityOnly = false,
		tab = $bindable('info'),
		tabs = null,
		showLifecycle = true,
		minItems = 1,
		spotsEditable = false,
		contactsEditable = false,
		submitLabel = null,
		submitting = false,
		onSubmit,
		valid = $bindable(true),
		stickyHeader = false
	}: Props = $props();

	const stickyShell = $derived(
		stickyHeader ? 'sticky top-0 z-10 -mx-6 bg-popover px-6 pt-6 pb-3' : 'contents'
	);

	const normalizedNumber = $derived(number.trim().toUpperCase());
	const numberValid = $derived(normalizedNumber.length > 0 && isValidFlatNumber(normalizedNumber));
	const spotsValid = $derived(
		spots.length > 0 && spots.every((s) => isValidSpotNumber(s))
	);
	const emailsValid = $derived(emails.length > 0 && emails.every((e) => isValidEmail(e)));
	const phonesValid = $derived(phones.length > 0 && phones.every((p) => isValidPhone(p)));
	const internalValid = $derived(numberValid && spotsValid && emailsValid && phonesValid);

	$effect(() => {
		valid = internalValid;
	});

	const missingFields = $derived(
		[
			!numberValid && "Numéro d'appartement invalide",
			!spotsValid && 'Au moins une place de parking valide',
			!emailsValid && 'Au moins un e-mail valide',
			!phonesValid && 'Au moins un téléphone valide'
		].filter((r): r is string => r !== false)
	);

	$effect(() => {
		if (tabs && tabs.length >= 2 && !tabs.some((t) => t.value === tab)) {
			tab = tabs[0].value;
		}
	});

	let nameDraft = $state('');
	let numberDraft = $state('');

	// Pencil-draft rule (mirrors the old FlatTextField): empty is silent, invalid non-empty errors.
	const numberDraftValid = $derived(numberDraft.trim().length > 0 && isValidFlatNumber(numberDraft));
	const numberError = $derived(
		!numberDraft.trim() || numberDraftValid ? null : 'Format invalide (ex. A01, B12)'
	);

	function startNameEdit() {
		if (!nameEdit) return;
		nameDraft = displayName ?? '';
		nameEdit.onStart();
	}

	function commitNameEdit() {
		nameEdit?.onCommit(nameDraft);
	}

	function startNumberEdit() {
		if (!numberEdit) return;
		numberDraft = number;
		numberEdit.onStart();
	}

	function commitNumberEdit() {
		numberEdit?.onCommit(numberDraft);
	}
</script>

{#snippet headerCard()}
	<div>
		<FlatProfileCard
			{number}
			{displayName}
			{stateLabel}
			{stateBadgeClass}
			{ownFlatNumber}
			{isAdmin}
			editingName={nameEdit?.editing ?? false}
			bind:nameDraft
			savingName={nameEdit?.saving ?? false}
			onStartEditName={nameEdit ? startNameEdit : undefined}
			onCommitName={nameEdit ? commitNameEdit : undefined}
			onCancelEditName={nameEdit ? nameEdit.onCancel : undefined}
			editingNumber={numberEdit?.editing ?? false}
			bind:numberDraft
			savingNumber={numberEdit?.saving ?? false}
			{numberError}
			onStartEditNumber={numberEdit ? startNumberEdit : undefined}
			onCommitNumber={numberEdit ? commitNumberEdit : undefined}
			onCancelEditNumber={numberEdit ? numberEdit.onCancel : undefined}
			{onToggleAdmin}
			{togglingAdmin}
		/>
	</div>
{/snippet}

{#snippet infoSections()}
	<div class="mt-4">
		<p class="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Places de parking</p>
		<FlatSpotCards
			bind:spots
			{descriptions}
			editable={spotsEditable}
			minItems={minItems}
			onChange={onSpotsChange}
			conflicts={spotConflicts}
			{maskHolder}
			{spotDirectory}
		/>
		{#if spotsFooter}
			<div class="mt-2">
				{@render spotsFooter()}
			</div>
		{/if}
	</div>

	<div class="mt-4">
		<p class="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Contacts</p>
		<FlatContactsCard
			bind:emails
			bind:phones
			editable={contactsEditable}
			minItems={minItems}
			onEmailsChange={onEmailsChange}
			onPhonesChange={onPhonesChange}
		/>
	</div>

	{#if showLifecycle}
		<div class="mt-4">
			<p class="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Cycle de vie</p>
			<FlatLifecycleCard {createdAt} {activatedAt} {createdLabel} />
		</div>
	{/if}

	{#if alert}
		<div class="mt-4">
			{@render alert()}
		</div>
	{/if}
{/snippet}

{#if tabs && tabs.length >= 2}
	<Tabs.Root bind:value={tab}>
		<div class={stickyShell}>
			{@render headerCard()}
			<div class="mt-4">
				<Tabs.List class="grid w-full rounded-xl bg-muted p-1" style="grid-template-columns: repeat({tabs.length}, minmax(0, 1fr))">
					{#each tabs as t}
						<Tabs.Trigger
							value={t.value}
							class="rounded-full data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
						>
							{t.label}
						</Tabs.Trigger>
					{/each}
				</Tabs.List>
			</div>
		</div>
		{#each tabs as t}
			<Tabs.Content value={t.value}>{@render t.content()}</Tabs.Content>
		{/each}
	</Tabs.Root>
{:else if tabs && tabs.length === 1}
	<div class={stickyShell}>
		{@render headerCard()}
	</div>
	{@render tabs[0].content()}
{:else if securityOnly && security}
	<div class={stickyShell}>
		{@render headerCard()}
	</div>
	<div class="mt-4">{@render security()}</div>
{:else if security}
	<Tabs.Root bind:value={tab}>
		<div class={stickyShell}>
			{@render headerCard()}
			<div class="mt-4">
				<Tabs.List class="grid w-full grid-cols-2 rounded-xl bg-muted p-1">
					<Tabs.Trigger
						value="info"
						class="rounded-full data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
					>
						Informations
					</Tabs.Trigger>
					<Tabs.Trigger
						value="security"
						class="rounded-full data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
					>
						Sécurité
					</Tabs.Trigger>
				</Tabs.List>
			</div>
		</div>
		<Tabs.Content value="info">{@render infoSections()}</Tabs.Content>
		<Tabs.Content value="security">{@render security()}</Tabs.Content>
	</Tabs.Root>
{:else}
	<div class={stickyShell}>
		{@render headerCard()}
	</div>
	{@render infoSections()}
{/if}

{#if submitLabel}
	<div class="mt-4">
		{#if !internalValid}
			<ValidationTip
				show={missingFields.length > 0}
				title="Éléments manquants :"
				items={missingFields}
			>
				<Button type="button" class="w-full" disabled>{submitLabel}</Button>
			</ValidationTip>
		{:else}
			<Button type="button" class="w-full" disabled={submitting} onclick={onSubmit}>{submitLabel}</Button>
		{/if}
	</div>
{/if}
