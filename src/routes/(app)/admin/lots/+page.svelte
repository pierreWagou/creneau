<script lang="ts">
import Ban from '@lucide/svelte/icons/ban';
import Check from '@lucide/svelte/icons/check';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ClipboardCopy from '@lucide/svelte/icons/clipboard-copy';
	import Clock from '@lucide/svelte/icons/clock';
	import HousePlus from '@lucide/svelte/icons/house-plus';
	import Info from '@lucide/svelte/icons/info';
	import Link2 from '@lucide/svelte/icons/link-2';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Mail from '@lucide/svelte/icons/mail';
	import Plus from '@lucide/svelte/icons/plus';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Search from '@lucide/svelte/icons/search';
import Trash2 from '@lucide/svelte/icons/trash-2';
import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
import X from '@lucide/svelte/icons/x';
	import { mode } from 'mode-watcher';
	import { toast } from 'svelte-sonner';
	import { goto, invalidateAll } from '$app/navigation';
	import { getFlatColor } from '$lib/colors';
	import AdminShield from '$lib/components/admin-shield.svelte';
	import FlatDetailView from '$lib/components/flat-detail-view.svelte';
	import FlatPinForm from '$lib/components/flat-pin-form.svelte';
	import QrCode from '$lib/components/qr-code.svelte';
import SpotConflictDialog, { type ConflictChoice } from '$lib/components/spot-conflict-dialog.svelte';
import { Badge } from '$lib/components/ui/badge';
import { Button } from '$lib/components/ui/button';
import * as Card from '$lib/components/ui/card';
import * as Dialog from '$lib/components/ui/dialog';
import * as Drawer from '$lib/components/ui/drawer';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
import { Separator } from '$lib/components/ui/separator';
import { Textarea } from '$lib/components/ui/textarea';
	import { DISPLAY_NAME_MAX_LENGTH, isValidFlatNumber } from '$lib/constants';
	import { createIsDesktop } from '$lib/utils/is-desktop.svelte';
	import { displayPhone } from '$lib/utils/phone';
	import { describeSharedPoolConflicts, describeSpotConflicts, findSpotConflicts } from '$lib/utils/spots';
	import { isValidEmail, isValidPhone } from '$lib/validation';
