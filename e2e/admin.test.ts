import { type APIRequestContext, expect, test } from '@playwright/test';
import {
	ADMIN_FLAT,
	ADMIN_PIN,
	addSpotViaPicker,
	boardDrag,
	createFlatViaAPI,
	ensureSpots,
	fillAndCommit,
	login,
	navigateTo,
	TEST_SPOT
} from './helpers';

test.describe
	.serial('Admin management', () => {
		test.describe('Shared parking spots', () => {
			test('edit spot description', async ({ page }) => {
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await navigateTo(page, '/admin/spots');

				// Open the shared spot chip (spot 36) in the spot drawer
				const spotsCard = page.locator('[data-slot="card"]').filter({ hasText: 'Places de parking' });
				await spotsCard.getByRole('button', { name: `Voir la place ${TEST_SPOT}` }).click();
				const drawer = page.locator('[role="dialog"]').last();
				await expect(drawer).toBeVisible();

				// Pencil opens the inline description editor
				await drawer.getByRole('button', { name: 'Modifier la description' }).click();
				await drawer.locator('textarea').fill('Place near elevator');
				await drawer.getByRole('button', { name: 'Valider' }).click();

				// Toast confirmation
				await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'mise à jour' })).toBeVisible();

				// Description should be visible in the drawer
				await expect(drawer.getByText('Place near elevator')).toBeVisible();
				await page.keyboard.press('Escape');
			});

			test('delete a shared spot', async ({ page }) => {
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await navigateTo(page, '/admin/spots');

				// Open the shared spot chip (spot 36 still exists — edit doesn't delete it)
				const spotsCard = page.locator('[data-slot="card"]').filter({ hasText: 'Places de parking' });
				await spotsCard.getByRole('button', { name: `Voir la place ${TEST_SPOT}` }).click();
				const drawer = page.locator('[role="dialog"]').last();
				await expect(drawer).toBeVisible();

				// Delete from the drawer footer
				await drawer.getByRole('button', { name: 'Supprimer la place' }).click();

				// AlertDialog should open
				const alertDialog = page.locator('[role="alertdialog"]');
				await expect(alertDialog).toBeVisible();

				// Confirm deletion
				await alertDialog.getByRole('button', { name: 'Supprimer' }).click();

				// Toast confirmation
				await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'supprimée' })).toBeVisible();

				// Drawer closes (or Escape it); spot chip should disappear from the list
				await page.keyboard.press('Escape');
				await expect(spotsCard.getByRole('button', { name: `Voir la place ${TEST_SPOT}` })).toHaveCount(0);
			});

			test('assign a shared spot to a flat', async ({ page }) => {
				// Login first
				await login(page, ADMIN_FLAT, ADMIN_PIN);

				// Recreate + pool spot 36 via API (previous test deleted it; POST
				// alone would land it unassigned) plus spot 37
				await ensureSpots(page, [TEST_SPOT, '37']);

				await navigateTo(page, '/admin/spots');

				// Open the shared spot chip in the spot drawer
				const spotsCard = page.locator('[data-slot="card"]').filter({ hasText: 'Places de parking' });
				const spotChip = spotsCard.getByRole('button', { name: 'Voir la place 37' });
				await expect(spotChip).toBeVisible();
				await spotChip.click();
				const drawer = page.locator('[role="dialog"]').last();
				await expect(drawer).toBeVisible();

				// Open the destination dialog from the Lot section
				await drawer.getByRole('button', { name: 'Affecter la place' }).click();

				// Destination dialog should open (lot mode by default)
				const dialog = page.locator('[role="dialog"]').filter({ hasText: 'Affecter la place de parking' });
				await expect(dialog).toBeVisible();

				// Select a flat (A01)
				await dialog.locator('[id="swap-flat"]').fill('A01');
				await dialog.locator('[id="swap-flat"]').press('Escape');

				// Confirm assignment
				await dialog.getByRole('button', { name: 'Appliquer' }).click();

				// Toast confirmation
				await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'assignée' })).toBeVisible();

				// Spot should disappear from shared list (now assigned to A01)
				await page.keyboard.press('Escape');
				await expect(spotsCard.getByRole('button', { name: 'Voir la place 37' })).toHaveCount(0);
			});
		});

		test.describe('Flat management', () => {
			test('edit flat display name', async ({ page }) => {
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await navigateTo(page, '/admin/lots');

				// Open detail for A01
				const flatCard = page.locator('div.rounded-md.border').filter({ hasText: 'A01' }).first();
				await flatCard.getByRole('button', { name: 'Voir détails' }).click();

				const detailDialog = page.locator('[role="dialog"]').filter({ hasText: 'Sécurité' });
				await expect(detailDialog).toBeVisible();

				// Open the inline name editor via the header pencil
				await detailDialog.getByRole('button', { name: 'Modifier le nom' }).click();
				await detailDialog.getByPlaceholder('ex. Jean, Famille Dupont').fill('Test Resident');
				await detailDialog.getByRole('button', { name: 'Valider' }).click();

				// Toast confirmation
				await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'mis à jour' })).toBeVisible();

				// New name should be visible in the header
				await expect(detailDialog.getByText('Test Resident').first()).toBeVisible();

				// Close dialog (second Escape covers any lingering overlay focus)
				await page.keyboard.press('Escape');
				await page.waitForTimeout(500);
				await page.keyboard.press('Escape');
				await expect(detailDialog).not.toBeVisible({ timeout: 5000 });
			});

			test('toggle admin status', async ({ page }) => {
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await navigateTo(page, '/admin/lots');

				// Open detail for A02 (not admin)
				const flatCard = page.locator('div.rounded-md.border').filter({ hasText: 'A02' }).first();
				await flatCard.getByRole('button', { name: 'Voir détails' }).click();

				const detailDialog = page.locator('[role="dialog"]').filter({ hasText: 'Sécurité' });
				await expect(detailDialog).toBeVisible();

				// Click the header shield to promote
				await detailDialog.getByRole('button', { name: 'Rendre administrateur' }).click();

				// Toast confirmation
				await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'admin' })).toBeVisible();

				// Close detail dialog
				await page.keyboard.press('Escape');
				await expect(detailDialog).not.toBeVisible({ timeout: 10000 });

				// Reopen detail — shield should now offer demotion
				await flatCard.getByRole('button', { name: 'Voir détails' }).click();
				await expect(detailDialog).toBeVisible();
				await expect(detailDialog.getByRole('button', { name: 'Retirer les droits administrateur' })).toBeVisible();

				// Revoke admin via the shield
				await detailDialog.getByRole('button', { name: 'Retirer les droits administrateur' }).click();
				await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'admin' })).toBeVisible();

				// Close dialog
				await page.keyboard.press('Escape');
				await expect(detailDialog).not.toBeVisible({ timeout: 10000 });

				// Reopen — promote shield should be back
				await flatCard.getByRole('button', { name: 'Voir détails' }).click();
				await expect(detailDialog).toBeVisible();
				await expect(detailDialog.getByRole('button', { name: 'Rendre administrateur' })).toBeVisible();

				await page.keyboard.press('Escape');
			});

			test('reset a flat', async ({ page }) => {
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await navigateTo(page, '/admin/lots');

				// Open detail for A03
				const flatCard = page.locator('div.rounded-md.border').filter({ hasText: 'A03' }).first();
				await flatCard.getByRole('button', { name: 'Voir détails' }).click();

				const detailDialog = page.locator('[role="dialog"]').filter({ hasText: 'Sécurité' });
				await expect(detailDialog).toBeVisible();

				// Click Réinitialiser in the drawer footer (active lots only)
				await detailDialog.getByRole('tab', { name: 'Sécurité' }).click();
				await detailDialog.getByRole('button', { name: 'Réinitialiser', exact: true }).click();

				// AlertDialog should open
				const alertDialog = page.locator('[role="alertdialog"]');
				await expect(alertDialog).toBeVisible();

				// Confirm
				await alertDialog.getByRole('button', { name: 'Réinitialiser' }).click();

				// Toast confirmation
				await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'réinitialisé' })).toBeVisible();

				// Close dialog
				await page.keyboard.press('Escape');
				await expect(detailDialog).not.toBeVisible({ timeout: 10000 });

				// Flat should now show "Inactif" badge
				const flatCardAfter = page.locator('div.rounded-md.border').filter({ hasText: 'A03' }).first();
				await expect(flatCardAfter.getByText('Inactif')).toBeVisible();
			});

			test('delete a flat', async ({ page }) => {
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await navigateTo(page, '/admin/lots');

				// Find A04 flat row
				const flatCard = page.locator('div.rounded-md.border').filter({ hasText: 'A04' }).first();
				await expect(flatCard).toBeVisible();

				// Click the trash icon on the flat row
				const trashBtn = flatCard.getByRole('button', { name: 'Supprimer' });
				await trashBtn.click();

				// AlertDialog should open
				const alertDialog = page.locator('[role="alertdialog"]');
				await expect(alertDialog).toBeVisible();

				// Confirm deletion
				await alertDialog.getByRole('button', { name: 'Supprimer' }).click();

				// Toast confirmation
				await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'supprimé' })).toBeVisible();

				// Flat should disappear
				await expect(flatCard).not.toBeVisible({ timeout: 10000 });
			});
		});

		test.describe('Request handling', () => {
			test('approve and reject a request', async ({ page }) => {
				// Spots must exist before they can be claimed (admin pre-creates)
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await ensureSpots(page, ['50', '70']);
				await page.context().clearCookies();

				// Step 1: Submit a request as an anonymous user
				await navigateTo(page, '/request');

				// Fill flat number via the header editor (open by default, Enter commits)
				await page.getByPlaceholder('ex. B12').fill('B05');
				await page.getByPlaceholder('ex. B12').press('Enter');

				// Add a spot
				await addSpotViaPicker(page, page, '50');

				// Add email
				await page.getByRole('button', { name: 'Ajouter un e-mail' }).click();
				await page.locator('input[type="email"]').fill('b05@test.com');
				await page.keyboard.press('Enter');

				// Add phone
				await page.getByRole('button', { name: 'Ajouter un téléphone' }).click();
				await page.locator('input[type="tel"]').fill('+33612345678');
				await page.keyboard.press('Enter');

				// Submit
				await page.getByRole('button', { name: 'Envoyer la demande' }).click();

				// Confirmation message
				await expect(page.getByText('Demande envoyée')).toBeVisible({ timeout: 5000 });

				// Step 2: Login as admin and approve
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await navigateTo(page, '/admin/lots');

				// Request should appear in "Demandes en attente"
				const requestRow = page.locator('div.rounded-md.border.border-dashed').filter({ hasText: 'B05' });
				await expect(requestRow).toBeVisible({ timeout: 5000 });

				// Approve
				await requestRow.getByRole('button', { name: 'Approuver' }).click();

				// Toast confirmation
				await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'approuvé' })).toBeVisible();

				// Request should disappear
				await expect(requestRow).not.toBeVisible({ timeout: 10000 });

				// Flat B05 should now appear in flats list as pending (approval creates
				// the flat inactive, then the invitation moves it to pending)
				const flatCard = page.locator('div.rounded-md.border').filter({ hasText: 'B05' }).first();
				await expect(flatCard).toBeVisible();
				await expect(flatCard.getByText('En attente', { exact: true })).toBeVisible();

				// Step 3: Submit another request for a different flat, then reject it
				await page.request.post('/api/auth/logout');
				await page.context().clearCookies();

				await navigateTo(page, '/request');
				await page.getByPlaceholder('ex. B12').fill('A99');
				await page.getByPlaceholder('ex. B12').press('Enter');
				await addSpotViaPicker(page, page, '70');
				await page.getByRole('button', { name: 'Ajouter un e-mail' }).click();
				await page.locator('input[type="email"]').fill('a99@test.com');
				await page.keyboard.press('Enter');
				await page.getByRole('button', { name: 'Ajouter un téléphone' }).click();
				await page.locator('input[type="tel"]').fill('+33698765432');
				await page.keyboard.press('Enter');
				await page.getByRole('button', { name: 'Envoyer la demande' }).click();
				await expect(page.getByText('Demande envoyée')).toBeVisible({ timeout: 5000 });

				// Login as admin again
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await navigateTo(page, '/admin/lots');

				// A99 request should appear
				const requestRow2 = page.locator('div.rounded-md.border.border-dashed').filter({ hasText: 'A99' });
				await expect(requestRow2).toBeVisible({ timeout: 5000 });

				// Reject
				await requestRow2.getByRole('button', { name: 'Rejeter' }).click();

				// AlertDialog confirmation
				const alertDialog = page.locator('[role="alertdialog"]');
				await expect(alertDialog).toBeVisible();
				await alertDialog.getByRole('button', { name: 'Rejeter' }).click();

				// Toast confirmation
				await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'rejetée' })).toBeVisible();

				// Request should disappear
				await expect(requestRow2).not.toBeVisible({ timeout: 10000 });
			});

			test('creating a lot chains into the invite modal', async ({ page }) => {
				// Hermetic fixture: fresh spot 96. It stays UNASSIGNED (plain POST —
				// ensureSpots would share it and route submit to the pool resolver instead).
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await page.request.post('/api/spots', { data: { number: '96' } });
				await navigateTo(page, '/admin/lots');
				const lotsCard = page.locator('[data-slot="card"]').filter({ hasText: 'Gérez les lots' });
				await lotsCard.getByRole('button', { name: 'Ajouter', exact: true }).click();
				const createDialog = page.locator('[role="dialog"]').filter({ hasText: 'Ajouter un lot' });
				await expect(createDialog).toBeVisible({ timeout: 5000 });
				await fillAndCommit(createDialog.getByPlaceholder('ex. B12'), 'B26');
				await createDialog.getByRole('button', { name: 'Ajouter un e-mail' }).click();
				await createDialog.locator('input[type="email"]').fill('b26@test.com');
				await page.keyboard.press('Enter');
				await createDialog.getByRole('button', { name: 'Ajouter un téléphone' }).click();
				await createDialog.locator('input[type="tel"]').fill('+33612345622');
				await page.keyboard.press('Enter');
				await addSpotViaPicker(page, createDialog, '96');
				await createDialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
				// Submit must succeed outright (unassigned spot, no resolver) —
				// separates a submit failure from a chain failure below.
				await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'ajouté' })).toBeVisible({
					timeout: 10000
				});
				// Chain: create dialog closes, invite modal opens with a generated code.
				// Accessible-name match (not hasText — the create dialog's
				// subtitle also mentions "invitation" and would match).
				const inviteDialog = page.getByRole('dialog', { name: 'Invitation' });
				await expect(inviteDialog).toBeVisible({ timeout: 10000 });
				// The code itself is asserted API-side: modal internals render
				// async and flake under load, while the activation suite pins
				// the readonly input URL thoroughly.
				const flatsRes = await page.request.get('/api/admin/flats');
				expect(flatsRes.ok()).toBe(true);
				const { flats } = await flatsRes.json();
				const b26 = flats.find((f: { number: string }) => f.number === 'B26');
				expect(b26?.activationCode).toBeTruthy();
				await page.keyboard.press('Escape');
			});
		});

		test.describe('Spot lifecycle', () => {
			test('created spots land unassigned and pool on demand', async ({ page }) => {
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await navigateTo(page, '/admin/spots');
				const spotsCard = page.locator('[data-slot="card"]').filter({ hasText: 'Places de parking' });
				const limboPill = spotsCard.getByRole('button', { name: /Non affectée/ });
				const sharedPill = spotsCard.getByRole('button', { name: /Partagées/ });
				const spot83 = spotsCard.getByRole('button', { name: /Voir la place 83/ });

				// Main button creates 83 straight into limbo (not the shared filter)
				await page.request.post('/api/spots', { data: { number: '83' } });
				await navigateTo(page, '/admin/spots');
				await limboPill.click();
				await expect(spot83).toBeVisible({ timeout: 5000 });
				// Exclusive shared view: deselect limbo — unassigned spots stay hidden
				await limboPill.click();
				await expect(spot83).toHaveCount(0);

				// Pool it from the spot drawer (union view again)
				await limboPill.click();
				await spot83.click();
				const spotDrawer = page.locator('[role="dialog"]').last();
				await expect(spotDrawer).toBeVisible();
				await expect(spotDrawer.getByText('Non affectée', { exact: true })).toBeVisible();
				await spotDrawer.getByRole('button', { name: 'Mettre en commun' }).click();
				await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'mise en commun' })).toBeVisible();
				await page.keyboard.press('Escape');
				// Exclusive shared view: 83 is pooled now, so it shows there
				await limboPill.click();
				await expect(spot83).toBeVisible({ timeout: 5000 });

				// Park it back to limbo
				await limboPill.click();
				await spot83.click();
				await expect(spotDrawer).toBeVisible();
				await spotDrawer.getByRole('button', { name: 'Retirer des places partagées' }).click();
				await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'non affectée' })).toBeVisible();
				await page.keyboard.press('Escape');
				// Exclusive limbo view: deselect shared — 83 waits in limbo
				await sharedPill.click();
				await expect(spot83).toBeVisible({ timeout: 5000 });
			});

			test('lot deep link opens the flat drawer', async ({ page }) => {
				// Hermetic fixture: B22 holding only spot 82 (deep links arrive from
				// mails — this is the journey a resident takes from an invitation)
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await ensureSpots(page, ['82']);
				await createFlatViaAPI(page.request, { number: 'B22', spotNumbers: ['82'] });

				await navigateTo(page, '/admin/lots?lot=B22');
				const lotDrawer = page.locator('[role="dialog"]').filter({ hasText: 'Sécurité' });
				await expect(lotDrawer).toBeVisible({ timeout: 10000 });
				// Bound-spot chip proves this is B22's drawer specifically
				await expect(lotDrawer.getByText('82', { exact: true })).toBeVisible();
				// Closing strips the param so refresh doesn't reopen
				await page.keyboard.press('Escape');
				await expect(lotDrawer).not.toBeVisible({ timeout: 10000 });
				await expect(page).not.toHaveURL(/lot=B22/);

				// Post-close clicks still land: no orphaned overlay may survive
				// (regression: close→reopen churn used to eat pointer events)
				await page.getByPlaceholder('Rechercher…').fill('B22');
				const b22Flat = page.locator('div.rounded-md.border').filter({ hasText: 'B22' }).first();
				await expect(b22Flat).toBeVisible({ timeout: 10000 });
				await b22Flat.getByRole('button', { name: 'Voir détails' }).click();
				await expect(lotDrawer).toBeVisible({ timeout: 10000 });
				await page.keyboard.press('Escape');
				await expect(lotDrawer).not.toBeVisible({ timeout: 10000 });

				// Unknown lot: no drawer, param dropped
				await navigateTo(page, '/admin/lots?lot=ZZ9');
				await expect(page).not.toHaveURL(/lot=ZZ9/, { timeout: 10000 });
				await expect(lotDrawer).toHaveCount(0);
			});
		});

		test.describe('Bourse aux places', () => {
			async function createMercatoFixtures(request: APIRequestContext) {
				await createFlatViaAPI(request, { number: 'A86', spotNumbers: ['86'] });
				await createFlatViaAPI(request, { number: 'A87', spotNumbers: ['87'] });
			}

			async function cleanupMercatoFixtures(request: APIRequestContext) {
				for (const flatNumber of ['A86', 'A87']) {
					await request.delete(`/api/admin/flats/${flatNumber}`);
				}
				for (const spotNumber of ['86', '87']) {
					await request.delete(`/api/spots/${spotNumber}`);
				}
			}

			test('board selects lots and applies a drag', async ({ page }) => {
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await createMercatoFixtures(page.request);
				// A88 holds two spots so dragging one of them out stays legal
				await createFlatViaAPI(page.request, { number: 'A88', spotNumbers: ['88', '89'] });
				await navigateTo(page, '/admin/spots');

				const board = page.getByRole('group', { name: 'Bourse aux places' });
				await expect(board).toBeVisible();
				const lotSearch = board.getByLabel('Rechercher un lot');
				await lotSearch.fill('A88');
				await page.getByRole('option', { name: 'A88' }).click();
				await lotSearch.press('Escape');
				await lotSearch.press('Escape');
				// Picking a lot also picks its spots: the search text resets
				await expect(lotSearch).toHaveValue('');
				await lotSearch.fill('A87');
				await page.getByRole('option', { name: 'A87' }).click();
				await lotSearch.press('Escape');
				await expect(board.getByText('Lot A88')).toBeVisible();
				await expect(board.getByText('Lot A87')).toBeVisible();

				// Drag spot 88 onto the A87 column, then apply
				await boardDrag(page, board, 'Place 88, Lot A88', 'mercato-zone-A87');
				await board.getByRole('button', { name: 'Appliquer' }).click();
				await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'réaffectée' })).toBeVisible();

				await page.request.delete('/api/admin/flats/A88');
				for (const spotNumber of ['88', '89']) {
					await page.request.delete(`/api/spots/${spotNumber}`);
				}
				await cleanupMercatoFixtures(page.request);
			});

			test('stranding move is blocked and explained by the warning icon', async ({ page }) => {
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await createMercatoFixtures(page.request);
				await navigateTo(page, '/admin/spots');
				const board = page.getByRole('group', { name: 'Bourse aux places' });
				await expect(board).toBeVisible();
				const lotSearch = board.getByLabel('Rechercher un lot');
				await lotSearch.fill('A86');
				await page.getByRole('option', { name: 'A86' }).click();
				await lotSearch.press('Escape');
				await lotSearch.press('Escape');
				// Picking a lot resets the search: proves the column registered,
				// not just a lingering dropdown option with the same text
				await expect(lotSearch).toHaveValue('');
				await expect(board.getByText('Lot A86')).toBeVisible();

				// 86 is A86's only spot: dragging it out strands the lot
				await boardDrag(page, board, 'Place 86, Lot A86', 'mercato-zone-pending');
				const column = board.getByLabel('Lot A86', { exact: true });
				await expect(column.getByTestId('warning-icon')).toBeVisible();
				await column.getByTestId('warning-icon').hover();
				await expect(page.getByText('Ce lot se retrouverait sans place')).toBeVisible();
				await expect(board.getByRole('button', { name: 'Appliquer' })).toBeDisabled();

				await cleanupMercatoFixtures(page.request);
			});
		});
	});
