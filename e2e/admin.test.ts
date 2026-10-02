import { expect, test } from '@playwright/test';
import { ADMIN_FLAT, ADMIN_PIN, addSpotViaPicker, ensureSpots, login, navigateTo, TEST_SPOT } from './helpers';

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

			test('swap a shared spot to a flat', async ({ page }) => {
				// Login first
				await login(page, ADMIN_FLAT, ADMIN_PIN);

				// Recreate + pool spot 36 via API (previous test deleted it; POST
				// alone would land it unassigned) plus a sacrificial 37 — the
				// swap consumes its spot, and later mosaic tests need 36 shared
				await ensureSpots(page, [TEST_SPOT, '37']);

				await navigateTo(page, '/admin/spots');

				// Open the shared spot chip in the spot drawer
				const spotsCard = page.locator('[data-slot="card"]').filter({ hasText: 'Places de parking' });
				const spotChip = spotsCard.getByRole('button', { name: 'Voir la place 37' });
				await expect(spotChip).toBeVisible();
				await spotChip.click();
				const drawer = page.locator('[role="dialog"]').last();
				await expect(drawer).toBeVisible();

				// Click Échanger in the drawer footer
				await drawer.getByRole('button', { name: 'Échanger' }).click();

				// Swap dialog should open
				const dialog = page.locator('[role="dialog"]').filter({ hasText: 'Échanger la place de parking' });
				await expect(dialog).toBeVisible();

				// Select a flat (A01)
				await dialog.locator('[id="swap-flat"]').selectOption('A01');

				// Confirm swap
				await dialog.getByRole('button', { name: 'Échanger' }).click();

				// Toast confirmation
				await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'échangée' })).toBeVisible();

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

				// Click Réinitialiser le lot (security tab, below the PIN form)
				await detailDialog.getByRole('tab', { name: 'Sécurité' }).click();
				await detailDialog.getByRole('button', { name: 'Réinitialiser le lot' }).click();

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

				// Flat B05 should now appear in flats list as active
				const flatCard = page.locator('div.rounded-md.border').filter({ hasText: 'B05' }).first();
				await expect(flatCard).toBeVisible();
				await expect(flatCard.getByText('Actif')).toBeVisible();

				// Step 3: Submit another request for a different flat, then reject it
				// Logout first
				await page.request.post('/api/auth/logout', {
					headers: {
						Cookie: (await page.context().cookies()).find((c) => c.name === 'session')
							? `session=${(await page.context().cookies()).find((c) => c.name === 'session')?.value}`
							: ''
					}
				});
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

			test('flags conflicting spots in request detail', async ({ page }) => {
				// Hermetic fixture: bind spot 61 to B06 via approval, then request it for B07
				// Spot 61 must exist before it can be claimed (admin pre-creates)
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await ensureSpots(page, ['61']);
				await page.context().clearCookies();

				async function submitRequest(flatNumber: string, email: string, phone: string) {
					await navigateTo(page, '/request');
					await page.getByPlaceholder('ex. B12').fill(flatNumber);
					await page.getByPlaceholder('ex. B12').press('Enter');
					await addSpotViaPicker(page, page, '61');
					await page.getByRole('button', { name: 'Ajouter un e-mail' }).click();
					await page.locator('input[type="email"]').fill(email);
					await page.keyboard.press('Enter');
					await page.getByRole('button', { name: 'Ajouter un téléphone' }).click();
					await page.locator('input[type="tel"]').fill(phone);
					await page.keyboard.press('Enter');
					await page.getByRole('button', { name: 'Envoyer la demande' }).click();
					await expect(page.getByText('Demande envoyée')).toBeVisible({ timeout: 5000 });
				}

				await page.context().clearCookies();
				await submitRequest('B06', 'b06@test.com', '+33612345610');

				// Approve B06 → spot 61 is now bound to B06
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await navigateTo(page, '/admin/lots');
				const b06Row = page.locator('div.rounded-md.border.border-dashed').filter({ hasText: 'B06' });
				await expect(b06Row).toBeVisible({ timeout: 5000 });
				await b06Row.getByRole('button', { name: 'Approuver' }).click();
				await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'approuvé' })).toBeVisible();
				await expect(b06Row).not.toBeVisible({ timeout: 5000 });

				// Request the same spot for B07 as an anonymous user again
				await page.request.post('/api/auth/logout', {
					headers: {
						Cookie: (await page.context().cookies()).find((c) => c.name === 'session')
							? `session=${(await page.context().cookies()).find((c) => c.name === 'session')?.value}`
							: ''
					}
				});
				await page.context().clearCookies();
				await submitRequest('B07', 'b07@test.com', '+33612345611');

				// Open the conflicting request detail — the spot card carries the warning
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await navigateTo(page, '/admin/lots');
				const conflictRow = page.locator('div.rounded-md.border.border-dashed').filter({ hasText: 'B07' });
				await expect(conflictRow).toBeVisible({ timeout: 5000 });
				await conflictRow.getByRole('button', { name: 'Voir détails' }).click();
				const detailDialog = page.locator('[role="dialog"]').filter({ hasText: 'Demande' });
				await expect(detailDialog).toBeVisible({ timeout: 5000 });
				await expect(detailDialog.getByText('Conflit : attribuée à B06').first()).toBeVisible({ timeout: 5000 });
				await page.keyboard.press('Escape');
			});

			test('add-lot picker warns on bound spots instead of rejecting', async ({ page }) => {
				// Hermetic fixture: bind spot 62 to B08 via approval (spot pre-created: claims need existing spots)
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await ensureSpots(page, ['62', '64']);
				await page.context().clearCookies();
				await navigateTo(page, '/request');
				await page.getByPlaceholder('ex. B12').fill('B08');
				await page.getByPlaceholder('ex. B12').press('Enter');
				await addSpotViaPicker(page, page, '62');
				await page.getByRole('button', { name: 'Ajouter un e-mail' }).click();
				await page.locator('input[type="email"]').fill('b08@test.com');
				await page.keyboard.press('Enter');
				await page.getByRole('button', { name: 'Ajouter un téléphone' }).click();
				await page.locator('input[type="tel"]').fill('+33612345612');
				await page.keyboard.press('Enter');
				await page.getByRole('button', { name: 'Envoyer la demande' }).click();
				await expect(page.getByText('Demande envoyée')).toBeVisible({ timeout: 5000 });

				// Approve B08 → spot 62 is now bound to B08
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await navigateTo(page, '/admin/lots');
				const b08Row = page.locator('div.rounded-md.border.border-dashed').filter({ hasText: 'B08' });
				await expect(b08Row).toBeVisible({ timeout: 5000 });
				await b08Row.getByRole('button', { name: 'Approuver' }).click();
				await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'approuvé' })).toBeVisible();
				await expect(b08Row).not.toBeVisible({ timeout: 5000 });

				// Open the add-lot dialog: bound 62 selects with warning, submit blocked until resolved
				// (64 was pre-created shared via ensureSpots — pickable, no conflict)
				const lotsCard = page.locator('[data-slot="card"]').filter({ hasText: 'Gérez les lots' });
				await lotsCard.getByRole('button', { name: 'Ajouter', exact: true }).click();
				const createDialog = page.locator('[role="dialog"]').filter({ hasText: 'Ajouter un lot' });
				await expect(createDialog).toBeVisible({ timeout: 5000 });
				// Bound 62 stages with warning via picker (helper expands Toutes + overflow)
				await addSpotViaPicker(page, createDialog, '62');
				// No inline rejection — spot drafts with warning, solve button appears
				await expect(page.getByText('Déjà attribuée')).toHaveCount(0);
				await expect(createDialog.getByRole('button', { name: /Résoudre les conflits/ })).toBeVisible();
				const submitBtn = createDialog.getByRole('button', { name: 'Ajouter', exact: true });
				await expect(submitBtn).toBeDisabled();
				await page.keyboard.press('Escape');
			});

			test('picker toggles between Libres and Toutes', async ({ page }) => {
				// Serial fixtures by now: 61 + 62 bound, 64 shared — plus unassigned spots
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await navigateTo(page, '/admin/lots');
				const lotsCard = page.locator('[data-slot="card"]').filter({ hasText: 'Gérez les lots' });
				await lotsCard.getByRole('button', { name: 'Ajouter', exact: true }).click();
				const createDialog = page.locator('[role="dialog"]').filter({ hasText: 'Ajouter un lot' });
				await expect(createDialog).toBeVisible({ timeout: 5000 });
				await createDialog.getByRole('button', { name: 'Ajouter une place' }).click();
				// Default Libres view: bound spots hidden (toggle off)
				await expect(page.getByRole('tab', { name: 'Toutes' })).toBeVisible();
				await expect(page.getByRole('button', { name: /Place 62/ })).toHaveCount(0);
				// Toggle Toutes → full ordered grid, bound chips appear with warning
				await page.getByRole('tab', { name: 'Toutes' }).click();
				const moreBtn = page.getByRole('button', { name: /Afficher plus/ });
				if ((await moreBtn.count()) > 0) await moreBtn.first().click();
				await expect(page.getByRole('button', { name: /Place 62.*sélectionner/ })).toBeVisible();
				// Toggle back to Libres → bound hidden again
				await page.getByRole('tab', { name: 'Libres' }).click();
				await expect(page.getByRole('button', { name: /Place 62/ })).toHaveCount(0);
				await page.keyboard.press('Escape');
			});

			test('strand spots resolve as blocked in the conflict dialog', async ({ page }) => {
				// Hermetic fixture: bind sole spot 66 to B10 via approval (spot pre-created)
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await ensureSpots(page, ['66']);
				await page.context().clearCookies();
				await navigateTo(page, '/request');
				await page.getByPlaceholder('ex. B12').fill('B10');
				await page.getByPlaceholder('ex. B12').press('Enter');
				await addSpotViaPicker(page, page, '66');
				await page.getByRole('button', { name: 'Ajouter un e-mail' }).click();
				await page.locator('input[type="email"]').fill('b10@test.com');
				await page.keyboard.press('Enter');
				await page.getByRole('button', { name: 'Ajouter un téléphone' }).click();
				await page.locator('input[type="tel"]').fill('+33612345613');
				await page.keyboard.press('Enter');
				await page.getByRole('button', { name: 'Envoyer la demande' }).click();
				await expect(page.getByText('Demande envoyée')).toBeVisible({ timeout: 5000 });

				// Approve B10 → spot 66 is B10's only spot
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await navigateTo(page, '/admin/lots');
				const b10Row = page.locator('div.rounded-md.border.border-dashed').filter({ hasText: 'B10' });
				await expect(b10Row).toBeVisible({ timeout: 5000 });
				await b10Row.getByRole('button', { name: 'Approuver' }).click();
				await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'approuvé' })).toBeVisible();
				await expect(b10Row).not.toBeVisible({ timeout: 5000 });

				// A01's drawer → bound 66 selects with warning (no longer locked)…
				const flatCard = page.locator('div.rounded-md.border').filter({ hasText: 'A01' }).first();
				await flatCard.getByRole('button', { name: 'Voir détails' }).click();
				const detailDialog = page.locator('[role="dialog"]').filter({ hasText: 'Sécurité' });
				await expect(detailDialog).toBeVisible({ timeout: 5000 });
				await addSpotViaPicker(page, detailDialog, '66');
				// …commit opens the resolver with a strand-blocked row
				const resolver = page.locator('[role="alertdialog"]');
				await expect(resolver).toBeVisible({ timeout: 5000 });
				await expect(resolver.getByText(/Impossible : le lot B10 n'aurait plus de place/)).toBeVisible();
				// Conserver auto-selected, counter honest at 1/1 — applying drops the spot
				await expect(resolver.getByRole('button', { name: /Appliquer \(1\/1\)/ })).toBeEnabled();
				await resolver.getByRole('button', { name: /Appliquer \(1\/1\)/ }).click();
				await expect(resolver).not.toBeVisible({ timeout: 5000 });
				await page.keyboard.press('Escape');
			});

			test('mixed conflicts resolve per row in approval flow', async ({ page }) => {
				// Hermetic fixtures: B11 holds 67+68 (movable), B12 holds only 69 (strand) — spots pre-created
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await ensureSpots(page, ['67', '68', '69']);
				await page.context().clearCookies();

				async function requestAndApprove(flat: string, spots: string[], email: string, phone: string) {
					await page.context().clearCookies();
					await navigateTo(page, '/request');
					await page.getByPlaceholder('ex. B12').fill(flat);
					await page.getByPlaceholder('ex. B12').press('Enter');
					for (const s of spots) {
						await addSpotViaPicker(page, s);
					}
					await page.getByRole('button', { name: 'Ajouter un e-mail' }).click();
					await page.locator('input[type="email"]').fill(email);
					await page.keyboard.press('Enter');
					await page.getByRole('button', { name: 'Ajouter un téléphone' }).click();
					await page.locator('input[type="tel"]').fill(phone);
					await page.keyboard.press('Enter');
					await page.getByRole('button', { name: 'Envoyer la demande' }).click();
					await expect(page.getByText('Demande envoyée')).toBeVisible({ timeout: 5000 });

					await login(page, ADMIN_FLAT, ADMIN_PIN);
					await navigateTo(page, '/admin/lots');
					const row = page.locator('div.rounded-md.border.border-dashed').filter({ hasText: flat });
					await expect(row).toBeVisible({ timeout: 5000 });
					await row.getByRole('button', { name: 'Approuver' }).click();
					await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'approuvé' })).toBeVisible();
					await expect(row).not.toBeVisible({ timeout: 5000 });
				}

				await requestAndApprove('B14', ['67', '68'], 'b14@test.com', '+33612345614');
				await requestAndApprove('B15', ['69'], 'b15@test.com', '+33612345615');

				// B16 requests the movable spot 67 and the strand spot 69
				await page.context().clearCookies();
				await navigateTo(page, '/request');
				await page.getByPlaceholder('ex. B12').fill('B16');
				await page.getByPlaceholder('ex. B12').press('Enter');
				for (const s of ['67', '69']) {
					await addSpotViaPicker(page, s);
				}
				await page.getByRole('button', { name: 'Ajouter un e-mail' }).click();
				await page.locator('input[type="email"]').fill('b16@test.com');
				await page.keyboard.press('Enter');
				await page.getByRole('button', { name: 'Ajouter un téléphone' }).click();
				await page.locator('input[type="tel"]').fill('+33612345616');
				await page.keyboard.press('Enter');
				await page.getByRole('button', { name: 'Envoyer la demande' }).click();
				await expect(page.getByText('Demande envoyée')).toBeVisible({ timeout: 5000 });

				// Approve → merged dialog: side-by-side picks, no default, Appliquer gated
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await navigateTo(page, '/admin/lots');
				const b16Row = page.locator('div.rounded-md.border.border-dashed').filter({ hasText: 'B16' });
				await expect(b16Row).toBeVisible({ timeout: 5000 });
				await b16Row.getByRole('button', { name: 'Approuver' }).click();
				const conflictModal = page.locator('[role="alertdialog"]');
				await expect(conflictModal).toBeVisible({ timeout: 5000 });
				await expect(conflictModal.getByRole('heading', { name: 'Places déjà attribuées' })).toBeVisible();

				const movableRow = conflictModal.locator('fieldset').filter({ hasText: 'Résolution pour la place 67' });
				const blockedRow = conflictModal.locator('fieldset').filter({ hasText: 'Résolution pour la place 69' });
				await expect(movableRow.getByRole('radio')).toHaveCount(2);
				await expect(blockedRow.getByRole('radio')).toHaveCount(1);
				await expect(blockedRow.getByText(/Impossible : le lot B15 n'aurait plus de place/)).toBeVisible();

				// Blocked auto-picks Conserver → counter starts at 1/2, movable still unpicked
				await expect(conflictModal.getByRole('button', { name: /Appliquer \(1\/2\)/ })).toBeDisabled();

				// Pick the Lot B16 card on the movable row → counter honest at 2/2
				await movableRow.getByText('Affecter', { exact: true }).click();
				await expect(conflictModal.getByRole('button', { name: /Appliquer \(2\/2\)/ })).toBeEnabled();

				// Apply → row-initiated approval auto-commits: dialog closes, B16
				// approved (67 moved off B14, strand 69 stays with B15)
				await conflictModal.getByRole('button', { name: /Appliquer \(2\/2\)/ }).click();
				await expect(conflictModal).not.toBeVisible({ timeout: 5000 });
				await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'approuvé' })).toBeVisible();
				await expect(b16Row).not.toBeVisible({ timeout: 10000 });

				// B16 flat exists holding the moved spot; B15 keeps its strand spot
				// (search surfaces it — the new flat sorts past page 1)
				await page.getByPlaceholder('Rechercher...').fill('B16');
				const b16Flat = page.locator('div.rounded-md.border').filter({ hasText: 'B16' }).first();
				await expect(b16Flat).toBeVisible({ timeout: 10000 });
				await b16Flat.getByRole('button', { name: 'Voir détails' }).click();
				const b16Detail = page.locator('[role="dialog"]').filter({ hasText: 'Sécurité' });
				await expect(b16Detail).toBeVisible({ timeout: 5000 });
				await expect(b16Detail.getByText('67', { exact: true })).toBeVisible();
				await page.keyboard.press('Escape');
				await expect(b16Detail).not.toBeVisible({ timeout: 10000 });
				// Clear the search so later lots-page tests see the full list
				await page.getByPlaceholder('Rechercher...').fill('');
				await expect(page).not.toHaveURL(/q=B16/, { timeout: 10000 });
			});

			test('create only selects existing spots', async ({ page }) => {
				// Hermetic fixture: B20 holds only spot 80 (spot pre-created)
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await ensureSpots(page, ['80']);
				await page.context().clearCookies();
				await navigateTo(page, '/request');
				await page.getByPlaceholder('ex. B12').fill('B20');
				await page.getByPlaceholder('ex. B12').press('Enter');
				await addSpotViaPicker(page, page, '80');
				await page.getByRole('button', { name: 'Ajouter un e-mail' }).click();
				await page.locator('input[type="email"]').fill('b20@test.com');
				await page.keyboard.press('Enter');
				await page.getByRole('button', { name: 'Ajouter un téléphone' }).click();
				await page.locator('input[type="tel"]').fill('+33612345617');
				await page.keyboard.press('Enter');
				await page.getByRole('button', { name: 'Envoyer la demande' }).click();
				await expect(page.getByText('Demande envoyée')).toBeVisible({ timeout: 5000 });

				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await navigateTo(page, '/admin/lots');
				const b20Row = page.locator('div.rounded-md.border.border-dashed').filter({ hasText: 'B20' });
				await expect(b20Row).toBeVisible({ timeout: 5000 });
				await b20Row.getByRole('button', { name: 'Approuver' }).click();
				await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'approuvé' })).toBeVisible();
				await expect(b20Row).not.toBeVisible({ timeout: 5000 });

				// Draft B21: unknown 81 is refused with a hint, bound 80 with a note — nothing drafted
				const lotsCard = page.locator('[data-slot="card"]').filter({ hasText: 'Gérez les lots' });
				await lotsCard.getByRole('button', { name: 'Ajouter', exact: true }).click();
				const createDialog = page.locator('[role="dialog"]').filter({ hasText: 'Ajouter un lot' });
				await expect(createDialog).toBeVisible({ timeout: 5000 });
				await createDialog.getByPlaceholder('ex. B12').fill('B21');
				await createDialog.getByPlaceholder('ex. B12').press('Enter');
				await createDialog.getByRole('button', { name: 'Ajouter un e-mail' }).click();
				await createDialog.locator('input[type="email"]').fill('b21@test.com');
				await page.keyboard.press('Enter');
				await createDialog.getByRole('button', { name: 'Ajouter un téléphone' }).click();
				await createDialog.locator('input[type="tel"]').fill('+33612345618');
				await page.keyboard.press('Enter');
				await createDialog.getByRole('button', { name: 'Ajouter une place' }).click();
				await page.getByPlaceholder('N°').fill('81');
				await page.getByPlaceholder('N°').press('Enter');
				await expect(page.getByText(/inexistante/)).toBeVisible({ timeout: 5000 });
				await page.keyboard.press('Escape');
				// Bound 80 selects with warning badge instead of inline rejection…
				await createDialog.getByRole('button', { name: 'Ajouter une place' }).click();
				await page.getByRole('tab', { name: 'Toutes' }).click();
				const moreBtn = page.getByRole('button', { name: /Afficher plus/ });
				if ((await moreBtn.count()) > 0) await moreBtn.first().click();
				await page.getByRole('button', { name: /Place 80,/ }).click();
				await expect(page.getByText('Déjà attribuée')).toHaveCount(0);
				await expect(createDialog.getByRole('button', { name: /Résoudre les conflits/ })).toBeVisible();
				// …submit routes to the resolver instead of creating while conflicts are undecided
				const submitBtn = createDialog.getByRole('button', { name: 'Ajouter', exact: true });
				await submitBtn.click();
				const createResolver = page.locator('[role="alertdialog"]');
				await expect(createResolver).toBeVisible({ timeout: 5000 });
				await page.keyboard.press('Escape');
				await expect(createResolver).not.toBeVisible({ timeout: 10000 });
				await page.keyboard.press('Escape');
				await expect(page.locator('div.rounded-md.border').filter({ hasText: 'B21' })).toHaveCount(0);
			});

			test('inactive lots are editable like other statuses', async ({ page }) => {
				// Preamble: shared 77 pre-created (claims/adds need existing spots)
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await ensureSpots(page, ['77']);
				await navigateTo(page, '/admin/lots');

				// B05 (inactive, approved earlier) opens with full edit affordances
				await page.getByPlaceholder('Rechercher...').fill('B05');
				const flatCard = page.locator('div.rounded-md.border').filter({ hasText: 'B05' }).first();
				await flatCard.getByRole('button', { name: 'Voir détails' }).click();
				const detailDialog = page.locator('[role="dialog"]').filter({ hasText: 'Sécurité' });
				await expect(detailDialog).toBeVisible({ timeout: 5000 });
				// Nameless → Ajouter (becomes Modifier once set)
				await expect(detailDialog.getByRole('button', { name: 'Ajouter un nom' }).first()).toBeVisible();
				await expect(detailDialog.getByRole('button', { name: 'Ajouter une place' })).toBeVisible();

				// Add a spot through the picker (77 is shared → Toutes view) —
				// shared-pool picks open the pool resolver for confirmation
				await detailDialog.getByRole('button', { name: 'Ajouter une place' }).click();
				await page.getByRole('tab', { name: 'Toutes' }).click();
				const more77 = page.getByRole('button', { name: /Afficher plus/ });
				if ((await more77.count()) > 0) await more77.first().click();
				await page.getByRole('button', { name: /Place 77,/ }).click();
				const poolResolver = page.locator('[role="alertdialog"]');
				await expect(poolResolver).toBeVisible({ timeout: 5000 });
				await poolResolver.getByText('Affecter', { exact: true }).click();
				await poolResolver.getByRole('button', { name: /Appliquer \(1\/1\)/ }).click();
				await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'mises à jour' })).toBeVisible();

				// Edit the name, then Modifier replaces Ajouter
				await detailDialog.getByRole('button', { name: 'Ajouter un nom' }).first().click();
				await detailDialog.getByPlaceholder('ex. Jean, Famille Dupont').fill('Résident B05');
				await detailDialog.getByRole('button', { name: 'Valider' }).click();
				await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'mis à jour' })).toBeVisible();
				await expect(detailDialog.getByRole('button', { name: 'Modifier le nom' })).toBeVisible();
				await page.keyboard.press('Escape');
			});

			test('delete refuses to strand a sole-held spot', async ({ page }) => {
				// Hermetic fixture: B22 holds only spot 82 (spot pre-created)
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await ensureSpots(page, ['82']);
				await page.context().clearCookies();
				await navigateTo(page, '/request');
				await page.getByPlaceholder('ex. B12').fill('B22');
				await page.getByPlaceholder('ex. B12').press('Enter');
				await addSpotViaPicker(page, page, '82');
				await page.getByRole('button', { name: 'Ajouter un e-mail' }).click();
				await page.locator('input[type="email"]').fill('b22@test.com');
				await page.keyboard.press('Enter');
				await page.getByRole('button', { name: 'Ajouter un téléphone' }).click();
				await page.locator('input[type="tel"]').fill('+33612345619');
				await page.keyboard.press('Enter');
				await page.getByRole('button', { name: 'Envoyer la demande' }).click();
				await expect(page.getByText('Demande envoyée')).toBeVisible({ timeout: 5000 });

				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await navigateTo(page, '/admin/lots');
				const b22Row = page.locator('div.rounded-md.border.border-dashed').filter({ hasText: 'B22' });
				await expect(b22Row).toBeVisible({ timeout: 5000 });
				await b22Row.getByRole('button', { name: 'Approuver' }).click();
				await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'approuvé' })).toBeVisible();
				await expect(b22Row).not.toBeVisible({ timeout: 5000 });

				// No UI path deletes bound spots — assert the API invariant directly
				const res = await page.request.delete('/api/spots/82');
				expect(res.status()).toBe(409);
				expect((await res.json()).error).toMatch(/n'aurait plus de place/);

				// Spot intact: B22 still holds 82 (search past pagination)
				// (navigateTo, not reload: the search fill must not race hydration)
				await navigateTo(page, '/admin/lots');
				await page.getByPlaceholder('Rechercher...').fill('B22');
				const flatCard = page.locator('div.rounded-md.border').filter({ hasText: 'B22' }).first();
				await flatCard.getByRole('button', { name: 'Voir détails' }).click();
				const detailDialog = page.locator('[role="dialog"]').filter({ hasText: 'Sécurité' });
				await expect(detailDialog).toBeVisible({ timeout: 5000 });
				await expect(detailDialog.getByText('82').first()).toBeVisible();
				await page.keyboard.press('Escape');
			});

			test('request refuses unknown spots', async ({ page }) => {
				// Spot 51 was never created — the constrained picker refuses it
				// inline, so it never stages into the draft and nothing is sent
				await page.context().clearCookies();
				await navigateTo(page, '/request');
				await page.getByPlaceholder('ex. B12').fill('B23');
				await page.getByPlaceholder('ex. B12').press('Enter');
				await page.getByRole('button', { name: 'Ajouter une place' }).click();
				await page.getByPlaceholder('N°').fill('51');
				await page.getByPlaceholder('N°').press('Enter');
				await expect(page.getByText(/inexistante/)).toBeVisible({ timeout: 5000 });
				await page.keyboard.press('Escape');
				await expect(page.getByRole('button', { name: 'Supprimer la place 51' })).toHaveCount(0);
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await navigateTo(page, '/admin/lots');
				await expect(page.locator('div.rounded-md.border.border-dashed').filter({ hasText: 'B23' })).toHaveCount(0);
			});

			test('admin sections live on separate routes', async ({ page }) => {
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await navigateTo(page, '/admin/lots');
				const lotsCard = page.locator('[data-slot="card"]').filter({ hasText: 'Gérez les lots' });
				const spotsCard = page.locator('[data-slot="card"]').filter({ hasText: 'Places de parking' });

				// Lots route: lots visible, spots absent (separate documents)
				await expect(lotsCard).toBeVisible();
				await expect(spotsCard).toHaveCount(0);
				await expect(page.getByRole('link', { name: 'Lots', exact: true })).toHaveAttribute('aria-current', 'page');

				await navigateTo(page, '/admin/spots');
				await expect(spotsCard).toBeVisible();
				await expect(lotsCard).toHaveCount(0);
				await expect(page.getByRole('link', { name: 'Places', exact: true })).toHaveAttribute('aria-current', 'page');

				// Legacy /admin redirects to lots
				await navigateTo(page, '/admin');
				await expect(page).toHaveURL(/\/admin\/lots/);
				await expect(lotsCard).toBeVisible();
			});

			test('bound mosaic opens the spot drawer', async ({ page }) => {
				// B22 still holds 82 (strand fixture never moves)
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await navigateTo(page, '/admin/spots');
				const spotsCard = page.locator('[data-slot="card"]').filter({ hasText: 'Places de parking' });
				await spotsCard.getByRole('button', { name: /Attribuées/ }).click();
				await expect(spotsCard).toBeVisible({ timeout: 5000 });
				// 82 sorts past page 1 — search surfaces it
				await spotsCard.getByPlaceholder('Rechercher une place…').fill('82');
				await spotsCard.getByRole('button', { name: /Voir la place 82/ }).click();

				// Spot drawer with Assignée badge, holder, and no pool/park actions
				const drawer = page.locator('[role="dialog"]').last();
				await expect(drawer).toBeVisible({ timeout: 5000 });
				await expect(drawer.getByText('Assignée', { exact: true })).toBeVisible();
				const lotLink = drawer.getByRole('link', { name: /B22/ });
				await expect(lotLink).toBeVisible();
				await expect(drawer.getByRole('button', { name: 'Mettre en commun' })).toHaveCount(0);
				await expect(drawer.getByRole('button', { name: 'Retirer du pool' })).toHaveCount(0);
				await page.keyboard.press('Escape');
			});

			test('created spots land unassigned and pool on demand', async ({ page }) => {
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await navigateTo(page, '/admin/spots');
				const spotsCard = page.locator('[data-slot="card"]').filter({ hasText: 'Places de parking' });
				const limboPill = spotsCard.getByRole('button', { name: /En attente/ });
				const sharedPill = spotsCard.getByRole('button', { name: /Partagées/ });
				const spot83 = spotsCard.getByRole('button', { name: /Voir la place 83/ });

				// Main button creates 83 straight into limbo (not the shared filter)
				await page.request.post('/api/spots', { data: { number: '83' } });
				await page.reload();
				await limboPill.click();
				await expect(spot83).toBeVisible({ timeout: 5000 });
				// Exclusive shared view: deselect limbo first (pills union otherwise)
				await limboPill.click();
				await sharedPill.click();
				await expect(spot83).toHaveCount(0);

				// Pool it from the spot drawer
				await limboPill.click();
				await spot83.click();
				const spotDrawer = page.locator('[role="dialog"]').last();
				await expect(spotDrawer).toBeVisible();
				await expect(spotDrawer.getByText('En attente', { exact: true })).toBeVisible();
				await spotDrawer.getByRole('button', { name: 'Mettre en commun' }).click();
				await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'mise en commun' })).toBeVisible();
				await page.keyboard.press('Escape');
				await sharedPill.click();
				await expect(spot83).toBeVisible({ timeout: 5000 });

				// Park it back to limbo
				await spot83.click();
				await expect(spotDrawer).toBeVisible();
				await spotDrawer.getByRole('button', { name: 'Retirer du pool' }).click();
				await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'retirée du pool' })).toBeVisible();
				await page.keyboard.press('Escape');
				// Exclusive limbo view again: deselect shared (union still holds it)
				await sharedPill.click();
				await expect(spot83).toBeVisible({ timeout: 5000 });
			});

			test('picker lists limbo spots as first-hand picks', async ({ page }) => {
				// 84 exists but waits in limbo (created, never pooled)
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await page.request.post('/api/spots', { data: { number: '84' } });
				await navigateTo(page, '/admin/lots');
				const lotsCard = page.locator('[data-slot="card"]').filter({ hasText: 'Gérez les lots' });
				await lotsCard.getByRole('button', { name: 'Ajouter', exact: true }).click();
				const createDialog = page.locator('[role="dialog"]').filter({ hasText: 'Ajouter un lot' });
				await expect(createDialog).toBeVisible({ timeout: 5000 });
				await createDialog.getByRole('button', { name: 'Ajouter une place' }).click();

				// Limbo 84 listed by default (Libres view) with no warning…
				await expect(page.getByRole('button', { name: 'Choisir la place 84', exact: true })).toBeVisible();
				// …and selects cleanly with no conflict
				await page.getByRole('button', { name: 'Choisir la place 84', exact: true }).click();
				await expect(createDialog.getByText(/Conflit/)).toHaveCount(0);
				await expect(createDialog.getByRole('button', { name: /Résoudre les conflits/ })).toHaveCount(0);
				await page.keyboard.press('Escape');
			});

			test('mosaic chips carry lifecycle status frames', async ({ page }) => {
				// Fixtures by now: 36 shared (setup), 84 limbo (previous test), 82 bound to B22
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await navigateTo(page, '/admin/spots');
				const spotsCard = page.locator('[data-slot="card"]').filter({ hasText: 'Places de parking' });
				const sharedPill = spotsCard.getByRole('button', { name: /Partagées/ });
				const assignedPill = spotsCard.getByRole('button', { name: /Attribuées/ });
				const limboPill = spotsCard.getByRole('button', { name: /En attente/ });

				// Default filter is shared-selected
				const shared36 = spotsCard.getByRole('button', { name: /Voir la place 36/ });
				await expect(shared36).toHaveAttribute('data-status', 'shared');
				await expect(shared36.getByText('Partagée', { exact: true })).toHaveClass(/bg-primary/);

				// Exclusive limbo: deselect shared, select limbo
				await sharedPill.click();
				await limboPill.click();
				const limbo84 = spotsCard.getByRole('button', { name: /Voir la place 84/ });
				await expect(limbo84).toHaveAttribute('data-status', 'unassigned');
				await expect(limbo84.getByText('En attente', { exact: true })).toHaveClass(/bg-warning/);

				// Exclusive assigned: deselect limbo, select assigned
				await limboPill.click();
				await assignedPill.click();
				const bound82 = spotsCard.getByRole('button', { name: /Voir la place 82/ });
				await expect(bound82).not.toHaveAttribute('data-status', 'assigned');
				await expect(bound82.getByText('B22', { exact: true })).toHaveClass(/bg-muted-foreground/);
			});

			test('spots filter unions, searches, and clears', async ({ page }) => {
				// Fixtures by now: 36 shared, 82 bound to B22, 83 + 84 limbo
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await navigateTo(page, '/admin/spots');
				const spotsCard = page.locator('[data-slot="card"]').filter({ hasText: 'Places de parking' });
				const chip36 = spotsCard.getByRole('button', { name: /Voir la place 36/ });
				const chip82 = spotsCard.getByRole('button', { name: /Voir la place 82/ });
				const chip83 = spotsCard.getByRole('button', { name: /Voir la place 83/ });

				// Default: shared-selected — 36 visible, others hidden
				await expect(chip36).toBeVisible({ timeout: 5000 });
				await expect(chip82).toHaveCount(0);
				await expect(chip83).toHaveCount(0);

				// Union: add limbo — both present, bound still absent
				await spotsCard.getByRole('button', { name: /En attente/ }).click();
				await expect(chip36).toBeVisible();
				await expect(chip83).toBeVisible();
				await expect(chip82).toHaveCount(0);

				// Search narrows within the union (holder match finds bound 82 only after selecting it…
				await spotsCard.getByPlaceholder('Rechercher une place…').fill('B22');
				await expect(chip82).toHaveCount(0);
				await spotsCard.getByRole('button', { name: /Attribuées/ }).click();
				await expect(chip82).toBeVisible({ timeout: 5000 });
				await expect(chip36).toHaveCount(0);

				// …and zero selected shows everything across pages (no filter = no filtering)
				await spotsCard.getByPlaceholder('Rechercher une place…').fill('');
				for (const name of [/Partagées/, /Attribuées/, /En attente/]) {
					await spotsCard.getByRole('button', { name }).click();
				}
				await expect(chip36).toBeVisible({ timeout: 5000 });
				// 82 + 83 sort past page 1 (15 per page)
				await spotsCard.getByRole('button', { name: 'Suivant' }).click();
				await expect(spotsCard.getByRole('button', { name: /Voir la place 82/ })).toBeVisible();
				await expect(spotsCard.getByRole('button', { name: /Voir la place 83/ })).toBeVisible();
				await expect(spotsCard.getByText('Aucune place pour ces critères.')).toHaveCount(0);
			});

			test('spots mosaic paginates at 15 per page', async ({ page }) => {
				// Zero-filter inventory already exceeds one page — page through 15 at a time
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await navigateTo(page, '/admin/spots');
				const spotsCard = page.locator('[data-slot="card"]').filter({ hasText: 'Places de parking' });

				// Zero filter: deselect shared → first 15, add cell on both pages
				await spotsCard.getByRole('button', { name: /Partagées/ }).click();
				await expect(spotsCard.getByRole('button', { name: /Voir la place/ })).toHaveCount(15);
				await expect(spotsCard.getByText('Page 1/2')).toBeVisible();
				await expect(spotsCard.getByRole('button', { name: 'Ajouter une place' })).toBeVisible();

				await spotsCard.getByRole('button', { name: 'Suivant' }).click();
				await expect(spotsCard.getByText('Page 2/2')).toBeVisible();
				expect(await spotsCard.getByRole('button', { name: /Voir la place/ }).count()).toBeGreaterThan(0);
				await expect(spotsCard.getByRole('button', { name: 'Ajouter une place' })).toBeVisible();

				await spotsCard.getByRole('button', { name: 'Précédent' }).click();
				await expect(spotsCard.getByText('Page 1/2')).toBeVisible();
			});

			test('spot drawer shows attachment and solid status', async ({ page }) => {
				// Fixtures by now: 36 shared, 82 bound to B22, 83 limbo
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await navigateTo(page, '/admin/spots');
				const spotsCard = page.locator('[data-slot="card"]').filter({ hasText: 'Places de parking' });
				const drawer = page.locator('[role="dialog"]').last();

				// Assigned 82: Lot link + solid neutral badge (search past pagination)
				await spotsCard.getByRole('button', { name: /Attribuées/ }).click();
				await spotsCard.getByPlaceholder('Rechercher une place…').fill('82');
				await spotsCard.getByRole('button', { name: /Voir la place 82/ }).click();
				await expect(drawer).toBeVisible({ timeout: 5000 });
				const lotLink = drawer.getByRole('link', { name: /B22/ });
				await expect(lotLink).toHaveAttribute('href', '/admin/lots?q=B22');
				await expect(drawer.getByText('Assignée', { exact: true })).toHaveClass(/bg-muted-foreground/);
				// Holder link lands on the filtered lots page
				await lotLink.click();
				await expect(page).toHaveURL(/\/admin\/lots\?q=B22/);
				await expect(page.getByPlaceholder('Rechercher...')).toHaveValue('B22');

				// Shared 36: pool line + solid blue badge
				await navigateTo(page, '/admin/spots');
				await spotsCard.getByRole('button', { name: /Voir la place 36/ }).click();
				await expect(drawer).toBeVisible({ timeout: 5000 });
				await expect(drawer.getByText(/réservable par tous/)).toBeVisible();
				await expect(drawer.getByText('Partagée', { exact: true })).toHaveClass(/bg-primary/);
				await page.keyboard.press('Escape');

				// Limbo 83: waiting line + solid yellow badge (search past pagination)
				await spotsCard.getByRole('button', { name: /En attente/ }).click();
				await spotsCard.getByPlaceholder('Rechercher une place…').fill('83');
				await spotsCard.getByRole('button', { name: /Voir la place 83/ }).click();
				await expect(drawer).toBeVisible({ timeout: 5000 });
				await expect(drawer.getByText(/En attente d'affectation/)).toBeVisible();
				await expect(drawer.getByText('En attente', { exact: true })).toHaveClass(/bg-warning/);
				await page.keyboard.press('Escape');
			});
		});
	});
