<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import FlatDetailView from '$lib/components/flat-detail-view.svelte';
	import FlatPinForm from '$lib/components/flat-pin-form.svelte';
	import { Button } from '$lib/components/ui/button';

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
		try {
			const res = await fetch('/api/account', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ emails: emailsToSave, phones: phonesToSave })
			});
			if (res.ok) {
				emails = [...emailsToSave];
				phones = [...phonesToSave];
				toast.success('Contacts mis à jour');
			} else {
				const { error } = await res.json();
				toast.error(error || 'Erreur lors de la mise à jour');
			}
		} catch {
			toast.error('Erreur réseau');
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
		try {
			const res = await fetch('/api/account', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ displayName: trimmed || null })
			});
			if (res.ok) {
				savedDisplayName = trimmed;
				toast.success('Nom mis à jour');
				editingName = false;
				return true;
			} else {
				const { error } = await res.json();
				toast.error(error || 'Erreur lors de la mise à jour');
				return false;
			}
		} catch {
			toast.error('Erreur réseau');
			return false;
		} finally {
			savingName = false;
		}
	}

	async function submitOwnerPin(pins: { currentPin: string; newPin: string }): Promise<boolean> {
		try {
			const res = await fetch('/api/account', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(pins)
			});
			if (res.ok) {
				toast.success('PIN modifié avec succès');
				return true;
			} else {
				const { error } = await res.json();
				toast.error(error || 'Erreur lors du changement de PIN');
				return false;
			}
		} catch {
			toast.error('Erreur réseau');
			return false;
		}
	}

	async function handleLogout() {
		await fetch('/api/auth/logout', { method: 'POST' });
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
		ownFlatNumber={data.flat.number}
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

	<Button variant="default" class="w-full bg-destructive text-white hover:bg-destructive/80 dark:text-[#1e1e2e]" onclick={handleLogout}>Se déconnecter</Button>
</div>
