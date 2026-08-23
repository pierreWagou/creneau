<script lang="ts">
	import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Calendar from '@lucide/svelte/icons/calendar';
	import CarFront from '@lucide/svelte/icons/car-front';
	import Check from '@lucide/svelte/icons/check';
	import ClipboardCopy from '@lucide/svelte/icons/clipboard-copy';
	import Mail from '@lucide/svelte/icons/mail';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Phone from '@lucide/svelte/icons/phone';
	import Plus from '@lucide/svelte/icons/plus';
	import Search from '@lucide/svelte/icons/search';
	import Shield from '@lucide/svelte/icons/shield';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import X from '@lucide/svelte/icons/x';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import QrCode from '$lib/components/qr-code.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Separator } from '$lib/components/ui/separator';
	import { formatSpotNumber, isValidFlatNumber, isValidSpotNumber, MAX_CONTACTS_PER_TYPE } from '$lib/constants';
	import { displayPhone, formatPhone } from '$lib/utils/phone';

	let { data } = $props();

	// Dialog state
	type AdminDialog = 'addSpot' | 'editSpot' | 'addFlat' | 'swapSpot' | null;
	let openDialog = $state<AdminDialog>(null);
	let detailOpen = $state(false);
	let editOpen = $state(false);

	// Form state
	let newFlatNumber = $state('');
	let newSpotNumber = $state('');
	let newSpotDescription = $state('');
	let editSpotTarget = $state<(typeof data.spots)[0] | null>(null);
	let editSpotDescription = $state('');
	let flatSpotInputs = $state(['']);
	let flatEmailInputs = $state(['']);
	let flatPhoneInputs = $state(['']);
	let newFlatSpot = $state('');
	let newFlatEmail = $state('');
	let newFlatPhone = $state('');

	// Swap state
	let swapTarget = $state<(typeof data.spots)[0] | null>(null);
	let swapFlatNumber = $state('');
	let swapSpotNumber = $state('');
	let swapLoading = $state(false);

	// Edit flat state
	let editFlatDisplayName = $state('');
	let editFlatSpotInputs = $state<string[]>(['']);
	let editFlatEmails = $state<string[]>([]);
	let editFlatPhones = $state<string[]>([]);
	let newEditFlatEmail = $state('');
	let newEditFlatPhone = $state('');
	let newEditFlatSpot = $state('');
	let editFlatLoading = $state(false);

	// Spot conflict state
	let spotConflicts = $state<{ spotNumber: string; currentFlat: string }[]>([]);
	let pendingConflictSpots = $state<string[]>([]);
	let conflictMode = $state<'edit' | 'create'>('edit');
	let pendingCreateFlatData = $state<{ number: string; spotNumbers: string[]; emails: string[]; phones: string[] } | null>(null);

	const swapFlatSpots = $derived(
		swapFlatNumber
			? data.spots.filter((s) => s.flatNumber === swapFlatNumber)
			: []
	);

	$effect(() => {
		if (swapFlatSpots.length === 1) {
			swapSpotNumber = swapFlatSpots[0].number;
		} else {
			swapSpotNumber = '';
		}
	});

	// Derived
	const sharedSpots = $derived(data.spots.filter((s) => !s.flatNumber));

	// Search
	let searchQuery = $state('');
	let filteredFlats = $derived(
		searchQuery.trim() === ''
			? data.flats
			: data.flats.filter(
					(f) =>
						f.number.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
						(f.displayName?.toLowerCase().includes(searchQuery.trim().toLowerCase()) ?? false)
				)
	);

	// Confirmation dialog state
	let confirmAction = $state<
		| { type: 'reset' | 'delete'; flatNumber: string }
		| { type: 'deleteSpot'; spotNumber: string }
		| { type: 'rejectRequest'; requestId: number }
		| null
	>(null);

	// Request actions
	let approvingRequest = $state<number | null>(null);
	let pendingApprovalConflicts = $state<{ requestId: number; conflicts: { spotNumber: string; currentFlat: string }[] } | null>(null);

	// Detail dialog state: can show a flat or a request
	let selectedItem = $state<{ type: 'flat'; item: (typeof data.flats)[0] } | { type: 'request'; item: (typeof data.requests)[0] } | null>(null);

	type FlatState = 'inactive' | 'pending' | 'expired' | 'active';

	function getFlatState(f: (typeof data.flats)[0]): FlatState {
		if (f.status === 'active') return 'active';
		if (f.activationCode) {
			if (f.activationCodeExpiresAt && new Date(f.activationCodeExpiresAt).getTime() < Date.now()) {
				return 'expired';
			}
			return 'pending';
		}
		return 'inactive';
	}

	function getStateLabel(state: FlatState): string {
		switch (state) {
			case 'active': return 'Actif';
			case 'pending': return 'En attente';
			case 'expired': return 'Expiré';
			case 'inactive': return 'Inactif';
		}
	}

	function getStateBadgeClass(state: FlatState): string {
		switch (state) {
			case 'active': return 'flat-badge-active';
			case 'pending': return 'flat-badge-pending';
			case 'expired': return 'flat-badge-expired';
			case 'inactive': return 'flat-badge-inactive';
			default: return '';
		}
	}

	function getExpiryLabel(expiresAt: string): string {
		const diff = new Date(expiresAt).getTime() - Date.now();
		if (diff <= 0) return 'Expiré';
		const hours = Math.floor(diff / (1000 * 60 * 60));
		const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
		if (hours > 0) return `expire dans ${hours}h${String(minutes).padStart(2, '0')}`;
		return `expire dans ${minutes}min`;
	}

	function getActivationLink(f: (typeof data.flats)[0]): string {
		return `${window.location.origin}/activate?flat=${encodeURIComponent(f.number)}&code=${f.activationCode}`;
	}

	function getBoundSpots(f: (typeof data.flats)[0]): string[] {
		return data.spots.filter((s) => s.flatNumber === f.number).map((s) => s.number);
	}

	function getRequestSpotConflicts(r: (typeof data.requests)[0]): { spotNumber: string; currentFlat: string }[] {
		const conflicts: { spotNumber: string; currentFlat: string }[] = [];
		for (const spotNum of r.requestedSpots) {
			const spotRow = data.spots.find((s) => s.number === spotNum);
			if (spotRow?.flatNumber && spotRow.flatNumber !== r.flatNumber) {
				conflicts.push({ spotNumber: spotNum, currentFlat: spotRow.flatNumber });
			}
		}
		return conflicts;
	}

	function openFlatDetail(f: (typeof data.flats)[0]) {
		selectedItem = { type: 'flat', item: f };
		detailOpen = true;
	}

	function openRequestDetail(r: (typeof data.requests)[0]) {
		selectedItem = { type: 'request', item: r };
		detailOpen = true;
	}

	function openEditFlat(f: (typeof data.flats)[0]) {
		editFlatDisplayName = f.displayName ?? '';
		editFlatSpotInputs = getBoundSpots(f);
		if (editFlatSpotInputs.length === 0) editFlatSpotInputs = [''];
		editFlatEmails = [...f.emails];
		editFlatPhones = [...f.phones];
		newEditFlatEmail = '';
		newEditFlatPhone = '';
		newEditFlatSpot = '';
		editOpen = true;
	}

	function removeEditFlatSpot(index: number) {
		if (editFlatSpotInputs.length <= 1) return;
		const removed = editFlatSpotInputs[index];
		editFlatSpotInputs = editFlatSpotInputs.filter((_, i) => i !== index);
		persistEditFlatSpots(false, editFlatSpotInputs);
	}

	function addEditFlatSpotFromInput() {
		const trimmed = formatSpotNumber(newEditFlatSpot.trim());
		if (isValidSpotNumber(trimmed) && !editFlatSpotInputs.includes(trimmed)) {
			newEditFlatSpot = '';
			persistEditFlatSpots(false, [...editFlatSpotInputs, trimmed]);
		}
	}

	function removeEditFlatEmail(index: number) {
		if (editFlatEmails.length <= 1) return;
		editFlatEmails = editFlatEmails.filter((_, i) => i !== index);
		persistEditFlatContacts();
	}

	function addEditFlatEmailFromInput() {
		const trimmed = newEditFlatEmail.trim();
		if (trimmed && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) && !editFlatEmails.includes(trimmed)) {
			editFlatEmails = [...editFlatEmails, trimmed];
			newEditFlatEmail = '';
			persistEditFlatContacts();
		}
	}

	function removeEditFlatPhone(index: number) {
		if (editFlatPhones.length <= 1) return;
		editFlatPhones = editFlatPhones.filter((_, i) => i !== index);
		persistEditFlatContacts();
	}

	function addEditFlatPhoneFromInput() {
		const formatted = formatPhone(newEditFlatPhone.trim());
		if (/^[\d\s\-+()]+$/.test(formatted) && !editFlatPhones.includes(formatted)) {
			editFlatPhones = [...editFlatPhones, formatted];
			newEditFlatPhone = '';
			persistEditFlatContacts();
		}
	}

	const validEditFlatSpots = $derived(
		editFlatSpotInputs.map((s) => s.trim()).filter((s) => s.length > 0)
	);
	const editFlatSpotsValid = $derived(validEditFlatSpots.length > 0 && validEditFlatSpots.every(isValidSpotNumber));
	const validEditFlatEmails = $derived(editFlatEmails.map((e) => e.trim()).filter((e) => e.length > 0));
	const editFlatEmailsValid = $derived(validEditFlatEmails.length > 0 && validEditFlatEmails.every((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)));
	const validEditFlatPhones = $derived(editFlatPhones.map((p) => p.trim()).filter((p) => p.length > 0));
	const editFlatPhonesValid = $derived(validEditFlatPhones.length > 0 && validEditFlatPhones.every((p) => /^[\d\s\-+()]+$/.test(p)));

	async function persistEditFlatName() {
		if (selectedItem?.type !== 'flat') return;
		const f = selectedItem.item;
		try {
			const res = await fetch(`/api/admin/flats/${encodeURIComponent(f.number)}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ displayName: editFlatDisplayName.trim() || null })
			});
			if (res.ok) {
				toast.success('Nom mis à jour');
				invalidateAll();
			} else {
				const { error } = await res.json();
				toast.error(error || 'Erreur lors de la mise à jour');
			}
		} catch {
			toast.error('Erreur réseau');
		}
	}

	async function persistEditFlatSpots(force = false, proposedSpots?: string[]) {
		const spots = proposedSpots ?? validEditFlatSpots;
		if (selectedItem?.type !== 'flat' || spots.length === 0) return;
		const f = selectedItem.item;
		try {
			const res = await fetch(`/api/admin/flats/${encodeURIComponent(f.number)}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					spotNumbers: spots,
					...(force ? { force: true } : {})
				})
			});
			if (res.ok) {
				if (proposedSpots) editFlatSpotInputs = proposedSpots;
				toast.success('Places de parking mises à jour');
				spotConflicts = [];
				pendingConflictSpots = [];
				invalidateAll();
			} else if (res.status === 409) {
				const result = await res.json();
				if (result.conflicts?.length > 0) {
					conflictMode = 'edit';
					pendingConflictSpots = spots;
					spotConflicts = result.conflicts;
				} else {
toast.error(result.error || 'Conflit de place de parking');
			}
		} else {
			const { error } = await res.json();
			toast.error(error || 'Erreur lors de la mise à jour');
			}
		} catch {
			toast.error('Erreur réseau');
		}
	}

	async function persistEditFlatContacts() {
		if (selectedItem?.type !== 'flat' || !editFlatEmailsValid || !editFlatPhonesValid) return;
		const f = selectedItem.item;
		try {
			const res = await fetch(`/api/admin/flats/${encodeURIComponent(f.number)}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ emails: validEditFlatEmails, phones: validEditFlatPhones })
			});
			if (res.ok) {
				toast.success('Contacts mis à jour');
				invalidateAll();
			} else {
				const { error } = await res.json();
				toast.error(error || 'Erreur lors de la mise à jour');
			}
		} catch {
			toast.error('Erreur réseau');
		}
	}

	async function copyLink(f: (typeof data.flats)[0] | null) {
		if (!f) return;
		try {
			await navigator.clipboard.writeText(getActivationLink(f));
			toast.success("Lien d'activation copié");
		} catch {
			toast.error('Impossible de copier le lien');
		}
	}

	async function generateActivationCode(flatNumber: string) {
		const res = await fetch(`/api/admin/flats/${encodeURIComponent(flatNumber)}/activation`, {
			method: 'POST'
		});
		if (res.ok) {
			await invalidateAll();
			toast.success("Code d'activation généré");
		} else {
			const result = await res.json();
			toast.error(result.error || 'Impossible de générer le code');
		}
	}

	async function regenerateInvite() {
		if (selectedItem?.type !== 'flat') return;
		const flatNumber = selectedItem.item.number;
		const res = await fetch(`/api/admin/flats/${encodeURIComponent(flatNumber)}/activation`, {
			method: 'POST'
		});
		if (res.ok) {
			await invalidateAll();
			toast.success("Lien régénéré (valable 24h)");
		} else {
			const result = await res.json();
			toast.error(result.error || 'Impossible de régénérer le lien');
		}
	}

	async function revokeInvite() {
		if (selectedItem?.type !== 'flat') return;
		const flatNumber = selectedItem.item.number;
		const res = await fetch(`/api/admin/flats/${encodeURIComponent(flatNumber)}/activation`, {
			method: 'DELETE'
		});
		if (res.ok) {
			toast.success("Invitation révoquée");
			openDialog = null;
			detailOpen = false;
			selectedItem = null;
			invalidateAll();
		} else {
			const result = await res.json();
			toast.error(result.error || 'Impossible de révoquer');
		}
	}

	const validFlatSpots = $derived(flatSpotInputs.map((s) => s.trim()).filter((s) => s.length > 0));
	const normalizedNewFlat = $derived(newFlatNumber.trim().toUpperCase());
	const newFlatValid = $derived(normalizedNewFlat.length > 0 && isValidFlatNumber(normalizedNewFlat));
	const newFlatExists = $derived(data.flats.some((f) => f.number === normalizedNewFlat));
	const newFlatSpotsValid = $derived(validFlatSpots.length > 0 && validFlatSpots.every(isValidSpotNumber));
	const validFlatEmails = $derived(flatEmailInputs.map((e) => e.trim()).filter((e) => e.length > 0));
	const newFlatEmailsValid = $derived(validFlatEmails.length > 0 && validFlatEmails.every((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)));
	const validFlatPhones = $derived(flatPhoneInputs.map((p) => p.trim()).filter((p) => p.length > 0));
	const newFlatPhonesValid = $derived(validFlatPhones.length > 0 && validFlatPhones.every((p) => /^[\d\s\-+()]+$/.test(p)));
	const canAddFlat = $derived(newFlatValid && !newFlatExists && newFlatSpotsValid && newFlatEmailsValid && newFlatPhonesValid);

	const normalizedNewSpot = $derived(newSpotNumber.trim());
	const newSpotValid = $derived(normalizedNewSpot.length > 0 && isValidSpotNumber(normalizedNewSpot));
	const newSpotExists = $derived(data.spots.some((s) => s.number === normalizedNewSpot));
	const canAddSpot = $derived(newSpotValid && !newSpotExists);

	const newFlatSpotValid = $derived(newFlatSpot.length > 0 && isValidSpotNumber(newFlatSpot));
	const newFlatEmailValid = $derived(newFlatEmail.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newFlatEmail));
	const newFlatPhoneValid = $derived(newFlatPhone.length > 0 && /^[\d\s\-+()]+$/.test(newFlatPhone));

	function addFlatSpotFromInput() {
		if (!newFlatSpotValid) return;
		const formatted = formatSpotNumber(newFlatSpot.trim());
		if (flatSpotInputs.includes(formatted)) return;
		flatSpotInputs = [...flatSpotInputs.filter((s) => s.length > 0), formatted];
		newFlatSpot = '';
	}

	function addFlatEmailFromInput() {
		if (!newFlatEmailValid) return;
		const trimmed = newFlatEmail.trim();
		if (flatEmailInputs.includes(trimmed)) return;
		flatEmailInputs = [...flatEmailInputs.filter((e) => e.length > 0), trimmed];
		newFlatEmail = '';
	}

	function addFlatPhoneFromInput() {
		if (!newFlatPhoneValid) return;
		const formatted = formatPhone(newFlatPhone.trim());
		if (flatPhoneInputs.includes(formatted)) return;
		flatPhoneInputs = [...flatPhoneInputs.filter((p) => p.length > 0), formatted];
		newFlatPhone = '';
	}

	async function addFlat(force = false) {
		if (!canAddFlat) return;

		const res = await fetch('/api/admin/flats', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				number: normalizedNewFlat,
				spotNumbers: validFlatSpots,
				emails: validFlatEmails,
				phones: validFlatPhones,
				...(force ? { force: true } : {})
			})
		});

		if (res.ok) {
			toast.success(`Appartement ${normalizedNewFlat} ajouté`);
			newFlatNumber = '';
			flatSpotInputs = [''];
			flatEmailInputs = [''];
			flatPhoneInputs = [''];
			newFlatSpot = '';
			newFlatEmail = '';
			newFlatPhone = '';
			openDialog = null;
			invalidateAll();
		} else if (res.status === 409) {
			const result = await res.json();
			if (result.conflicts?.length > 0) {
				pendingCreateFlatData = {
					number: normalizedNewFlat,
					spotNumbers: validFlatSpots,
					emails: validFlatEmails,
					phones: validFlatPhones
				};
				conflictMode = 'create';
				pendingConflictSpots = validFlatSpots;
				spotConflicts = result.conflicts;
			} else {
				toast.error(result.error || 'Conflit de place de parking');
			}
		} else {
			const result = await res.json();
			toast.error(result.error || "Impossible d'ajouter l'appartement");
		}
	}

	async function addSpot() {
		if (!canAddSpot) return;

		const res = await fetch('/api/spots', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ number: normalizedNewSpot, description: newSpotDescription.trim() || null })
		});

		if (res.ok) {
			toast.success(`Place de parking "${formatSpotNumber(normalizedNewSpot)}" ajoutée`);
			newSpotNumber = '';
			newSpotDescription = '';
			openDialog = null;
			invalidateAll();
		} else {
			const result = await res.json();
			toast.error(result.error || "Impossible d'ajouter la place de parking");
		}
	}

	function showEditSpot(s: (typeof data.spots)[0]) {
		editSpotTarget = s;
		editSpotDescription = s.description ?? '';
		openDialog = 'editSpot';
	}

	async function saveEditSpot() {
		if (!editSpotTarget) return;
		const res = await fetch(`/api/spots/${encodeURIComponent(editSpotTarget.number)}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ description: editSpotDescription.trim() || null })
		});
		if (res.ok) {
			toast.success(`Place de parking "${editSpotTarget.number}" mise à jour`);
			openDialog = null;
			editSpotTarget = null;
			invalidateAll();
		} else {
			const result = await res.json();
			toast.error(result.error || 'Impossible de modifier la place de parking');
		}
	}

	async function deleteSpot(spotNumber: string) {
		const res = await fetch(`/api/spots/${encodeURIComponent(spotNumber)}`, { method: 'DELETE' });
		if (res.ok) {
			toast.success(`Place de parking "${spotNumber}" supprimée`);
			invalidateAll();
		} else {
			const result = await res.json();
			toast.error(result.error || 'Impossible de supprimer la place de parking');
		}
	}

	function confirmDeleteSpot(spotNumber: string) {
		confirmAction = { type: 'deleteSpot', spotNumber };
	}

	async function resetFlat(flatNumber: string) {
		const res = await fetch(`/api/admin/flats/${encodeURIComponent(flatNumber)}/reset`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ confirm: true })
		});

		if (res.ok) {
			toast.success('Appartement réinitialisé');
			openDialog = null;
			detailOpen = false;
			selectedItem = null;
			invalidateAll();
		} else {
			const result = await res.json();
			toast.error(result.error || 'Impossible de réinitialiser');
		}
	}

	async function toggleAdmin(flatNumber: string, currentIsAdmin: boolean) {
		const res = await fetch(`/api/admin/flats/${encodeURIComponent(flatNumber)}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ isAdmin: !currentIsAdmin })
		});

		if (res.ok) {
			toast.success('Statut admin mis à jour');
			invalidateAll();
		} else {
			toast.error('Impossible de modifier le statut');
		}
	}

	async function deleteFlat(flatNumber: string) {
		const res = await fetch(`/api/admin/flats/${encodeURIComponent(flatNumber)}`, { method: 'DELETE' });

		if (res.ok) {
			toast.success('Appartement supprimé');
			openDialog = null;
			detailOpen = false;
			selectedItem = null;
			invalidateAll();
		} else {
			const result = await res.json();
			toast.error(result.error || 'Impossible de supprimer');
		}
	}

	function confirmResetFlat(flatNumber: string) {
		confirmAction = { type: 'reset', flatNumber };
	}

	function confirmDeleteFlat(flatNumber: string) {
		confirmAction = { type: 'delete', flatNumber };
	}

	function confirmRejectRequest(requestId: number) {
		confirmAction = { type: 'rejectRequest', requestId };
	}

	function confirmApproveRequest(r: (typeof data.requests)[0]) {
		const conflicts = getRequestSpotConflicts(r);
		if (conflicts.length > 0) {
			pendingApprovalConflicts = { requestId: r.id, conflicts };
		} else {
			approveRequest(r.id);
		}
	}

	function showSwapSpot(s: (typeof data.spots)[0]) {
		swapTarget = s;
		swapFlatNumber = '';
		swapSpotNumber = '';
		openDialog = 'swapSpot';
	}

	async function executeSwap() {
		if (!swapTarget || !swapFlatNumber) return;
		swapLoading = true;
		try {
			const res = await fetch('/api/admin/spots/swap', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					spotNumber: swapTarget.number,
					flatNumber: swapFlatNumber,
					targetSpotNumber: swapSpotNumber || undefined
				})
			});
			if (res.ok) {
				toast.success(`Place de parking "${swapTarget.number}" échangée`);
				openDialog = null;
				swapTarget = null;
				invalidateAll();
			} else {
				const result = await res.json();
				toast.error(result.error || "Impossible d'échanger la place de parking");
			}
		} catch {
			toast.error("Erreur lors de l'échange");
		} finally {
			swapLoading = false;
		}
	}

	async function approveRequest(requestId: number, force = false) {
		approvingRequest = requestId;
		pendingApprovalConflicts = null;
		try {
			const res = await fetch(`/api/admin/requests/${requestId}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: force ? JSON.stringify({ force: true }) : undefined
			});
			if (res.ok) {
				const req = data.requests.find((r) => r.id === requestId);
				toast.success(`Appartement ${req?.flatNumber ?? ''} approuvé`);
				detailOpen = false;
				selectedItem = null;
				invalidateAll();
			} else if (res.status === 409) {
				const result = await res.json();
				if (result.conflicts?.length > 0) {
					pendingApprovalConflicts = { requestId, conflicts: result.conflicts };
				} else {
					toast.error(result.error || 'Conflit de place de parking');
				}
			} else {
				const result = await res.json();
				toast.error(result.error || "Impossible d'approuver la demande");
			}
		} catch {
			toast.error('Erreur de connexion');
		} finally {
			approvingRequest = null;
		}
	}

	async function rejectRequest(requestId: number) {
		const res = await fetch(`/api/admin/requests/${requestId}`, { method: 'PATCH' });
		if (res.ok) {
			toast.success('Demande rejetée');
			detailOpen = false;
			selectedItem = null;
			invalidateAll();
		} else {
			const result = await res.json();
			toast.error(result.error || 'Impossible de rejeter la demande');
		}
	}

	async function executeConfirmAction() {
		if (!confirmAction) return;
		if (confirmAction.type === 'reset') {
			await resetFlat(confirmAction.flatNumber);
		} else if (confirmAction.type === 'delete') {
			await deleteFlat(confirmAction.flatNumber);
		} else if (confirmAction.type === 'deleteSpot') {
			await deleteSpot(confirmAction.spotNumber);
		} else if (confirmAction.type === 'rejectRequest') {
			await rejectRequest(confirmAction.requestId);
		}
		confirmAction = null;
	}
