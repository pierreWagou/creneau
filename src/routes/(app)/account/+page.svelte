<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import FlatDetailView from '$lib/components/flat-detail-view.svelte';
	import FlatPinForm from '$lib/components/flat-pin-form.svelte';
	import { Button } from '$lib/components/ui/button';
	import { apiFetch } from '$lib/utils/api';
	import { notifyMailFailed, notifyResult, UPDATE_FAILED } from '$lib/utils/toasts';

	let { data } = $props();

	// Display name editing (draft lives in FlatDetailView; saved value shown)
	let savedDisplayName = $state(data.flat.displayName ?? '');
	let savingName = $state(false);
	let editingName = $state(false);

	// Contacts (edited through the shared FlatContactsCard component, auto-persisted)
	let emails = $state<string[]>([...(data.flat.emails ?? [])]);
	let phones = $state<string[]>([...(data.flat.phones ?? [])]);

	// PIN drafts (parent-owned so tab switches can't wipe them)
	let pinCurrent = $state('');
	let pinNew = $state('');
	let pinConfirm = $state('');

	async function persistContacts(emailsToSave: string[], phonesToSave: string[]) {
		if (emailsToSave.length === 0 || phonesToSave.length === 0) return;
		const result = await apiFetch(
			'/api/account',
			{
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ emails: emailsToSave, phones: phonesToSave })
			},
			UPDATE_FAILED
		);
		if (result.ok) {
			emails = [...emailsToSave];
			phones = [...phonesToSave];
			toast.success('Contacts mis à jour');
		} else {
			notifyResult(result, null);
		}
	}

	// PIN change (inputs live in FlatPinForm; only the submit lives here)

	async function commitDisplayName(value: string): Promise<boolean> {
		const trimmed = value.trim();
		if (trimmed === savedDisplayName) {
			editingName = false;
			return true;
		}
		savingName = true;
		const result = await apiFetch(
			'/api/account',
			{
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ displayName: trimmed || null })
			},
			UPDATE_FAILED
		);
		savingName = false;
		if (result.ok) {
			savedDisplayName = trimmed;
			toast.success('Nom mis à jour');
			editingName = false;
			return true;
		} else {
			notifyResult(result, null);
			return false;
		}
	}

	async function submitOwnerPin(pins: { currentPin: string; newPin: string }): Promise<boolean> {
		const result = await apiFetch(
			'/api/account',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(pins)
			},
			'Erreur lors du changement de PIN'
		);
		notifyResult(result, 'PIN modifié avec succès', 'Erreur lors du changement de PIN');
		return result.ok;
	}

	async function handleLogout() {
		// Fire-and-forget by design: the page always navigates, even if the
		// server call fails (a half-dead session on this page is worse).
		// apiFetch never throws, so no catch is needed.
		await apiFetch('/api/auth/logout', { method: 'POST' });
		goto('/login');
	}
</script>

<div class="mx-auto max-w-md space-y-4">
	<h2 class="page-title">Mon compte</h2>

	<FlatDetailView
		number={data.flat.number}
		displayName={savedDisplayName}
		stateLabel="Actif"
		stateBadgeClass="flat-badge-active"
		isAdmin={data.flat.isAdmin}
		spots={data.spots.map((s) => s.number)}
		descriptions={Object.fromEntries(data.spots.map((s) => [s.number, s.description]))}
		emails={emails}
		phones={phones}
		contactsEditable
		onEmailsChange={(e) => persistContacts(e, phones)}
		onPhonesChange={(p) => persistContacts(emails, p)}
		createdAt={data.flat.createdAt}
		activatedAt={data.flat.activatedAt}
		nameEdit={{
			editing: editingName,
			saving: savingName,
			onStart: () => (editingName = true),
			onCommit: (value) => commitDisplayName(value),
			onCancel: () => (editingName = false)
		}}
	>
		{#snippet security()}
			<FlatPinForm
				requireCurrentPin
				bind:currentPin={pinCurrent}
				bind:newPin={pinNew}
				bind:confirmPin={pinConfirm}
				onSubmit={submitOwnerPin}
			/>
		{/snippet}
	</FlatDetailView>

	<Button variant="default" class="w-full bg-destructive on-solid hover:bg-destructive/80" onclick={handleLogout}>Se déconnecter</Button>
</div>
