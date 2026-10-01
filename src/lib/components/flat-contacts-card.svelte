<script lang="ts">
	import Mail from '@lucide/svelte/icons/mail';
	import Phone from '@lucide/svelte/icons/phone';
	import { displayPhone, formatPhone } from '$lib/utils/phone';
	import { isValidEmail, isValidPhone } from '$lib/validation';
	import FlatContactList from './flat-contact-list.svelte';

	interface Props {
		emails?: string[];
		phones?: string[];
		editable?: boolean;
		/** Minimum items kept when removing (edit modes: 1) */
		minItems?: number;
		/** Show required markers on both group labels */
		required?: boolean;
		onEmailsChange?: (emails: string[]) => void;
		onPhonesChange?: (phones: string[]) => void;
	}

	let {
		emails = $bindable([]),
		phones = $bindable([]),
		editable = true,
		minItems = 0,
		required = false,
		onEmailsChange,
		onPhonesChange
	}: Props = $props();
</script>

<div class="rounded-xl border border-border p-4 space-y-4">
	<div>
		<p class="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">E-mails ({emails.length}){#if required}<span class="text-destructive">*</span>{/if}</p>
		<FlatContactList
			bare
			icon={Mail}
			bind:items={emails}
			placeholder="ex. dupont@email.com"
			inputType="email"
			invalidMessage="Email invalide"
			addLabel="Ajouter un e-mail"
			editable={editable}
			emptyText="Aucun e-mail"
			editLabel="Modifier l'e-mail"
			removeLabel="Supprimer l'e-mail"
			minItems={minItems}
			validate={isValidEmail}
			linkPrefix="mailto"
			onChange={onEmailsChange}
		/>
	</div>
	<div class="border-t border-border pt-4">
		<p class="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">
			Téléphones ({phones.length}){#if required}<span class="text-destructive">*</span>{/if}
		</p>
		<FlatContactList
			bare
			icon={Phone}
			bind:items={phones}
			placeholder="+33 6 12 34 56 78"
			inputType="tel"
			invalidMessage="Téléphone invalide"
			addLabel="Ajouter un téléphone"
			editable={editable}
			emptyText="Aucun téléphone"
			editLabel="Modifier le téléphone"
			removeLabel="Supprimer le téléphone"
			minItems={minItems}
			validate={isValidPhone}
			format={formatPhone}
			display={displayPhone}
			linkPrefix="tel"
			onChange={onPhonesChange}
		/>
	</div>
</div>