</script>

<div class="space-y-8">
	<div class="flex items-center justify-between">
		<h2 class="page-title">Administration</h2>
		<a href="/admin/guide">
			<Button variant="outline" size="sm"><BookOpen class="mr-1 h-4 w-4" />Guide admin</Button>
		</a>
	</div>

	<!-- Places de parking (shared only) -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Place de parking partagée</Card.Title>
			<Card.Description>Place de parking disponible pour les réservations de tous les résidents.</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			{#if sharedSpots.length === 0}
				<p class="text-muted-foreground text-sm">Aucune place de parking partagée configurée.</p>
			{:else}
				<div class="space-y-2">
				{#each sharedSpots as s}
					<div class="flex items-center justify-between rounded-md border p-3">
						<div class="flex items-center gap-2">
							<CarFront class="text-muted-foreground h-4 w-4 shrink-0" />
							<Badge variant="outline">{s.number}</Badge>
							{#if s.description}
								<span class="text-muted-foreground text-sm">{s.description}</span>
							{/if}
						</div>
					<div class="flex items-center gap-1">
						<Button size="sm" variant="ghost" onclick={() => showEditSpot(s)}>
							<Pencil class="h-3.5 w-3.5" />
						</Button>
						{#if data.flats.length > 0}
							<Button size="sm" variant="ghost" aria-label="Échanger" onclick={() => showSwapSpot(s)}>
								<ArrowLeftRight class="h-3.5 w-3.5" />
							</Button>
						{/if}
					<Button size="sm" variant="ghost" class="text-destructive hover:text-destructive hover:!bg-destructive/10" aria-label="Supprimer" onclick={() => confirmDeleteSpot(s.number)}>
						<Trash2 class="h-3.5 w-3.5" />
					</Button>
					</div>
					</div>
				{/each}
				</div>
			{/if}

			<Button variant="default" size="sm" onclick={() => (openDialog = 'addSpot')}>
				<Plus class="mr-1.5 h-3.5 w-3.5" />
				Ajouter
			</Button>
		</Card.Content>
	</Card.Root>

	<!-- Demandes en attente -->
	{#if data.requests.length > 0}
		<Card.Root>
			<Card.Header>
				<Card.Title>Demandes en attente</Card.Title>
				<Card.Description>Demandes d'accès en attente de validation.</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-2">
				{#each data.requests as r}
					{@const reqConflicts = getRequestSpotConflicts(r)}
					<div class="flex items-center justify-between rounded-md border border-dashed p-3">
						<div class="flex min-w-0 flex-wrap items-center gap-2">
							{#if reqConflicts.length > 0}
								<TriangleAlert class="h-3.5 w-3.5 shrink-0 text-warning" />
							{:else}
								<span class="h-3.5 w-3.5 shrink-0"></span>
							{/if}
							<span class="font-medium">{r.flatNumber}</span>
							<Badge class="flat-badge-request">Demande</Badge>
							{#if r.requesterName}
								<span class="text-muted-foreground text-sm">{r.requesterName}</span>
							{/if}
						</div>
						<div class="flex shrink-0 items-center gap-1">
							<Button size="sm" variant="ghost" onclick={() => openRequestDetail(r)}>
								Voir détails
							</Button>
							<Button
								size="sm"
								variant="ghost"
								class="text-success hover:text-success hover:!bg-success/10"
								disabled={approvingRequest === r.id}
								onclick={() => confirmApproveRequest(r)}
							>
								<Check class="mr-1 h-3.5 w-3.5" />
								{approvingRequest === r.id ? 'Création...' : 'Approuver'}
							</Button>
							<Button
								size="sm"
								variant="ghost"
								class="text-destructive hover:text-destructive hover:!bg-destructive/10"
								onclick={() => confirmRejectRequest(r.id)}
							>
								<X class="mr-1 h-3.5 w-3.5" />
								Rejeter
							</Button>
						</div>
					</div>
				{/each}
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- Appartements -->
	<Card.Root>
		<Card.Header class="flex flex-row items-start justify-between gap-4">
			<div>
				<Card.Title>Appartements</Card.Title>
				<Card.Description>Gérez les appartements et les accès des résidents.</Card.Description>
			</div>
			{#if data.flats.length > 0}
				<div class="relative shrink-0">
					<Search class="text-muted-foreground absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
					<Input
						placeholder="Rechercher..."
						bind:value={searchQuery}
						class="h-7 w-36 pl-7 text-xs"
					/>
				</div>
			{/if}
		</Card.Header>
		<Card.Content class="space-y-4">
			{#if data.flats.length === 0}
				<p class="text-muted-foreground text-sm">
					Aucun appartement configuré. Ajoutez les appartements de votre immeuble, puis invitez chaque résident.
				</p>
			{:else}
				<div class="space-y-2">
			{#each filteredFlats as f}
				{@const state = getFlatState(f)}
				<div class="flex items-center justify-between rounded-md border p-3">
					<div class="flex min-w-0 flex-wrap items-center gap-2">
						{#if f.isAdmin}
							<Shield class="text-primary h-3.5 w-3.5 shrink-0" />
						{:else}
							<span class="h-3.5 w-3.5 shrink-0"></span>
						{/if}
						<span class="font-medium">{f.number}</span>
						<Badge class={getStateBadgeClass(state)}>
							{getStateLabel(state)}
							{#if state === 'pending' && f.activationCodeExpiresAt}
								· {getExpiryLabel(f.activationCodeExpiresAt)}
							{:else if state === 'expired'}
								· lien périmé
							{/if}
						</Badge>
						{#if f.displayName}
							<span class="text-muted-foreground text-sm">{f.displayName}</span>
						{/if}
					</div>
							<div class="flex shrink-0 items-center gap-1">
								<Button size="sm" variant="ghost" onclick={() => openFlatDetail(f)}>
									Voir détails
								</Button>
							<Button size="sm" variant="ghost" class="text-destructive hover:text-destructive hover:!bg-destructive/10" aria-label="Supprimer" onclick={() => confirmDeleteFlat(f.number)}>
								<Trash2 class="h-3.5 w-3.5" />
							</Button>
							</div>
					</div>
				{:else}
						<p class="text-muted-foreground text-sm">Aucun appartement trouvé.</p>
					{/each}
				</div>
			{/if}

			<div class="flex gap-2">
				<Button variant="default" size="sm" onclick={() => { flatSpotInputs = ['']; newFlatNumber = ''; openDialog = 'addFlat'; }}>
					<Plus class="mr-1.5 h-3.5 w-3.5" />
					Ajouter
				</Button>
			</div>
		</Card.Content>
	</Card.Root>
</div>

<!-- Dialog: Detail (flat or request) -->
<Dialog.Root
	bind:open={detailOpen}
	onOpenChange={(o) => {
		if (!o) {
			editOpen = false;
			selectedItem = null;
		}
	}}
>
	<Dialog.Content>
		{#if selectedItem?.type === 'flat'}
			{@const f = selectedItem.item}
			{@const state = getFlatState(f)}
			{@const boundSpots = getBoundSpots(f)}
			<Dialog.Header>
				<Dialog.Title class="flex items-center gap-2">
					{#if f.isAdmin}
						<Shield class="text-primary h-3.5 w-3.5 shrink-0" />
					{:else}
						<span class="h-3.5 w-3.5 shrink-0"></span>
					{/if}
					Appartement {f.number}
					<Badge class={getStateBadgeClass(state)}>
						{getStateLabel(state)}
					</Badge>
				</Dialog.Title>
				{#if f.displayName}
					<Dialog.Description>{f.displayName}</Dialog.Description>
				{/if}
			</Dialog.Header>

			<div class="space-y-4">
				<div class="space-y-2 text-sm">
					{#if boundSpots.length > 0}
						<div class="flex items-center gap-2">
							<CarFront class="text-muted-foreground h-4 w-4 shrink-0" />
							<span class="flex flex-wrap items-center gap-1">
								{#each boundSpots as spotNum}
									<Badge variant="outline">{spotNum}</Badge>
								{/each}
							</span>
						</div>
					{:else}
						<p class="text-muted-foreground">Aucune place de parking assignée</p>
					{/if}
					{#if f.emails.length > 0}
						{#each f.emails as email}
							<div class="flex items-center gap-2">
								<Mail class="text-muted-foreground h-4 w-4 shrink-0" />
								<a href="mailto:{email}" class="underline-offset-2 hover:underline">{email}</a>
							</div>
						{/each}
					{:else}
						<p class="text-muted-foreground">Aucun email</p>
					{/if}
					{#if f.phones.length > 0}
						{#each f.phones as phone}
							<div class="flex items-center gap-2">
								<Phone class="text-muted-foreground h-4 w-4 shrink-0" />
								<a href="tel:{phone}" class="underline-offset-2 hover:underline">{displayPhone(phone)}</a>
							</div>
						{/each}
					{:else}
						<p class="text-muted-foreground">Aucun téléphone</p>
					{/if}
					{#if f.activatedAt}
						<div class="flex items-center gap-2">
							<Calendar class="text-muted-foreground h-4 w-4 shrink-0" />
							<span>Activé le {new Date(f.activatedAt).toLocaleDateString('fr-FR')}</span>
						</div>
					{/if}
					{#if f.createdAt}
						<div class="flex items-center gap-2">
							<Calendar class="text-muted-foreground h-4 w-4 shrink-0" />
							<span>Créé le {new Date(f.createdAt).toLocaleDateString('fr-FR')}</span>
						</div>
					{/if}
				</div>

				<Dialog.Root bind:open={editOpen}>
					<Dialog.Content class="sm:max-w-md">
						<Dialog.Header>
							<Dialog.Title>Modifier {f.number}</Dialog.Title>
							<Dialog.Description>Modifier le nom et les places de parking assignées.</Dialog.Description>
						</Dialog.Header>
						<div class="space-y-4">
							<div class="space-y-2">
								<Label for="edit-flat-name">Nom d'affichage</Label>
								<div class="flex gap-2">
									<Input id="edit-flat-name" placeholder="ex. Jean, Famille Dupont" bind:value={editFlatDisplayName} />
									<Button size="sm" class="shrink-0" onclick={persistEditFlatName}>
										Enregistrer
									</Button>
								</div>
								<p class="text-muted-foreground text-xs">Ce nom sera visible par les autres résidents sur le calendrier.</p>
							</div>
							<Separator />
							<div class="space-y-2">
								<Label class="flex items-center gap-2"><CarFront class="text-muted-foreground h-4 w-4" />Places de parking <span class="text-destructive">*</span></Label>
								{#if editFlatSpotInputs.filter((s) => s.length > 0).length > 0}
									<span class="flex flex-wrap items-center gap-1">
										{#each editFlatSpotInputs as spot, i}
											{#if spot.length > 0}
												<Badge variant="outline" class="gap-1">
													{spot}
													{#if editFlatSpotInputs.filter((s) => s.length > 0).length > 1}
														<button type="button" class="ml-0.5 text-muted-foreground hover:text-destructive" onclick={() => removeEditFlatSpot(i)}>
															<Trash2 class="h-3 w-3" />
														</button>
													{/if}
												</Badge>
											{/if}
										{/each}
									</span>
								{/if}
								{#if editFlatSpotInputs.length < 20}
									<div class="flex gap-2">
										<Input
											type="text"
											placeholder="ex. 01"
											bind:value={newEditFlatSpot}
											class={newEditFlatSpot.length > 0 && !isValidSpotNumber(newEditFlatSpot) ? 'border-destructive' : ''}
											onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEditFlatSpotFromInput(); } }}
										/>
										<Button type="button" size="sm" variant="default" class="shrink-0" disabled={newEditFlatSpot.length === 0 || !isValidSpotNumber(newEditFlatSpot)} onclick={addEditFlatSpotFromInput}>
											<Plus class="h-4 w-4" />
										</Button>
									</div>
									{#if newEditFlatSpot.length > 0 && !isValidSpotNumber(newEditFlatSpot)}
										<p class="text-destructive text-xs">Format requis : 1 ou 2 chiffres (ex. 3, 01, 36)</p>
									{/if}
								{/if}
							</div>
							<Separator />
							<div class="space-y-2">
								<Label class="flex items-center gap-2"><Mail class="text-muted-foreground h-4 w-4" />Emails</Label>
								{#each editFlatEmails as email, i}
									<div class="flex items-center gap-2">
										<a href="mailto:{email}" class="flex-1 text-sm underline-offset-2 hover:underline">{email}</a>
										{#if editFlatEmails.length > 1}
											<Button type="button" variant="ghost" size="icon-sm" class="text-destructive hover:text-destructive hover:!bg-destructive/10" onclick={() => removeEditFlatEmail(i)}>
												<Trash2 class="h-3.5 w-3.5" />
											</Button>
										{/if}
									</div>
								{/each}
								{#if editFlatEmails.length < MAX_CONTACTS_PER_TYPE}
									<div class="flex gap-2">
										<Input
											type="email"
											placeholder="ex. dupont@email.com"
											bind:value={newEditFlatEmail}
											class={newEditFlatEmail.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEditFlatEmail) ? 'border-destructive' : ''}
											onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEditFlatEmailFromInput(); } }}
										/>
										<Button type="button" size="sm" variant="default" class="shrink-0" disabled={newEditFlatEmail.length === 0 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEditFlatEmail)} onclick={addEditFlatEmailFromInput}>
											<Plus class="h-4 w-4" />
										</Button>
									</div>
									{#if newEditFlatEmail.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEditFlatEmail)}
										<p class="text-destructive text-xs">Email invalide</p>
									{/if}
								{/if}
							</div>
							<Separator />
							<div class="space-y-2">
								<Label class="flex items-center gap-2"><Phone class="text-muted-foreground h-4 w-4" />Téléphones</Label>
								{#each editFlatPhones as phone, i}
									<div class="flex items-center gap-2">
										<a href="tel:{phone}" class="flex-1 text-sm underline-offset-2 hover:underline">{displayPhone(phone)}</a>
										{#if editFlatPhones.length > 1}
											<Button type="button" variant="ghost" size="icon-sm" class="text-destructive hover:text-destructive hover:!bg-destructive/10" onclick={() => removeEditFlatPhone(i)}>
												<Trash2 class="h-3.5 w-3.5" />
											</Button>
										{/if}
									</div>
								{/each}
								{#if editFlatPhones.length < MAX_CONTACTS_PER_TYPE}
									<div class="flex gap-2">
										<Input
											type="tel"
											placeholder="+33 6 12 34 56 78"
											bind:value={newEditFlatPhone}
											class={newEditFlatPhone.length > 0 && !/^[\d\s\-+()]+$/.test(newEditFlatPhone) ? 'border-destructive' : ''}
											onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEditFlatPhoneFromInput(); } }}
										/>
										<Button type="button" size="sm" variant="default" class="shrink-0" disabled={newEditFlatPhone.length === 0 || !/^[\d\s\-+()]+$/.test(newEditFlatPhone)} onclick={addEditFlatPhoneFromInput}>
											<Plus class="h-4 w-4" />
										</Button>
									</div>
									{#if newEditFlatPhone.length > 0 && !/^[\d\s\-+()]+$/.test(newEditFlatPhone)}
										<p class="text-destructive text-xs">Téléphone invalide</p>
									{/if}
								{/if}
							</div>
							<Dialog.Footer>
								<Dialog.Close>
									{#snippet child({ props })}
										<Button variant="outline" class="w-full" {...props}>Fermer</Button>
									{/snippet}
								</Dialog.Close>
							</Dialog.Footer>
						</div>
					</Dialog.Content>
				</Dialog.Root>

				<!-- Invitation section (for inactive/pending/expired flats) -->
				{#if state !== 'active'}
					<Separator />
					<div class="space-y-3">
						<p class="text-sm font-medium">Invitation</p>
						{#if f.activationCode}
							<div class="flex gap-2">
								<Input readonly value={getActivationLink(f)} class="font-mono text-xs" />
								<Button variant="outline" size="sm" onclick={() => copyLink(f)}>
									<ClipboardCopy class="h-4 w-4" />
								</Button>
							</div>
							<div class="relative">
								<div class="absolute inset-0 flex items-center">
									<span class="border-t w-full"></span>
								</div>
								<div class="relative flex justify-center text-xs uppercase">
									<span class="bg-background text-muted-foreground px-2">ou scanner</span>
								</div>
							</div>
							<div class="flex justify-center">
								<div class="rounded-lg bg-white p-4">
									<QrCode value={getActivationLink(f)} size={200} />
								</div>
							</div>
							<div class="flex justify-between">
								<Button variant="outline" size="sm" onclick={regenerateInvite}>
									Régénérer un lien
								</Button>
								<Button variant="destructive" size="sm" onclick={revokeInvite}>
									Révoquer
								</Button>
							</div>
						{:else}
							<Button size="sm" onclick={() => generateActivationCode(f.number)}>
								Générer un code d'activation
							</Button>
						{/if}
					</div>
				{/if}

				<!-- Actions (for active flats) -->
				{#if state === 'active'}
					<Separator />
					<div class="space-y-2">
						<p class="text-sm font-medium">Actions</p>
						<div class="flex flex-wrap gap-2">
							<Button size="sm" variant="default" onclick={() => openEditFlat(f)}>Modifier</Button>
							{#if f.isAdmin}
								<Button size="sm" variant="outline" class="text-destructive border-destructive/30 hover:text-destructive hover:!bg-destructive/10" onclick={() => toggleAdmin(f.number, f.isAdmin)}>
									Retirer admin
								</Button>
							{:else}
								<Button size="sm" variant="outline" class="text-success border-success/30 hover:text-success hover:!bg-success/10" onclick={() => toggleAdmin(f.number, f.isAdmin)}>
									Rendre admin
								</Button>
							{/if}
							<Button size="sm" variant="outline" class="text-destructive border-destructive/30 hover:text-destructive hover:!bg-destructive/10" onclick={() => confirmResetFlat(f.number)}>
								Réinitialiser
							</Button>
						</div>
					</div>
				{/if}

				<!-- Delete (always shown) -->
				<Separator />
				<Button size="sm" variant="destructive" class="w-full" onclick={() => confirmDeleteFlat(f.number)}>
					Supprimer l'appartement
				</Button>
			</div>

		{:else if selectedItem?.type === 'request'}
			{@const r = selectedItem.item}
			{@const reqConflicts = getRequestSpotConflicts(r)}
			<Dialog.Header>
				<Dialog.Title class="flex items-center gap-2">
					{#if reqConflicts.length > 0}
						<TriangleAlert class="h-4 w-4 shrink-0 text-warning" />
					{/if}
					Demande — {r.flatNumber}
					<Badge class="flat-badge-request">Demande</Badge>
			</Dialog.Title>
				{#if r.requesterName}
					<Dialog.Description>{r.requesterName}</Dialog.Description>
				{/if}
			</Dialog.Header>

			<div class="space-y-4">
				<div class="space-y-2 text-sm">
					{#if r.requestedSpots.length > 0}
						<div class="flex items-center gap-2">
							<CarFront class="text-muted-foreground h-4 w-4 shrink-0" />
							<span class="flex flex-wrap items-center gap-1">
								{#each r.requestedSpots as spotNum}
									<Badge variant="outline">{spotNum}</Badge>
								{/each}
							</span>
						</div>
					{:else}
						<p class="text-muted-foreground">Aucune place de parking demandée</p>
					{/if}
					{#if r.emails.length > 0}
						{#each r.emails as email}
							<div class="flex items-center gap-2">
								<Mail class="text-muted-foreground h-4 w-4 shrink-0" />
								<a href="mailto:{email}" class="underline-offset-2 hover:underline">{email}</a>
							</div>
						{/each}
					{/if}
					{#if r.phones.length > 0}
						{#each r.phones as phone}
							<div class="flex items-center gap-2">
								<Phone class="text-muted-foreground h-4 w-4 shrink-0" />
								<a href="tel:{phone}" class="underline-offset-2 hover:underline">{displayPhone(phone)}</a>
							</div>
						{/each}
					{/if}
					{#if r.createdAt}
						<div class="flex items-center gap-2">
							<Calendar class="text-muted-foreground h-4 w-4 shrink-0" />
							<span>Demande du {new Date(r.createdAt).toLocaleDateString('fr-FR')}</span>
						</div>
					{/if}
				</div>

				{#if reqConflicts.length > 0}
					<div class="rounded-md bg-warning/10 p-3 text-sm">
						<div class="mb-1 flex items-center gap-1.5 font-medium text-warning">
							<TriangleAlert class="h-4 w-4" />
							Conflit de place de parking
						</div>
						<ul class="list-disc pl-5 text-muted-foreground">
							{#each reqConflicts as c}
								<li>La place de parking <strong class="text-foreground">{c.spotNumber}</strong> est déjà attribuée à <strong class="text-foreground">{c.currentFlat}</strong></li>
							{/each}
						</ul>
					</div>
				{/if}

				<Separator />
				<div class="space-y-3">
					<p class="text-sm font-medium">Actions</p>
					<div class="flex gap-2">
						<Button size="sm" variant="outline" class="text-success border-success/30 hover:text-success hover:!bg-success/10" onclick={() => confirmApproveRequest(r)} disabled={approvingRequest === r.id}>
							<Check class="mr-1 h-3.5 w-3.5" />
							{approvingRequest === r.id ? 'Création...' : 'Approuver'}
						</Button>
						<Button size="sm" variant="outline" class="text-destructive border-destructive/30 hover:text-destructive hover:!bg-destructive/10" onclick={() => confirmRejectRequest(r.id)}>
							<X class="mr-1 h-3.5 w-3.5" />
							Rejeter
						</Button>
					</div>
				</div>
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<!-- AlertDialog: Spot conflict -->
<AlertDialog.Root open={spotConflicts.length > 0} onOpenChange={(o) => { if (!o) { spotConflicts = []; pendingConflictSpots = []; pendingCreateFlatData = null; } }}>
	<AlertDialog.Content class="data-[size=default]:max-w-md data-[size=default]:sm:max-w-lg">
		<AlertDialog.Header class="place-items-start text-left w-full">
			<AlertDialog.Title>Conflit de place de parking</AlertDialog.Title>
			<AlertDialog.Description class="text-left text-wrap">
				Les places de parking suivantes sont déjà attribuées à d'autres appartements :
				<ul class="mt-2 list-disc pl-5">
					{#each spotConflicts as conflict}
						<li>Place de parking <strong>{conflict.spotNumber}</strong> : attribuée à <strong>{conflict.currentFlat}</strong></li>
					{/each}
				</ul>
				<p class="mt-2">Voulez-vous réaffecter ces places de parking ?</p>
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Annuler</AlertDialog.Cancel>
			<AlertDialog.Action variant="default" onclick={() => {
				spotConflicts = [];
				if (conflictMode === 'create' && pendingCreateFlatData) {
					const d = pendingCreateFlatData;
					pendingCreateFlatData = null;
					pendingConflictSpots = [];
					addFlat(true);
				} else {
					persistEditFlatSpots(true, pendingConflictSpots);
				}
			}}>Réaffecter</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<!-- AlertDialog: Approval spot conflict -->
<AlertDialog.Root open={pendingApprovalConflicts !== null} onOpenChange={(o) => { if (!o) pendingApprovalConflicts = null; }}>
	<AlertDialog.Content class="data-[size=default]:max-w-md data-[size=default]:sm:max-w-lg">
		<AlertDialog.Header class="place-items-start text-left w-full">
			<AlertDialog.Title>Approuver avec conflit</AlertDialog.Title>
			<AlertDialog.Description class="text-left text-wrap">
				Les places de parking suivantes sont déjà attribuées à d'autres appartements :
				<ul class="mt-2 list-disc pl-5">
					{#each (pendingApprovalConflicts?.conflicts ?? []) as c}
						<li>Place de parking <strong>{c.spotNumber}</strong> : attribuée à {c.currentFlat}</li>
					{/each}
				</ul>
				<p class="mt-2">Voulez-vous réaffecter ces places de parking ?</p>
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Annuler</AlertDialog.Cancel>
			<AlertDialog.Action variant="default" onclick={() => {
				if (pendingApprovalConflicts) {
					approveRequest(pendingApprovalConflicts.requestId, true);
				}
			}}>Réaffecter et approuver</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<!-- Dialog: Ajouter -->
<Dialog.Root
	open={openDialog === 'addSpot'}
	onOpenChange={(o) => {
		if (!o) openDialog = null;
	}}
>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Ajouter une place de parking</Dialog.Title>
			<Dialog.Description>La place de parking sera disponible immédiatement pour les réservations.</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-4">
			<div class="space-y-2">
				<Label for="spot-number">Numéro <span class="text-destructive">*</span></Label>
				<Input
					id="spot-number"
					placeholder="ex. 01"
					bind:value={newSpotNumber}
					class={newSpotNumber && !newSpotValid ? 'border-destructive' : ''}
				/>
				{#if newSpotNumber && !newSpotValid}
					<p class="text-destructive text-xs">Format requis : 2 chiffres (ex. 01, 36)</p>
				{:else if newSpotNumber && newSpotExists}
					<p class="text-destructive text-xs">Cette place de parking existe déjà</p>
				{/if}
			</div>
			<div class="space-y-2">
				<Label for="spot-desc">Description</Label>
				<Input id="spot-desc" placeholder="ex. Place de parking handicapé" bind:value={newSpotDescription} />
			</div>
			<Button class="w-full" onclick={addSpot} disabled={!canAddSpot}>Ajouter</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>

<!-- Dialog: Modifier une place -->
<Dialog.Root
	open={openDialog === 'editSpot'}
	onOpenChange={(o) => {
		if (!o) {
			openDialog = null;
			editSpotTarget = null;
		}
	}}
>
	<Dialog.Content>
		{#if editSpotTarget}
			<Dialog.Header>
				<Dialog.Title>Modifier la place de parking {editSpotTarget.number}</Dialog.Title>
				<Dialog.Description>Le numéro de la place de parking ne peut pas être modifié.</Dialog.Description>
			</Dialog.Header>
			<div class="space-y-4">
				<div class="space-y-2">
					<Label for="edit-spot-desc">Description</Label>
					<Input id="edit-spot-desc" placeholder="ex. Place de parking handicapé" bind:value={editSpotDescription} />
				</div>
				<Button class="w-full" onclick={saveEditSpot}>Enregistrer</Button>
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<!-- Dialog: Échanger une place -->
<Dialog.Root
	open={openDialog === 'swapSpot'}
	onOpenChange={(o) => {
		if (!o) {
			openDialog = null;
			swapTarget = null;
		}
	}}
>
	<Dialog.Content>
		{#if swapTarget}
			<Dialog.Header>
				<Dialog.Title>Échanger la place de parking {swapTarget.number}</Dialog.Title>
				<Dialog.Description>Assigner cette place de parking à un appartement existant.</Dialog.Description>
			</Dialog.Header>
			<div class="space-y-4">
				<div class="space-y-2">
					<Label for="swap-flat">Appartement</Label>
					<select
						id="swap-flat"
						class="border-input bg-background text-foreground flex h-8 w-full rounded-md border px-2 text-sm"
						bind:value={swapFlatNumber}
					>
						<option value="">Sélectionner un appartement...</option>
						{#each data.flats as f}
							<option value={f.number}>{f.number}{f.displayName ? ` — ${f.displayName}` : ''}</option>
						{/each}
					</select>
				</div>

				{#if swapFlatNumber && swapFlatSpots.length > 0}
					<div class="space-y-2">
						<Label for="swap-spot">Place de parking à échanger</Label>
						<select
							id="swap-spot"
							class="border-input bg-background text-foreground flex h-8 w-full rounded-md border px-2 text-sm"
							bind:value={swapSpotNumber}
						>
							<option value="">Sélectionner une place de parking...</option>
							{#each swapFlatSpots as s}
								<option value={s.number}>Place de parking {s.number}{s.description ? ` — ${s.description}` : ''}</option>
							{/each}
						</select>
					</div>
				{/if}

				{#if swapFlatNumber}
					<div class="rounded-md bg-muted p-3 text-xs text-muted-foreground">
						{#if swapSpotNumber}
La place de parking <strong class="text-foreground">{swapTarget.number}</strong> sera assignée à <strong class="text-foreground">{swapFlatNumber}</strong>.
						La place de parking <strong class="text-foreground">{swapSpotNumber}</strong> deviendra partagée.
						{:else}
La place de parking <strong class="text-foreground">{swapTarget.number}</strong> sera assignée à <strong class="text-foreground">{swapFlatNumber}</strong>.
					{/if}
					</div>
				{/if}

				<Button
					class="w-full"
					onclick={executeSwap}
					disabled={!swapFlatNumber || swapLoading}
				>
					{swapLoading ? 'Échange...' : 'Échanger'}
				</Button>
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<!-- Dialog: Ajouter un appartement -->
<Dialog.Root
	open={openDialog === 'addFlat'}
	onOpenChange={(o) => {
		if (!o) openDialog = null;
	}}
>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Ajouter un appartement</Dialog.Title>
			<Dialog.Description>L'appartement sera créé en état inactif. Vous pourrez l'inviter ensuite.</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-4">
			<div class="space-y-2">
				<Label for="flat-number">Numéro d'appartement <span class="text-destructive">*</span></Label>
				<Input
					id="flat-number"
					placeholder="ex. B12"
					bind:value={newFlatNumber}
					oninput={() => { newFlatNumber = newFlatNumber.toUpperCase(); }}
					class={newFlatNumber && !newFlatValid ? 'border-destructive' : ''}
				/>
				{#if newFlatNumber && !newFlatValid}
					<p class="text-destructive text-xs">Format requis : ex. A01 ou B12</p>
				{:else if newFlatNumber && newFlatExists}
					<p class="text-destructive text-xs">Cet appartement existe déjà</p>
				{/if}
			</div>
			<div class="space-y-2">
				<Label class="flex items-center gap-2"><CarFront class="text-muted-foreground h-4 w-4" />Places de parking <span class="text-destructive">*</span></Label>
				{#if flatSpotInputs.filter((s) => s.length > 0).length > 0}
					<span class="flex flex-wrap items-center gap-1">
						{#each flatSpotInputs as spot, i}
							{#if spot.length > 0}
							<Badge variant="outline" class="gap-1">
								{spot}
								{#if flatSpotInputs.filter((s) => s.length > 0).length > 1}
									<button type="button" class="ml-0.5 text-muted-foreground hover:text-destructive" onclick={() => { flatSpotInputs = flatSpotInputs.filter((_, j) => j !== i); if (flatSpotInputs.length === 0) flatSpotInputs = ['']; }}>
										<Trash2 class="h-3 w-3" />
									</button>
								{/if}
							</Badge>
							{/if}
						{/each}
					</span>
				{/if}
				<div class="flex gap-2">
					<Input
						type="text"
						placeholder="ex. 01"
						bind:value={newFlatSpot}
						class={newFlatSpot.length > 0 && !newFlatSpotValid ? 'border-destructive' : ''}
						onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFlatSpotFromInput(); } }}
					/>
					<Button type="button" size="sm" variant="default" class="shrink-0" disabled={!newFlatSpotValid} onclick={addFlatSpotFromInput}>
						<Plus class="h-4 w-4" />
					</Button>
				</div>
				{#if newFlatSpot.length > 0 && !newFlatSpotValid}
					<p class="text-destructive text-xs">Format requis : 1 ou 2 chiffres (ex. 3, 01, 36)</p>
				{/if}
			</div>
		<div class="space-y-2">
			<Label class="flex items-center gap-2"><Mail class="text-muted-foreground h-4 w-4" />Emails <span class="text-destructive">*</span></Label>
			{#each flatEmailInputs as email, i}
				{#if email.length > 0}
					<div class="flex items-center gap-2">
						<span class="flex-1 text-sm">{email}</span>
						<Button type="button" variant="ghost" size="icon-sm" class="text-destructive hover:text-destructive hover:!bg-destructive/10" onclick={() => { flatEmailInputs = flatEmailInputs.filter((_, j) => j !== i); if (flatEmailInputs.length === 0) flatEmailInputs = ['']; }}>
							<Trash2 class="h-3.5 w-3.5" />
						</Button>
					</div>
				{/if}
			{/each}
			<div class="flex gap-2">
				<Input
					type="email"
					placeholder="ex. dupont@email.com"
					bind:value={newFlatEmail}
					class={newFlatEmail.length > 0 && !newFlatEmailValid ? 'border-destructive' : ''}
					onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFlatEmailFromInput(); } }}
				/>
				<Button type="button" size="sm" variant="default" class="shrink-0" disabled={!newFlatEmailValid} onclick={addFlatEmailFromInput}>
					<Plus class="h-4 w-4" />
				</Button>
			</div>
			{#if newFlatEmail.length > 0 && !newFlatEmailValid}
				<p class="text-destructive text-xs">Email invalide</p>
			{/if}
		</div>
		<div class="space-y-2">
			<Label class="flex items-center gap-2"><Phone class="text-muted-foreground h-4 w-4" />Téléphones <span class="text-destructive">*</span></Label>
			{#each flatPhoneInputs as phone, i}
				{#if phone.length > 0}
					<div class="flex items-center gap-2">
						<span class="flex-1 text-sm">{displayPhone(phone)}</span>
						<Button type="button" variant="ghost" size="icon-sm" class="text-destructive hover:text-destructive hover:!bg-destructive/10" onclick={() => { flatPhoneInputs = flatPhoneInputs.filter((_, j) => j !== i); if (flatPhoneInputs.length === 0) flatPhoneInputs = ['']; }}>
							<Trash2 class="h-3.5 w-3.5" />
						</Button>
					</div>
				{/if}
			{/each}
			<div class="flex gap-2">
				<Input
					type="tel"
					placeholder="+33 6 12 34 56 78"
					bind:value={newFlatPhone}
					class={newFlatPhone.length > 0 && !newFlatPhoneValid ? 'border-destructive' : ''}
					onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFlatPhoneFromInput(); } }}
				/>
				<Button type="button" size="sm" variant="default" class="shrink-0" disabled={!newFlatPhoneValid} onclick={addFlatPhoneFromInput}>
					<Plus class="h-4 w-4" />
				</Button>
			</div>
			{#if newFlatPhone.length > 0 && !newFlatPhoneValid}
				<p class="text-destructive text-xs">Téléphone invalide</p>
			{/if}
		</div>
		<Button class="w-full" onclick={() => addFlat()} disabled={!canAddFlat}>Ajouter</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>

<!-- AlertDialog: Confirmation -->
<AlertDialog.Root
	open={confirmAction !== null}
	onOpenChange={(o) => {
		if (!o) confirmAction = null;
	}}
>
	<AlertDialog.Content>
		<AlertDialog.Header>
		<AlertDialog.Title>
			{#if confirmAction?.type === 'reset'}
				Réinitialiser l'appartement
			{:else if confirmAction?.type === 'deleteSpot'}
				Supprimer la place de parking
			{:else if confirmAction?.type === 'rejectRequest'}
				Rejeter la demande
			{:else}
				Supprimer l'appartement
			{/if}
		</AlertDialog.Title>
		<AlertDialog.Description>
			{#if confirmAction?.type === 'reset'}
				Cela va déconnecter le résident et supprimer son code PIN. Cette action est réversible.
			{:else if confirmAction?.type === 'deleteSpot'}
				Supprimer cette place de parking et toutes ses réservations ? Cette action est irréversible.
			{:else if confirmAction?.type === 'rejectRequest'}
				Rejeter cette demande ? Le résident ne sera pas notifié.
			{:else}
				Supprimer cet appartement et toutes ses réservations ? Cette action est irréversible.
			{/if}
		</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Annuler</AlertDialog.Cancel>
			<AlertDialog.Action variant="destructive" onclick={executeConfirmAction}>
				{confirmAction?.type === 'reset' ? 'Réinitialiser' : confirmAction?.type === 'rejectRequest' ? 'Rejeter' : 'Supprimer'}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