import ConfirmDialog, { type ConfirmAction } from '../_components/confirm-dialog.svelte';

	let { data } = $props();

	// Dialog state
	type AdminDialog = 'addFlat' | null;
	let openDialog = $state<AdminDialog>(null);

	let detailOpen = $state(false);
	let editingName = $state(false);
	let detailTab = $state<'info' | 'security'>('info');
	// Admin PIN drafts (parent-owned so tab switches can't wipe them)
	let adminPinCurrent = $state('');
	let adminPinNew = $state('');
	let adminPinConfirm = $state('');
	// Bottom sheet on phones, side panel on desktop (mirrors the sm: breakpoint)
	const desktop = createIsDesktop();
	const isDark = $derived(mode.current === 'dark');

	// Form state
	let newFlatNumber = $state('');
	let newFlatDisplayName = $state('');
	// Create-dialog pencil flows (draft-only; editor open by default on fresh open)
	let createNumberEditing = $state(true);
	let createNameEditing = $state(false);
	const createNumberEdit = $derived({
		editing: createNumberEditing,
		saving: false,
		onStart: () => {
			createNumberEditing = true;
		},
		onCommit: (v: string) => {
			newFlatNumber = v.trim().toUpperCase();
			createNumberEditing = false;
		},
		onCancel: () => {
			createNumberEditing = false;
		}
	});
	const createNameEdit = $derived({
		editing: createNameEditing,
		saving: false,
		onStart: () => {
			createNameEditing = true;
		},
		onCommit: (v: string) => {
			newFlatDisplayName = v;
			createNameEditing = false;
		},
		onCancel: () => {
			createNameEditing = false;
		}
	});
	let flatSpotInputs = $state<string[]>([]);
	let flatEmailInputs = $state<string[]>([]);
	let flatPhoneInputs = $state<string[]>([]);

	// Edit flat state
	let editFlatSpotInputs = $state<string[]>(['']);
	let editFlatEmails = $state<string[]>([]);
	let editFlatPhones = $state<string[]>([]);
	let editFlatLoading = $state(false);
	let editingReqName = $state(false);
	let editReqLoading = $state(false);
	let editReqSpotInputs = $state<string[]>([]);
	let editReqEmails = $state<string[]>([]);
	let editReqPhones = $state<string[]>([]);
	let inviteModalOpen = $state(false);
	let inviteLoading = $state(false);
	let togglingAdmin = $state(false);

	// Spot conflict state (kind marks shared-pool entries alongside bound ones)
	let spotConflicts = $state<{ spotNumber: string; currentFlat: string; kind?: 'assigned' | 'shared-pool' }[]>([]);
	let pendingConflictSpots = $state<string[]>([]);
	let conflictMode = $state<'edit' | 'create'>('edit');
	let pendingCreateFlatData = $state<{ number: string; spotNumbers: string[]; emails: string[]; phones: string[] } | null>(null);

	// Search + pagination (server-driven via URL ?q= & ?page=)
	let searchInput = $state(data.q);
	let searchTimer: ReturnType<typeof setTimeout> | null = null;
	const totalPages = $derived(Math.max(1, Math.ceil(data.total / data.pageSize)));

	function updateUrl(params: URLSearchParams, replace = false) {
		goto(`?${params.toString()}`, { replaceState: replace, keepFocus: true, noScroll: true });
	}

	function onSearchInput() {
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			const params = new URLSearchParams(window.location.search);
			if (searchInput.trim()) params.set('q', searchInput.trim());
			else params.delete('q');
			params.delete('page');
			updateUrl(params, true);
		}, 300);
	}

	function gotoPage(p: number) {
		const params = new URLSearchParams(window.location.search);
		params.set('page', String(p));
		updateUrl(params);
	}

	const ALL_STATUSES = ['active', 'inactive', 'pending'] as const;

	function onStatusChange(value: string) {
		const current = new URLSearchParams(window.location.search).getAll('status');
		const next = current.includes(value) ? current.filter((s) => s !== value) : [...current, value];
		const params = new URLSearchParams(window.location.search);
		params.delete('status');
		// A full set equals unfiltered — keep the URL clean instead of listing everything
		if (next.length > 0 && next.length < ALL_STATUSES.length) {
			for (const s of next) params.append('status', s);
		}
		params.delete('page');
		updateUrl(params);
	}

	function resetFilters() {
		updateUrl(new URLSearchParams(), true);
	}

	// Sync input when the URL query changes elsewhere (e.g. back button)
	$effect(() => {
		searchInput = data.q;
	});

	// Step back when the current page becomes empty (e.g. deleted last item)
	$effect(() => {
		if (data.flats.length === 0 && data.page > 1) {
			const params = new URLSearchParams(window.location.search);
			params.set('page', String(data.page - 1));
			updateUrl(params, true);
		}
	});

	// Confirmation dialog state (narrowed: spot deletes live on the spots page)
	let confirmAction = $state<ConfirmAction | null>(null);

	// Request actions
	let approvingRequest = $state<number | null>(null);
	let pendingApprovalConflicts = $state<{ requestId: number; conflicts: { spotNumber: string; currentFlat: string }[] } | null>(null);

	// Detail dialog state: can show a flat or a request
	let selectedItem = $state<{ type: 'flat'; item: (typeof data.flats)[0] } | { type: 'request'; item: (typeof data.requests)[0] } | null>(null);

	let drawerContentEl: HTMLElement | null = $state(null);

	// Own the keyboard geometry on phones: iOS keeps the layout viewport full
	// height and shrinks the visual viewport, leaving fixed sheets to the
	// keyboard. Measure the occluded strip and resize the sheet to the visible
	// area exactly once the viewport settles (iOS reports intermediate values
	// while the keyboard animates — acting on them frame-by-frame is jitter).
	$effect(() => {
		const clearStyles = () => {
			if (!drawerContentEl) return;
			drawerContentEl.style.bottom = '';
			drawerContentEl.style.height = '';
			drawerContentEl.style.maxHeight = '';
		};
		if (!detailOpen || desktop.value) {
			clearStyles();
			return;
		}
		const vp = window.visualViewport;
		if (!vp) return;
		let timer: ReturnType<typeof setTimeout> | null = null;
		let lastInset = -1;
		const apply = () => {
			const inset = Math.max(0, Math.round(window.innerHeight - (vp.offsetTop + vp.height)));
			if (inset === lastInset) return;
			lastInset = inset;
			const el = drawerContentEl;
			if (!el) return;
			if (inset > 0) {
				el.style.bottom = `${inset}px`;
				el.style.height = `${Math.round(vp.height)}px`;
				el.style.maxHeight = 'none';
			} else {
				el.style.bottom = '';
				el.style.height = '';
				el.style.maxHeight = '';
			}
		};
		const schedule = () => {
			if (timer) clearTimeout(timer);
			timer = setTimeout(apply, 150);
		};
		vp.addEventListener('resize', schedule);
		vp.addEventListener('scroll', schedule);
		return () => {
			if (timer) clearTimeout(timer);
			vp.removeEventListener('resize', schedule);
			vp.removeEventListener('scroll', schedule);
			clearStyles();
		};
	});

	type FlatState = 'inactive' | 'pending' | 'active';

	function getFlatState(f: (typeof data.flats)[0]): FlatState {
		// Stored machine, nothing derived: dead invitations are reaped to inactive server-side
		// before any read, so a stored `pending` always holds a live invitation here.
		// Pending-without-code is unreachable (invariant) — fall back safe.
		if (f.status === 'active') return 'active';
		if (f.status === 'pending') {
			if (!f.activationCode) {
				console.warn(`[getFlatState] ${f.number}: pending without invitation, showing inactive`);
				return 'inactive';
			}
			return 'pending';
		}
		return 'inactive';
	}

	function getStateLabel(state: FlatState): string {
		switch (state) {
			case 'active': return 'Actif';
			case 'pending': return 'En attente';
			case 'inactive': return 'Inactif';
		}
	}

	function getStateBadgeClass(state: FlatState): string {
		switch (state) {
			case 'active': return 'flat-badge-active';
			case 'pending': return 'flat-badge-pending';
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

	/**
	 * Countdown chip data for the invitation section. Null when there is nothing
	 * to count down to (no expiry set, or already past — lazy reap normally prevents
	 * the latter; render nothing rather than a state that doesn't exist).
	 */
	function getExpiryChip(expiresAt: string | null): { text: string; urgent: boolean; title: string } | null {
		if (!expiresAt) return null;
		const diff = new Date(expiresAt).getTime() - Date.now();
		if (diff <= 0) return null;
		const hours = Math.floor(diff / (1000 * 60 * 60));
		const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
		return {
			text: hours > 0 ? `Expire dans ${hours}h${String(minutes).padStart(2, '0')}` : `Expire dans ${minutes}min`,
			urgent: diff < 1000 * 60 * 60,
			title: new Date(expiresAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
		};
	}

	function getActivationLink(f: (typeof data.flats)[0]): string {
		return `${window.location.origin}/activate?flat=${encodeURIComponent(f.number)}&code=${f.activationCode}`;
	}

	function getBoundSpots(f: (typeof data.flats)[0]): string[] {
		return data.spots.filter((s) => s.flatNumber === f.number).map((s) => s.number);
	}

	function getRequestSpotConflicts(r: (typeof data.requests)[0]): { spotNumber: string; currentFlat: string }[] {
		return findSpotConflicts(r.requestedSpots, runtimeSpots, r.flatNumber);
	}

	function openFlatDetail(f: (typeof data.flats)[0]) {
		selectedItem = { type: 'flat', item: f };
		detailTab = 'info';
		editFlatSpotInputs = getBoundSpots(f);
		editFlatEmails = [...f.emails];
		editFlatPhones = [...f.phones];
		editingName = false;
		detailOpen = true;
	}

	function openRequestDetail(r: (typeof data.requests)[0]) {
		selectedItem = { type: 'request', item: r };
		editReqSpotInputs = [...r.requestedSpots];
		editReqEmails = [...r.emails];
		editReqPhones = [...r.phones];
		editingReqName = false;
		detailOpen = true;
	}

	const validEditFlatSpots = $derived(
		editFlatSpotInputs.map((s) => s.trim()).filter((s) => s.length > 0)
	);

	async function commitEditFlatName(flatNumber: string, value: string): Promise<boolean> {
		if (selectedItem?.type !== 'flat' || selectedItem.item.number !== flatNumber) return false;
		const trimmed = value.trim();
		if (trimmed === (selectedItem.item.displayName ?? '')) {
			editingName = false;
			return true;
		}
		editFlatLoading = true;
		try {
			const res = await fetch(`/api/admin/flats/${encodeURIComponent(flatNumber)}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ displayName: trimmed || null })
			});
			if (res.ok) {
				const { flat } = await res.json();
				if (selectedItem?.type === 'flat' && selectedItem.item.number === flatNumber) {
					selectedItem = { ...selectedItem, item: { ...selectedItem.item, ...flat } };
				}
				toast.success('Nom mis à jour');
				await invalidateAll();
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
			editFlatLoading = false;
		}
	}

	async function persistEditFlatSpots(force = false, proposedSpots?: string[]) {		const spots = proposedSpots ?? validEditFlatSpots;
		if (selectedItem?.type !== 'flat' || spots.length === 0) return;
		const result = await patchFlatSpots(selectedItem.item.number, spots, force);
		if (result.ok) {
			if (proposedSpots) editFlatSpotInputs = proposedSpots;
			toast.success('Places de parking mises à jour');
			spotConflicts = [];
			pendingConflictSpots = [];
			clearRuntimeFlow('edit');
			invalidateAll();
		} else if (result.conflicts) {
			conflictMode = 'edit';
			pendingConflictSpots = spots;
			spotConflicts = result.conflicts;
		} else {
			toast.error(result.error || 'Erreur lors de la mise à jour');
		}
	}

	type PatchSpotsResult =
		| { ok: true }
		| { ok: false; conflicts?: { spotNumber: string; currentFlat: string }[]; error?: string };

	/** Raw PATCH without UI side effects — row-level conflict actions manage their own state */
	async function patchFlatSpots(flatNumber: string, spots: string[], force: boolean): Promise<PatchSpotsResult> {
		try {
			const res = await fetch(`/api/admin/flats/${encodeURIComponent(flatNumber)}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ spotNumbers: spots, ...(force ? { force: true } : {}) })
			});
			if (res.ok) return { ok: true };
			const result = await res.json();
			if (res.status === 409 && result.conflicts?.length > 0) {
				return { ok: false, conflicts: result.conflicts };
			}
			return {
				ok: false,
				error: result.error || (res.status === 409 ? 'Conflit de place de parking' : 'Erreur lors de la mise à jour')
			};
		} catch {
			return { ok: false, error: 'Erreur réseau' };
		}
	}

	async function persistEditFlatContacts(emailsToSave: string[], phonesToSave: string[]) {
		if (selectedItem?.type !== 'flat') return;
		const f = selectedItem.item;
		if (emailsToSave.length === 0 || phonesToSave.length === 0) return;
		try {
			const res = await fetch(`/api/admin/flats/${encodeURIComponent(f.number)}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ emails: emailsToSave, phones: phonesToSave })
			});
			if (res.ok) {
				const { flat } = await res.json();
				editFlatEmails = [...emailsToSave];
				editFlatPhones = [...phonesToSave];
				if (selectedItem?.type === 'flat' && selectedItem.item.number === f.number) {
					selectedItem = { ...selectedItem, item: { ...selectedItem.item, ...flat } };
				}
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

	async function commitEditReqName(requestId: number, value: string): Promise<boolean> {
		if (selectedItem?.type !== 'request' || selectedItem.item.id !== requestId) return false;
		const trimmed = value.trim();
		if (trimmed === (selectedItem.item.requesterName ?? '')) {
			editingReqName = false;
			return true;
		}
		editReqLoading = true;
		try {
			const res = await fetch(`/api/admin/requests/${requestId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ requesterName: trimmed || null })
			});
			if (res.ok) {
				const { request: updated } = await res.json();
				if (selectedItem?.type === 'request' && selectedItem.item.id === requestId) {
					selectedItem = { ...selectedItem, item: { ...selectedItem.item, ...updated } };
				}
				toast.success('Nom mis à jour');
				await invalidateAll();
				editingReqName = false;
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
			editReqLoading = false;
		}
	}

	async function persistEditReqSpots(proposedSpots: string[]) {
		if (selectedItem?.type !== 'request' || proposedSpots.length === 0) return;
		const r = selectedItem.item;
		try {
			const res = await fetch(`/api/admin/requests/${r.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ spotNumbers: proposedSpots })
			});
			if (res.ok) {
				const { request: updated } = await res.json();
				editReqSpotInputs = [...proposedSpots];
				if (selectedItem?.type === 'request' && selectedItem.item.id === r.id) {
					selectedItem = { ...selectedItem, item: { ...selectedItem.item, ...updated } };
				}
				toast.success('Places de parking mises à jour');
				invalidateAll();
			} else {
				const { error } = await res.json();
				toast.error(error || 'Erreur lors de la mise à jour');
			}
		} catch {
			toast.error('Erreur réseau');
		}
	}

	async function persistEditReqContacts(emailsToSave: string[], phonesToSave: string[]) {
		if (selectedItem?.type !== 'request') return;
		const r = selectedItem.item;
		if (emailsToSave.length === 0 || phonesToSave.length === 0) return;
		try {
			const res = await fetch(`/api/admin/requests/${r.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ emails: emailsToSave, phones: phonesToSave })
			});
			if (res.ok) {
				const { request: updated } = await res.json();
				editReqEmails = [...emailsToSave];
				editReqPhones = [...phonesToSave];
				if (selectedItem?.type === 'request' && selectedItem.item.id === r.id) {
					selectedItem = { ...selectedItem, item: { ...selectedItem.item, ...updated } };
				}
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
		if (!data.spots.some((s) => s.flatNumber === flatNumber)) {
			toast.error(`Attribuez d'abord une place de parking au lot ${flatNumber}`);
			return;
		}
		inviteLoading = true;
		try {
			const res = await fetch(`/api/admin/flats/${encodeURIComponent(flatNumber)}/activation`, {
				method: 'POST'
			});
			if (res.ok) {
				const { flat } = await res.json();
				if (selectedItem?.type === 'flat' && selectedItem.item.number === flatNumber) {
					selectedItem = { ...selectedItem, item: { ...selectedItem.item, ...flat } };
				}
				await invalidateAll();
				toast.success("Code d'activation généré");
				inviteModalOpen = true;
			} else {
				const result = await res.json();
				toast.error(result.error || 'Impossible de générer le code');
			}
		} finally {
			inviteLoading = false;
		}
	}

	async function resendInvite() {
		if (selectedItem?.type !== 'flat') return;
		const flatNumber = selectedItem.item.number;
		inviteLoading = true;
		try {
			const res = await fetch(`/api/admin/flats/${encodeURIComponent(flatNumber)}/activation/send`, {
				method: 'POST'
			});
			if (res.ok) {
				const { emailSent, emails } = await res.json();
				if (emailSent) {
					toast.success(`Invitation envoyée à ${emails.join(', ')}`);
				} else {
					toast.warning("L'envoi a échoué — vérifiez la configuration du serveur mail");
				}
			} else {
				const result = await res.json();
				toast.error(result.error || "Impossible d'envoyer l'email");
			}
		} finally {
			inviteLoading = false;
		}
	}

	async function regenerateInvite() {
		if (selectedItem?.type !== 'flat') return;
		const flatNumber = selectedItem.item.number;
		if (!data.spots.some((s) => s.flatNumber === flatNumber)) {
			toast.error(`Attribuez d'abord une place de parking au lot ${flatNumber}`);
			return;
		}
		inviteLoading = true;
		try {
			const res = await fetch(`/api/admin/flats/${encodeURIComponent(flatNumber)}/activation`, {
				method: 'POST'
			});
			if (res.ok) {
				const { flat } = await res.json();
				selectedItem = { ...selectedItem, item: { ...selectedItem.item, ...flat } };
				await invalidateAll();
				toast.success("Lien régénéré");
			} else {
				const result = await res.json();
				toast.error(result.error || 'Impossible de régénérer le lien');
			}
		} finally {
			inviteLoading = false;
		}
	}

	async function revokeInvite() {
		if (selectedItem?.type !== 'flat') return;
		const flatNumber = selectedItem.item.number;
		const res = await fetch(`/api/admin/flats/${encodeURIComponent(flatNumber)}/activation`, {
			method: 'DELETE'
		});
		if (res.ok) {
			const { flat } = await res.json();
			selectedItem = { ...selectedItem, item: { ...selectedItem.item, ...flat } };
			await invalidateAll();
			toast.success("Invitation révoquée");
		} else {
			const result = await res.json();
			toast.error(result.error || 'Impossible de révoquer');
		}
	}

	// Runtime holder overrides: resolver Réaffecter decisions, pre-commit.
	// Keyed by spot number; `flow` scopes cleanup to the originating flow.
	let runtimeHolders = $state<
		Record<string, { flatNumber: string; status: 'assigned'; flow: 'edit' | 'create' | 'request' }>
	>({});
	/** Runtime spot directory — every badge/picker input below reads this, never data.spots directly. */
	const runtimeSpots = $derived(
		data.spots.map((s) => {
			const o = runtimeHolders[s.number];
			return o ? { ...s, flatNumber: o.flatNumber, status: o.status } : s;
		})
	);
	/** Drop runtime holder overrides for one flow (commit success, discard). */
	function clearRuntimeFlow(flow: 'edit' | 'create' | 'request') {
		runtimeHolders = Object.fromEntries(Object.entries(runtimeHolders).filter(([, v]) => v.flow !== flow));
	}

	const validFlatSpots = $derived(flatSpotInputs.map((s) => s.trim()).filter((s) => s.length > 0));
	const normalizedNewFlat = $derived(newFlatNumber.trim().toUpperCase());
	// Create-draft conflicts: the lot doesn't exist yet, so any spot bound to
	// another lot conflicts. Spots runtime-assigned to the new lot itself are clean.
	// Shared-pool spots join the same solve gate (approving them drains the pool).
	const newFlatSpotConflicts = $derived(findSpotConflicts(validFlatSpots, runtimeSpots, normalizedNewFlat));
	const newFlatPoolConflicts = $derived(describeSharedPoolConflicts(validFlatSpots, runtimeSpots));
	const validFlatEmails = $derived(flatEmailInputs.map((e) => e.trim()).filter((e) => e.length > 0));
	const validFlatPhones = $derived(flatPhoneInputs.map((p) => p.trim()).filter((p) => p.length > 0));
	let createFormValid = $state(true);

	// Shared conflict dialog feed (all modes) + per-row action state.
	// Pool entries already carry their description — re-describing them would
	// wrongly mark them blocked (no holder to count).
	const describedConflicts = $derived([
		...describeSpotConflicts(
			spotConflicts.filter((c) => c.kind !== 'shared-pool'),
			runtimeSpots
		),
		...spotConflicts
			.filter((c) => c.kind === 'shared-pool')
			.map((c) => ({ ...c, remainingForCurrent: 0, blocked: false, kind: 'shared-pool' as const }))
	]);
	/** Kind mix driving the shared resolver dialog title/subtitle */
	const conflictDialogKinds = $derived({
		poolOnly: spotConflicts.length > 0 && spotConflicts.every((c) => c.kind === 'shared-pool'),
		mixed:
			spotConflicts.some((c) => c.kind === 'shared-pool') &&
			spotConflicts.some((c) => c.kind !== 'shared-pool')
	});
	const approvalDescribed = $derived(
		describeSpotConflicts(pendingApprovalConflicts?.conflicts ?? [], runtimeSpots)
	);
	const conflictTarget = $derived(
		conflictMode === 'edit' && selectedItem?.type === 'flat'
			? selectedItem.item.number
			: conflictMode === 'create'
				? normalizedNewFlat || 'ce lot'
				: 'Places partagées'
	);
	const approvalTarget = $derived(
		data.requests.find((r) => r.id === pendingApprovalConflicts?.requestId)?.flatNumber ?? 'ce lot'
	);
	/** Holder lot → its current spot numbers (mini lot-cards source side) */
	const holderSpotsAtlas = $derived.by(() => {
		const m: Record<string, string[]> = {};
		for (const s of data.spots) {
			if (!s.flatNumber) continue;
			if (!m[s.flatNumber]) m[s.flatNumber] = [];
			m[s.flatNumber].push(s.number);
		}
		for (const k of Object.keys(m)) m[k].sort();
		return m;
	});
	/** Shared-pool spot numbers (mini lot-cards pool source side) */
	const poolSpotsAtlas = $derived(
		data.spots
			.filter((s) => s.status === 'shared' && !s.flatNumber)
			.map((s) => s.number)
			.sort()
	);
	/** Receiving lot for the shared edit/create resolver */
	const sharedAtlasTarget = $derived(
		conflictMode === 'edit' && selectedItem?.type === 'flat'
			? { label: conflictTarget, spots: editFlatSpotInputs }
			: { label: conflictTarget, spots: validFlatSpots }
	);
	/** Receiving lot for the approval resolver (drawer draft when open, else server state) */
	const approvalAtlasTarget = $derived.by(() => {
		const id = pendingApprovalConflicts?.requestId;
		const inDrawer = selectedItem?.type === 'request' && selectedItem.item.id === id;
		const req = id != null ? data.requests.find((r) => r.id === id) : null;
		return {
			label: approvalTarget,
			spots: inDrawer ? editReqSpotInputs : (req?.requestedSpots ?? [])
		};
	});
	let applyingConflicts = $state(false);

	// Transactional staging (create/approve): reassign picks wait for submit, keeps narrow drafts now
	let stagedCreateReassigns = $state<string[]>([]);
	let stagedApproval = $state<{ requestId: number; reassigns: string[]; narrowedSpots: string[] | null } | null>(null);
	// Auto-continue flags: main action clicked while undecided → resolver opens,
	// then the resolver result continues the original action automatically.
	let autoCreateAfterResolve = $state(false);
	let autoApproveAfterResolve = $state<number | null>(null);

	/** Undecided create conflicts (staged reassigns excluded — submit will force them) */
	const undecidedCreate = $derived([
		...newFlatSpotConflicts.filter((c) => !stagedCreateReassigns.includes(c.spotNumber)),
		...newFlatPoolConflicts.filter((c) => !stagedCreateReassigns.includes(c.spotNumber))
	]);
	const drawerRequest = $derived(selectedItem?.type === 'request' ? selectedItem.item : null);
	const drawerReqConflicts = $derived(drawerRequest ? getRequestSpotConflicts(drawerRequest) : []);
	// Runtime draft conflicts for the OPEN drawer (draft mirror, not server snapshot):
	// Garder narrows the mirror immediately, so resolved spots must clear here too.
	const drawerRuntimeConflicts = $derived(
		drawerRequest ? findSpotConflicts(editReqSpotInputs, runtimeSpots, drawerRequest.flatNumber) : []
	);
	const drawerStaged = $derived(
		stagedApproval && drawerRequest && stagedApproval.requestId === drawerRequest.id
			? stagedApproval.reassigns
			: []
	);
	/** Undecided approval conflicts for the open drawer */
	const undecidedApproval = $derived(
		drawerRuntimeConflicts.filter((c) => !drawerStaged.includes(c.spotNumber))
	);

	// Prune staged intents whose spots left the draft/request (removed or resolved meanwhile)
	$effect(() => {
		const valid = validFlatSpots;
		if (stagedCreateReassigns.length > 0 && stagedCreateReassigns.some((s) => !valid.includes(s))) {
			stagedCreateReassigns = stagedCreateReassigns.filter((s) => valid.includes(s));
		}
		// Runtime holders follow the same rule — except edit flow, whose staged
		// spots join the draft only at commit (persist reads the computed list).
		const live = new Set([
			...flatSpotInputs.map((s) => s.trim()),
			...editReqSpotInputs.map((s) => s.trim())
		]);
		const stale = Object.keys(runtimeHolders).filter(
			(n) => runtimeHolders[n].flow !== 'edit' && !live.has(n)
		);
		if (stale.length > 0) {
			runtimeHolders = Object.fromEntries(
				Object.entries(runtimeHolders).filter(
					([n]) => runtimeHolders[n].flow === 'edit' || live.has(n)
				)
			);
		}
	});
	$effect(() => {
		const staged = stagedApproval;
		if (!staged) return;
		const req = data.requests.find((r) => r.id === staged.requestId);
		if (!req || !staged.reassigns.every((s) => req.requestedSpots.includes(s))) {
			stagedApproval = null;
		}
	});

	/** Staged caption under submit (« N place(s) sera/seront réaffectée(s) … ») */
	function stagedCaption(count: number, tail: string): string | null {
		if (count === 0) return null;
		return count > 1 ? `${count} places seront réaffectées ${tail}` : `1 place sera réaffectée ${tail}`;
	}

	/** Open the resolver from the create solve button (client-side conflicts, no 409 needed) */
	function openCreateConflicts() {		conflictMode = 'create';
		pendingConflictSpots = validFlatSpots;
		spotConflicts = [
			...newFlatSpotConflicts.map(({ spotNumber, currentFlat }) => ({ spotNumber, currentFlat })),
			...newFlatPoolConflicts.map(({ spotNumber }) => ({
				spotNumber,
				currentFlat: '',
				kind: 'shared-pool' as const
			}))
		];
	}

	/** Staged picks restored when the resolver reopens (create) */
	const createInitialPicks = $derived(
		Object.fromEntries(stagedCreateReassigns.map((s) => [s, 'reassign' as const]))
	);
	/** Staged picks restored when the resolver reopens (approval, same request only) */
	const approvalInitialPicks = $derived(
		stagedApproval && stagedApproval.requestId === pendingApprovalConflicts?.requestId
			? Object.fromEntries(stagedApproval.reassigns.map((s) => [s, 'reassign' as const]))
			: {}
	);

	function skippedSpotsNotice(
		blocked: { spotNumber: string; currentFlat: string; kind?: 'assigned' | 'shared-pool' }[]
	): string {
		const pool = blocked.filter((c) => c.kind === 'shared-pool').map((c) => c.spotNumber);
		const bound = blocked.filter((c) => c.kind !== 'shared-pool');
		const parts: string[] = [];
		if (bound.length > 0) {
			const labels = bound.map((c) => `${c.spotNumber} (lot ${c.currentFlat})`);
			parts.push(
				labels.length > 1
					? `Places conservées par leurs lots : ${labels.join(', ')}`
					: `Place ${labels[0]} conservée par son lot`
			);
		}
		if (pool.length > 0) {
			parts.push(
				pool.length > 1
					? `Places laissées dans le pool commun : ${pool.join(', ')}`
					: `Place ${pool[0]} laissée dans le pool commun`
			);
		}
		return parts.join(' — ');
	}

	// Batch apply for the shared dialog (reassign = force-include, keep = drop).
	// Edit resolves in one PATCH; atomic modes (create/share) go now with the kept set.
	async function applyConflictChoices(choices: ConflictChoice[]) {
		if (applyingConflicts) return;
		const reassign = choices.filter((c) => c.action === 'reassign').map((c) => c.spotNumber);
		const keep = choices.filter((c) => c.action === 'keep').map((c) => c.spotNumber);
		if (conflictMode === 'edit') {
			if (selectedItem?.type !== 'flat') return;
			const f = selectedItem.item;
			// Runtime: reassigned spots leave their old holders immediately (badges clear pre-commit)
			for (const n of reassign)
				runtimeHolders[n] = { flatNumber: f.number, status: 'assigned', flow: 'edit' };
			const next = [...new Set([...getBoundSpots(f), ...reassign])];
			if (next.length === 0) {
				// keep-all on a spotless flat: nothing to persist — runtime only
				editFlatSpotInputs = [];
				spotConflicts = [];
				pendingConflictSpots = [];
				return;
			}
			applyingConflicts = true;
			try {
				// The commit: sole writer, owns toast/invalidate/409-reopen
				await persistEditFlatSpots(true, next);
			} finally {
				applyingConflicts = false;
			}
			return;
		}
		if (conflictMode === 'create') {
			// Transactional: keeps narrow the draft now, reassigns stage until Ajouter executes
			if (keep.length > 0) {
				flatSpotInputs = flatSpotInputs.filter((s) => !keep.includes(s.trim()));
				const skipped = describedConflicts.filter((c) => keep.includes(c.spotNumber));
				if (skipped.length > 0) toast.warning(skippedSpotsNotice(skipped));
			}
			// Runtime: reassigned spots leave the pool/other holders immediately (badges clear pre-commit)
			for (const n of reassign)
				runtimeHolders[n] = { flatNumber: normalizedNewFlat, status: 'assigned', flow: 'create' };
			stagedCreateReassigns = reassign;
			spotConflicts = [];
			pendingConflictSpots = [];
			if (autoCreateAfterResolve) {
				autoCreateAfterResolve = false;
				await addFlat(true);
			}
		}
	}

	/** Ajouter click: conflicts open the resolver first, apply continues creation */
	function handleAddFlatClick() {
		if (!createFormValid) return;
		if (undecidedCreate.length > 0) {
			autoCreateAfterResolve = true;
			openCreateConflicts();
			return;
		}
		addFlat(stagedCreateReassigns.length > 0);
	}

	async function addFlat(force = false) {
		if (!createFormValid) return;

		const res = await fetch('/api/admin/flats', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				number: normalizedNewFlat,
				displayName: newFlatDisplayName.trim() || null,
				spotNumbers: validFlatSpots,
				emails: validFlatEmails,
				phones: validFlatPhones,
				...(force ? { force: true } : {})
			})
		});

		if (res.ok) {
			toast.success(`Lot ${normalizedNewFlat} ajouté`);
			newFlatNumber = '';
			newFlatDisplayName = '';
			flatSpotInputs = [];
			flatEmailInputs = [];
			flatPhoneInputs = [];
			pendingCreateFlatData = null;
			openDialog = null;
			clearRuntimeFlow('create');
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
			toast.error(result.error || "Impossible d'ajouter le lot");
		}
	}

	async function resetFlat(flatNumber: string) {
		const res = await fetch(`/api/admin/flats/${encodeURIComponent(flatNumber)}/reset`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ confirm: true })
		});

		if (res.ok) {
			toast.success('Lot réinitialisé');
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
		if (togglingAdmin) return;
		togglingAdmin = true;
		try {
			const res = await fetch(`/api/admin/flats/${encodeURIComponent(flatNumber)}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ isAdmin: !currentIsAdmin })
			});

			if (res.ok) {
				const { flat } = await res.json();
				if (selectedItem?.type === 'flat' && selectedItem.item.number === flatNumber) {
					selectedItem = { ...selectedItem, item: { ...selectedItem.item, ...flat } };
				}
				await invalidateAll();
				toast.success(!currentIsAdmin ? 'Droits admin accordés' : 'Droits admin retirés');
			} else {
				const result = await res.json().catch(() => null);
				toast.error(result?.error || 'Impossible de modifier le statut');
			}
		} finally {
			togglingAdmin = false;
		}
	}

	async function submitAdminPin(flatNumber: string, pins: { newPin: string }): Promise<boolean> {
		try {
			const res = await fetch(`/api/admin/flats/${encodeURIComponent(flatNumber)}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pin: pins.newPin })
			});
			if (res.ok) {
				toast.success('PIN mis à jour');
				return true;
			} else {
				const result = await res.json().catch(() => null);
				toast.error(result?.error || 'Impossible de modifier le PIN');
				return false;
			}
		} catch {
			toast.error('Erreur réseau');
			return false;
		}
	}

	async function deleteFlat(flatNumber: string) {
		const res = await fetch(`/api/admin/flats/${encodeURIComponent(flatNumber)}`, { method: 'DELETE' });

		if (res.ok) {
			toast.success('Lot supprimé');
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
			autoApproveAfterResolve = null;
			approveRequest(r.id);
		}
	}

	/** Approuver click: conflicts open the resolver first, apply continues approval */
	function handleApproveClick(r: (typeof data.requests)[0]) {
		if (stagedApproval?.requestId === r.id) {
			commitApproval(r.id);
			return;
		}
		// Drawer runtime list (not the server snapshot): already-kept spots must not reopen the dialog
		const runtimeConflicts =
			drawerRequest && drawerRequest.id === r.id
				? drawerRuntimeConflicts.filter((c) => !drawerStaged.includes(c.spotNumber))
				: getRequestSpotConflicts(r);
		if (runtimeConflicts.length > 0) {
			autoApproveAfterResolve = r.id;
			pendingApprovalConflicts = { requestId: r.id, conflicts: runtimeConflicts };
			return;
		}
		confirmApproveRequest(r);
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
				toast.success(`Lot ${req?.flatNumber ?? ''} approuvé`);
				detailOpen = false;
				selectedItem = null;
				clearRuntimeFlow('request');
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

	/** Raw request-spots PUT without toasts — commit step used by commitApproval and direct draft edits */
	async function putRequestSpots(
		requestId: number,
		spots: string[]
	): Promise<(typeof data.requests)[0] | null> {
		try {
			const res = await fetch(`/api/admin/requests/${requestId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ spotNumbers: spots })
			});
			if (!res.ok) return null;
			const { request: updated } = await res.json();
			if (selectedItem?.type === 'request' && selectedItem.item.id === requestId) {
				editReqSpotInputs = [...spots];
				selectedItem = { ...selectedItem, item: { ...selectedItem.item, ...updated } };
			}
			await invalidateAll();
			return updated;
		} catch {
			return null;
		}
	}

	// Batch apply for the approval dialog: transactional — keeps strip the request now,
	// reassigns stage until Approuver executes
	async function applyApprovalChoices(choices: ConflictChoice[]) {
		const pending = pendingApprovalConflicts;
		if (!pending || applyingConflicts) return;
		const req = data.requests.find((r) => r.id === pending.requestId);
		if (!req) {
			toast.error('Demande introuvable');
			return;
		}
		const keep = choices.filter((c) => c.action === 'keep').map((c) => c.spotNumber);
		const reassign = choices.filter((c) => c.action === 'reassign').map((c) => c.spotNumber);
		applyingConflicts = true;
		try {
			// Runtime only: narrow the draft the user sees, never persist here — commitApproval writes.
			// Draft mirror when the drawer is open on this request, server snapshot otherwise (row path).
			const base =
				selectedItem?.type === 'request' && selectedItem.item.id === pending.requestId
					? editReqSpotInputs
					: req.requestedSpots;
			const remaining = base.filter((s) => !keep.includes(s));
			if (keep.length > 0) {
				if (remaining.length === 0) {
					toast.error('La demande doit conserver au moins une place');
					autoApproveAfterResolve = null;
					return;
				}
				if (selectedItem?.type === 'request' && selectedItem.item.id === pending.requestId) {
					editReqSpotInputs = [...remaining];
				}
				const skipped = approvalDescribed.filter((c) => keep.includes(c.spotNumber));
				if (skipped.length > 0) toast.warning(skippedSpotsNotice(skipped));
			}
			// Runtime: reassigned spots leave their old holders immediately (badges clear pre-commit)
			for (const n of reassign)
				runtimeHolders[n] = { flatNumber: req.flatNumber, status: 'assigned', flow: 'request' };
			stagedApproval = {
				requestId: pending.requestId,
				reassigns: reassign,
				narrowedSpots: keep.length > 0 ? remaining : null
			};
			pendingApprovalConflicts = null;
			if (autoApproveAfterResolve === pending.requestId) {
				autoApproveAfterResolve = null;
				await commitApproval(pending.requestId);
			}
		} finally {
			applyingConflicts = false;
		}
	}

	/** Commit step for approvals (sole writer): sync narrowed draft, then force-approve */
	async function commitApproval(requestId: number) {
		const staged = stagedApproval && stagedApproval.requestId === requestId ? stagedApproval : null;
		if (staged?.narrowedSpots) {
			const current = data.requests.find((r) => r.id === requestId)?.requestedSpots ?? [];
			const narrowed = staged.narrowedSpots.filter((s) => current.includes(s));
			if (narrowed.length === 0) {
				toast.error('La demande doit conserver au moins une place');
				return;
			}
			const updated = await putRequestSpots(requestId, narrowed);
			if (!updated) {
				toast.error('Erreur lors de la mise à jour');
				return;
			}
		}
		await approveRequest(requestId, true);
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

	async function executeConfirmAction(action: ConfirmAction) {
		if (action.type === 'reset') {
			await resetFlat(action.flatNumber);
		} else if (action.type === 'delete') {
			await deleteFlat(action.flatNumber);
		} else if (action.type === 'rejectRequest') {
			await rejectRequest(action.requestId);
		}
		confirmAction = null;
	}
</script>

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
					<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions: row click is a mouse/touch shortcut; the info button is the keyboard/screen-reader path -->
					<div
						class="flex items-center justify-between rounded-md border border-dashed p-3 cursor-pointer hover:bg-muted/50 transition-colors"
						onclick={() => openRequestDetail(r)}
					>
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
							<Button size="icon-sm" variant="ghost" aria-label="Voir détails" onclick={() => openRequestDetail(r)}>
								<Info class="h-3.5 w-3.5" />
							</Button>
							<Button
								size="icon-sm"
								variant="ghost"
								class="text-success hover:text-success hover:!bg-success/10"
								aria-label="Approuver"
								disabled={approvingRequest === r.id}
								onclick={(e) => { e.stopPropagation(); autoApproveAfterResolve = r.id; confirmApproveRequest(r); }}
							>
								{#if approvingRequest === r.id}
									<LoaderCircle class="h-3.5 w-3.5 animate-spin" />
								{:else}
									<Check class="h-3.5 w-3.5" />
								{/if}
							</Button>
							<Button
								size="icon-sm"
								variant="ghost"
								class="text-destructive hover:text-destructive hover:!bg-destructive/10"
								aria-label="Rejeter"
								onclick={(e) => { e.stopPropagation(); confirmRejectRequest(r.id); }}
							>
								<X class="h-3.5 w-3.5" />
							</Button>
						</div>
					</div>
				{/each}
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- Lots -->
	<Card.Root>
		<Card.Header>
			<div class="flex items-center justify-between gap-2">
				<Card.Title>Lots</Card.Title>
				<Button
					variant="default"
					size="sm"
					class="shrink-0"
					onclick={() => { flatSpotInputs = []; flatEmailInputs = []; flatPhoneInputs = []; newFlatNumber = ''; newFlatDisplayName = ''; createNumberEditing = true; createNameEditing = false; openDialog = 'addFlat'; }}
				>
					<Plus class="mr-1.5 h-3.5 w-3.5" />
					Ajouter
				</Button>
			</div>
			<Card.Description>Gérez les lots et les accès des résidents.</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			{#if data.grandTotal > 0}
				{@const pillBase = 'h-7 shrink-0 rounded-full border px-2.5 sm:px-3 text-xs font-medium tabular-nums transition-colors'}
				{@const pillSolid = {
					active: 'bg-success text-[#1e1e2e] border-transparent font-semibold',
					inactive: 'bg-muted-foreground text-[#1e1e2e] border-transparent font-semibold',
					pending: 'bg-booking-busy text-[#1e1e2e] border-transparent font-semibold'
				} as const}
				{@const pillMuted = {
					active: 'bg-success/15 text-success hover:opacity-90',
					inactive: 'bg-muted text-muted-foreground hover:opacity-90',
					pending: 'bg-booking-busy/15 text-booking-busy hover:opacity-90'
				} as const}
				<div class="flex items-center gap-2">
					<div class="relative w-28 sm:w-44 shrink-0">
						<Search class="text-muted-foreground absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
						<Input
							placeholder="Rechercher..."
							bind:value={searchInput}
							oninput={onSearchInput}
							class="h-9 w-full pl-8 text-sm"
						/>
					</div>
					<div class="flex min-w-0 flex-1 gap-2 overflow-x-auto" role="group" aria-label="Filtrer par statut">
						{#each ALL_STATUSES as s}
							<button
								type="button"
								class="{pillBase} {data.status.includes(s) ? pillSolid[s] : pillMuted[s]}"
								aria-pressed={data.status.includes(s)}
								onclick={() => onStatusChange(s)}
							>
								{getStateLabel(s)}
							</button>
						{/each}
					</div>
				</div>
			{/if}
			{#if data.flats.length === 0}
				{#if data.grandTotal === 0}
					<p class="text-muted-foreground text-sm">
						Aucun lot configuré. Ajoutez les lots de votre immeuble, puis invitez chaque résident.
					</p>
				{:else}
					<p class="text-muted-foreground text-sm">
						Aucun résultat{data.q ? ` pour « ${data.q} »` : ''}{data.status.length > 0 ? ` (${data.status.map(getStateLabel).join(', ')})` : ''}.
					</p>
					<Button size="sm" variant="outline" onclick={resetFilters}>
						Réinitialiser les filtres
					</Button>
				{/if}
			{:else}
				<div class="space-y-2">
			{#each data.flats as f}
				{@const state = getFlatState(f)}
				<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions: row click is a mouse/touch shortcut; the info button is the keyboard/screen-reader path -->
				<div
					class="flex items-center justify-between rounded-md border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
					onclick={() => openFlatDetail(f)}
				>
					<div class="flex min-w-0 flex-wrap items-center gap-2">
						{#if f.isAdmin}
							<AdminShield active size="sm" />
						{:else}
							<span class="h-3.5 w-3.5 shrink-0"></span>
						{/if}
						<span class="font-medium">{f.number}</span>
						<Badge class={getStateBadgeClass(state)}>
							{getStateLabel(state)}
						</Badge>
						{#if !data.spots.some((s) => s.flatNumber === f.number)}
							<Badge class="flat-badge-warning">Sans place</Badge>
						{/if}
						{#if f.displayName}
							<span class="text-muted-foreground text-sm">{f.displayName}</span>
						{/if}
					</div>
							<div class="flex shrink-0 items-center gap-1">
								<Button size="icon-sm" variant="ghost" aria-label="Voir détails" onclick={() => openFlatDetail(f)}>
									<Info class="h-3.5 w-3.5" />
								</Button>
							<Button size="sm" variant="ghost" class="text-destructive hover:text-destructive hover:!bg-destructive/10" aria-label="Supprimer" onclick={(e) => { e.stopPropagation(); confirmDeleteFlat(f.number); }}>
								<Trash2 class="h-3.5 w-3.5" />
							</Button>
							</div>
					</div>
					{/each}
				</div>
			{/if}

			{#if data.total > 0}
				<div class="flex items-center justify-between pt-1">
					<p class="text-muted-foreground text-xs">
						{data.total} lot{data.total > 1 ? 's' : ''}{data.q ? ` pour « ${data.q} »` : ''}
					</p>
					{#if totalPages > 1}
						<div class="flex items-center gap-2">
							<span class="text-muted-foreground text-xs">Page {data.page}/{totalPages}</span>
							<Button size="sm" variant="outline" disabled={data.page <= 1} onclick={() => gotoPage(data.page - 1)}>
								Précédent
							</Button>
							<Button size="sm" variant="outline" disabled={data.page >= totalPages} onclick={() => gotoPage(data.page + 1)}>
								Suivant
							</Button>
						</div>
					{/if}
				</div>
			{/if}

		</Card.Content>
	</Card.Root>
<!-- Drawer: Detail (flat or request) -->
<Drawer.Root
	bind:open={detailOpen}
	direction={desktop.value ? 'right' : 'bottom'}
	onOpenChange={(o) => {
		if (!o) {
			editingName = false;
			editingReqName = false;
			detailTab = 'info';
			adminPinCurrent = '';
			adminPinNew = '';
			adminPinConfirm = '';
			selectedItem = null;
			inviteLoading = false;
			clearRuntimeFlow('edit');
			clearRuntimeFlow('request');
		}
	}}
>
	<Drawer.Content bind:ref={drawerContentEl} class="overflow-hidden overflow-clip data-[vaul-drawer-direction=bottom]:max-h-[92svh] sm:max-w-xl">
		{#if selectedItem?.type === 'flat'}
			{@const f = selectedItem.item}
			{@const state = getFlatState(f)}
			{@const boundSpots = getBoundSpots(f)}

			<div class="flex flex-1 flex-col min-h-0 overflow-y-auto overscroll-none px-6 pb-6" data-vaul-no-drag>
				<FlatDetailView
					bind:tab={detailTab}
					stickyHeader
					number={f.number}
					displayName={f.displayName}
					stateLabel={getStateLabel(state)}
					stateBadgeClass={getStateBadgeClass(state)}
					ownFlatNumber={data.viewerFlatNumber}
					isAdmin={f.isAdmin}
					spots={editFlatSpotInputs}
					descriptions={Object.fromEntries(
						data.spots.filter((s) => s.flatNumber === f.number).map((s) => [s.number, s.description])
					)}
					spotsEditable
					onSpotsChange={(spots) => {
						// Shared-pool additions need explicit confirmation (server binds silently)
						const addedPool = spots.filter(
							(n) =>
								data.spots.find((s) => s.number === n)?.status === 'shared' &&
								!getBoundSpots(f).includes(n)
						);
						if (addedPool.length > 0) {
							conflictMode = 'edit';
							pendingConflictSpots = spots;
							spotConflicts = addedPool.map((spotNumber) => ({
								spotNumber,
								currentFlat: '',
								kind: 'shared-pool' as const
							}));
							return;
						}
						persistEditFlatSpots(false, spots);
					}}
					spotDirectory={{
						all: runtimeSpots
					}}
					spotConflicts={[
						...describeSpotConflicts(
							findSpotConflicts(editFlatSpotInputs, runtimeSpots, f.number),
							runtimeSpots
						),
						...describeSharedPoolConflicts(editFlatSpotInputs, runtimeSpots)
					]}
					emails={editFlatEmails}
					phones={editFlatPhones}
					contactsEditable
					onEmailsChange={(emails) => persistEditFlatContacts(emails, editFlatPhones)}
					onPhonesChange={(phones) => persistEditFlatContacts(editFlatEmails, phones)}
					createdAt={f.createdAt}
					activatedAt={f.activatedAt}
					nameEdit={{
						editing: editingName,
						saving: editFlatLoading,
						onStart: () => {
							editingName = true;
						},
						onCommit: (value) => commitEditFlatName(f.number, value),
						onCancel: () => (editingName = false)
					}}
					onToggleAdmin={state === 'active' && f.number !== data.viewerFlatNumber
						? () => toggleAdmin(f.number, f.isAdmin)
						: undefined}
					{togglingAdmin}
				>
					{#snippet security()}
						{#if state !== 'active'}
							<p class="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Invitation</p>
							<div class="rounded-xl border border-border p-4">
								{#if f.activationCode}
									{@const expiryChip = f.activationCodeExpiresAt ? getExpiryChip(f.activationCodeExpiresAt) : null}
									<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions: row click is a mouse/touch shortcut; the icon-buttons are the keyboard/screen-reader path -->
									<div
										role="presentation"
										onclick={() => (inviteModalOpen = true)}
										class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-1 py-1 transition-colors hover:bg-muted/50"
									>
										<span class="flex-1 min-w-0">
											<span class="block truncate font-mono text-sm font-semibold">{f.activationCode}</span>
											{#if expiryChip}
												<span
													class="mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium {expiryChip.urgent
														? 'border-destructive/30 bg-destructive/10 text-destructive'
														: 'border-warning/30 bg-warning/10 text-warning'}"
													title={expiryChip.title}
												>
													<Clock class="h-3 w-3" />
													{expiryChip.text}
												</span>
											{/if}
										</span>
										<Button
											type="button"
											variant="ghost"
											size="icon-sm"
											class="shrink-0"
											aria-label="Régénérer le lien"
											disabled={inviteLoading}
											onclick={(e) => { e.stopPropagation(); regenerateInvite(); }}
										>
											<RefreshCw class="h-3.5 w-3.5" />
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="icon-sm"
											class="shrink-0 text-destructive hover:text-destructive hover:!bg-destructive/10"
											aria-label="Révoquer l'invitation"
											onclick={(e) => { e.stopPropagation(); revokeInvite(); }}
										>
											<Ban class="h-3.5 w-3.5" />
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="icon-sm"
											class="shrink-0 text-muted-foreground hover:text-foreground hover:!bg-muted"
											aria-label="Voir l'invitation"
											onclick={() => (inviteModalOpen = true)}
										>
											<ChevronRight class="h-4 w-4" />
										</Button>
									</div>
								{:else}
									<div class="space-y-2">
										<p class="text-sm text-muted-foreground">Aucun lien généré.</p>
										<Button size="sm" onclick={() => generateActivationCode(f.number)} disabled={inviteLoading}>
											{#if inviteLoading}
												⏳ Génération…
											{:else}
												<RefreshCw class="h-4 w-4 mr-1.5" />
												Générer un lien
											{/if}
										</Button>
									</div>
								{/if}
							</div>
						{/if}
						<div class="mt-4">
							<FlatPinForm
								bind:currentPin={adminPinCurrent}
								bind:newPin={adminPinNew}
								bind:confirmPin={adminPinConfirm}
								onSubmit={(pins) => submitAdminPin(f.number, pins)}
							/>
							{#if state === 'active'}
								<button
									type="button"
									class="mt-2 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
									onclick={() => confirmResetFlat(f.number)}
								>
									<RotateCcw class="h-4 w-4" />
									Réinitialiser le lot
								</button>
							{/if}
						</div>
					{/snippet}
				</FlatDetailView>
				<div class="mt-auto pt-1">
					<Button variant="default" class="w-full bg-destructive text-white hover:bg-destructive/80 dark:text-[#1e1e2e]" onclick={() => confirmDeleteFlat(f.number)}>
						<Trash2 class="h-4 w-4 mr-2" />
						Supprimer le lot
					</Button>
				</div>
			</div>

		{:else if selectedItem?.type === 'request'}
			{@const r = selectedItem.item}
			<div class="flex flex-1 flex-col min-h-0 overflow-y-auto overscroll-none px-6 pt-6 pb-6" data-vaul-no-drag>
				<FlatDetailView
					number={r.flatNumber}
					displayName={r.requesterName}
					stateLabel="Demande"
					stateBadgeClass="flat-badge-request"
					ownFlatNumber={data.viewerFlatNumber}
					spots={editReqSpotInputs}
					descriptions={Object.fromEntries(
						data.spots.filter((s) => r.requestedSpots.includes(s.number)).map((s) => [s.number, s.description])
					)}
					spotsEditable
					onSpotsChange={(spots) => persistEditReqSpots(spots)}
					spotDirectory={{
						all: runtimeSpots
					}}
					spotConflicts={[
						...describeSpotConflicts(drawerRuntimeConflicts, runtimeSpots),
						...describeSharedPoolConflicts(editReqSpotInputs, runtimeSpots)
					]}
					emails={editReqEmails}
					phones={editReqPhones}
					contactsEditable
					onEmailsChange={(emails) => persistEditReqContacts(emails, editReqPhones)}
					onPhonesChange={(phones) => persistEditReqContacts(editReqEmails, phones)}
					createdAt={r.createdAt}
					createdLabel="Demande reçue"
					nameEdit={{
						editing: editingReqName,
						saving: editReqLoading,
						onStart: () => {
							editingReqName = true;
						},
						onCommit: (value) => commitEditReqName(r.id, value),
						onCancel: () => (editingReqName = false)
					}}
				>
					{#snippet spotsFooter()}
						{@const stagedApprovalCaption = stagedCaption(drawerStaged.length, "à l'approbation")}
						{#if undecidedApproval.length > 0}
							<Button variant="outline" size="sm" onclick={() => confirmApproveRequest(r)}>
								<TriangleAlert class="h-3.5 w-3.5 text-warning" />
								Résoudre les conflits ({undecidedApproval.length})
							</Button>
						{/if}
						{#if undecidedApproval.length > 0 && stagedApprovalCaption}
							<p class="mt-1 text-xs text-muted-foreground">{stagedApprovalCaption}</p>
						{/if}
					{/snippet}
				</FlatDetailView>
				<div class="mt-auto pt-1">
					<div class="flex gap-2">
					<Button variant="default" class="flex-1 bg-success text-white hover:bg-success/80 dark:text-[#1e1e2e]" aria-label="Approuver" onclick={() => handleApproveClick(r)} disabled={approvingRequest === r.id}>
						{#if approvingRequest === r.id}
							<LoaderCircle class="h-4 w-4 mr-2 animate-spin" />
						{:else}
							<Check class="h-4 w-4 mr-2" />
						{/if}
						<span class="truncate">Approuver</span>
					</Button>
					<Button variant="default" class="flex-1 bg-destructive text-white hover:bg-destructive/80 dark:text-[#1e1e2e]" aria-label="Rejeter" onclick={() => confirmRejectRequest(r.id)}>
						<X class="h-4 w-4 mr-2" />
						<span class="truncate">Rejeter</span>
					</Button>
				</div>
				</div>
			</div>
		{/if}
	</Drawer.Content>
</Drawer.Root>

<!-- Dialog: Invitation -->
<Dialog.Root bind:open={inviteModalOpen}>
	<Dialog.Content class="sm:max-w-2xl sm:p-6">
		<Dialog.Header>
			<div class="flex items-center gap-3">
				<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
					<Link2 class="h-6 w-6" />
				</div>
				<div class="min-w-0">
					<Dialog.Title>Invitation</Dialog.Title>
					{#if selectedItem?.type === 'flat'}
						<Dialog.Description>Lot {selectedItem.item.number}</Dialog.Description>
					{/if}
				</div>
			</div>
		</Dialog.Header>
		{#if selectedItem?.type === 'flat'}
			{@const mf = selectedItem.item}
			{@const mstate = getFlatState(mf)}
			{@const flatColor = getFlatColor(mf.number, isDark)}
			{#if mf.activationCode}
				<div class="grid gap-6 md:grid-cols-2">
					<div class="space-y-3">
						<div class="flex gap-2">
							<Input readonly value={getActivationLink(mf)} class="font-mono text-xs" />
							<Button variant="outline" size="sm" onclick={() => copyLink(mf)}>
								<ClipboardCopy class="h-4 w-4" />
							</Button>
							<Button
								variant="outline"
								size="icon-sm"
								aria-label="Régénérer le lien"
								onclick={regenerateInvite}
								disabled={inviteLoading}
							>
								<RefreshCw class="h-4 w-4" />
							</Button>
						</div>
						{#if mf.activationCodeExpiresAt}
							<p class="text-xs text-warning">{getExpiryLabel(mf.activationCodeExpiresAt)}</p>
						{/if}
						<div class="flex justify-center">
							<div class="rounded-lg bg-white p-3">
								<QrCode value={getActivationLink(mf)} size={200} />
							</div>
						</div>
						<p class="text-center text-xs text-muted-foreground">
							Scannez ce code avec votre téléphone pour activer le compte.
						</p>
					</div>
					<div class="space-y-3">
						{#each mf.emails as email}
							<div class="flex items-center gap-3">
								<span
									class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
									style="background-color: color-mix(in srgb, {flatColor} 18%, transparent); color: {flatColor}"
								>
									{email.charAt(0).toUpperCase()}
								</span>
								<span class="flex-1 min-w-0 truncate text-sm">{email}</span>
								{#if mstate === 'active'}
									<Badge class="flat-badge-active shrink-0">Activé</Badge>
								{:else}
									<Badge class="flat-badge-pending shrink-0">En attente</Badge>
								{/if}
							</div>
						{/each}
						{#if mf.emails.length === 0}
							<p class="text-sm text-muted-foreground">Aucune adresse email enregistrée pour ce lot.</p>
						{/if}
						<div class="flex gap-2">
							<Button variant="outline" size="sm" onclick={resendInvite} disabled={inviteLoading}>
								{#if inviteLoading}
									⏳ Envoi…
								{:else}
									<Mail class="h-4 w-4 mr-1.5" />
									Envoyer l'email
								{/if}
							</Button>
						</div>
						<button
							type="button"
							class="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
							onclick={revokeInvite}
						>
							<Ban class="h-4 w-4" />
							Révoquer l'invitation
						</button>
					</div>
				</div>
			{:else}
				<div class="space-y-2">
					<p class="text-sm text-muted-foreground">Aucun lien généré.</p>
				</div>
			{/if}
			<Dialog.Footer class="bg-transparent border-t-0">
				<Button variant="outline" onclick={() => (inviteModalOpen = false)}>Fermer</Button>
				{#if mf.activationCode}
					<Button variant="default" onclick={() => copyLink(mf)}>Copier le lien</Button>
				{:else}
					<Button variant="default" onclick={() => generateActivationCode(mf.number)} disabled={inviteLoading}>
						{#if inviteLoading}
							⏳ Génération…
						{:else}
							<RefreshCw class="h-4 w-4 mr-2" />
							Générer un lien
						{/if}
					</Button>
				{/if}
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<!-- SpotConflictDialog: shared (edit/create/share) -->
	<SpotConflictDialog
		open={spotConflicts.length > 0}
		title={conflictDialogKinds.poolOnly
			? spotConflicts.length > 1
				? 'Places du pool commun'
				: 'Place du pool commun'
			: conflictDialogKinds.mixed
				? 'Conflits de places'
				: spotConflicts.length > 1
					? 'Places déjà attribuées'
					: 'Place déjà attribuée'}
		subtitle={conflictDialogKinds.poolOnly
			? spotConflicts.length > 1
				? 'Ces places sont dans le pool de réservation partagé.'
				: 'Cette place est dans le pool de réservation partagé.'
			: conflictDialogKinds.mixed
				? 'Certaines places sont attribuées à d’autres lots ou dans le pool commun.'
				: spotConflicts.length > 1
					? 'Ces places sont déjà attribuées à d’autres lots.'
					: 'Cette place est déjà attribuée à un autre lot.'}
		atlas={{ holders: holderSpotsAtlas, pool: poolSpotsAtlas, target: sharedAtlasTarget }}
		conflicts={describedConflicts}
		applying={applyingConflicts}
		initialPicks={conflictMode === 'create' ? createInitialPicks : {}}
		onApply={(choices) => applyConflictChoices(choices)}
		onClose={() => {
			spotConflicts = [];
			pendingConflictSpots = [];
			pendingCreateFlatData = null;
			autoCreateAfterResolve = false;
		}}
	/>

<!-- SpotConflictDialog: approval -->
	<SpotConflictDialog
		open={pendingApprovalConflicts !== null}
		title={(pendingApprovalConflicts?.conflicts.length ?? 0) > 1 ? 'Places déjà attribuées' : 'Place déjà attribuée'}
		subtitle={(pendingApprovalConflicts?.conflicts.length ?? 0) > 1
			? 'La demande concerne des places déjà attribuées à d’autres lots.'
			: 'La demande concerne une place déjà attribuée à un autre lot.'}
		atlas={{ holders: holderSpotsAtlas, pool: poolSpotsAtlas, target: approvalAtlasTarget }}
		conflicts={approvalDescribed}
		applying={applyingConflicts}
		initialPicks={approvalInitialPicks}
		onApply={(choices) => applyApprovalChoices(choices)}
		onClose={() => {
			pendingApprovalConflicts = null;
			autoApproveAfterResolve = null;
		}}
	/>

<!-- Dialog: Ajouter un lot -->
<Dialog.Root
	open={openDialog === 'addFlat'}
	onOpenChange={(o) => {
		if (!o) openDialog = null;
	}}
>
	<Dialog.Content class="sm:max-w-md sm:p-6">
		<Dialog.Header>
			<div class="flex items-center gap-3">
				<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
					<HousePlus class="h-6 w-6" />
				</div>
				<div class="min-w-0">
					<Dialog.Title>Ajouter un lot</Dialog.Title>
					<Dialog.Description>Le lot sera créé en état inactif. Vous pourrez l'inviter ensuite.</Dialog.Description>
				</div>
			</div>
		</Dialog.Header>
			<FlatDetailView
				showLifecycle={false}
				bind:number={newFlatNumber}
				bind:displayName={newFlatDisplayName}
				numberEdit={createNumberEdit}
				nameEdit={createNameEdit}
				spotsEditable
				contactsEditable
				bind:spots={flatSpotInputs}
				bind:emails={flatEmailInputs}
				bind:phones={flatPhoneInputs}
				minItems={0}
				bind:valid={createFormValid}
				spotConflicts={[
					...describeSpotConflicts(newFlatSpotConflicts, runtimeSpots),
					...newFlatPoolConflicts
				]}
					spotDirectory={{
						all: runtimeSpots
					}}
			>
				{#snippet spotsFooter()}
					{@const stagedCreateCaption = stagedCaption(stagedCreateReassigns.length, 'à la création')}
					{#if undecidedCreate.length > 0}
						<Button variant="outline" size="sm" onclick={openCreateConflicts}>
							<TriangleAlert class="h-3.5 w-3.5 text-warning" />
							Résoudre les conflits ({undecidedCreate.length})
						</Button>
					{/if}
					{#if undecidedCreate.length > 0 && stagedCreateCaption}
						<p class="mt-1 text-xs text-muted-foreground">{stagedCreateCaption}</p>
					{/if}
				{/snippet}
			</FlatDetailView>
		<Dialog.Footer class="bg-transparent border-t-0">
			<Button variant="outline" onclick={() => { openDialog = null; stagedCreateReassigns = []; autoCreateAfterResolve = false; clearRuntimeFlow('create'); }}>Annuler</Button>
			<Button variant="default" disabled={!createFormValid} onclick={handleAddFlatClick}>Ajouter</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Confirmation dialog (shared) -->
<ConfirmDialog action={confirmAction} onClose={() => (confirmAction = null)} onExecute={executeConfirmAction} />
