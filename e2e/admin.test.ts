import { expect, test } from '@playwright/test';
import { ADMIN_FLAT, ADMIN_PIN, login, navigateTo, TEST_SPOT } from './helpers';

test.describe
	.serial('Admin management', () => {
		test.describe('Shared parking spots', () => {
			test('edit spot description', async ({ page }) => {
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await navigateTo(page, '/admin');

				// Find the shared spot row (spot 36)
				const spotRow = page.locator('div.rounded-md.border').filter({ hasText: TEST_SPOT }).first();
				await expect(spotRow).toBeVisible();

				// Click the pencil icon (first button in the row)
				const editBtn = spotRow.locator('button').first();
				await editBtn.click();

				// Edit spot dialog should open
				const dialog = page.locator('[role="dialog"]').filter({ hasText: 'Modifier la place de parking' });
				await expect(dialog).toBeVisible();

				// Fill description
				await dialog.locator('[id="edit-spot-desc"]').fill('Place near elevator');

				// Save
				await dialog.getByRole('button', { name: 'Enregistrer' }).click();

				// Toast confirmation
				await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'mise à jour' })).toBeVisible();

				// Description should be visible in the spot row
				await expect(spotRow.getByText('Place near elevator')).toBeVisible();
			});

			test('delete a shared spot', async ({ page }) => {
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await navigateTo(page, '/admin');

				// Find the shared spot row — after previous test, spot 36 still exists (edit doesn't delete it)
				const spotRow = page.locator('div.rounded-md.border').filter({ hasText: TEST_SPOT }).first();
				await expect(spotRow).toBeVisible();

				// Click the trash icon (last icon button in the row)
				const trashBtn = spotRow.getByRole('button', { name: 'Supprimer' });
				await trashBtn.click();

				// AlertDialog should open
				const alertDialog = page.locator('[role="alertdialog"]');
				await expect(alertDialog).toBeVisible();

				// Confirm deletion
				await alertDialog.getByRole('button', { name: 'Supprimer' }).click();

				// Toast confirmation
				await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'supprimée' })).toBeVisible();

				// Spot should disappear from the list
				await expect(spotRow).not.toBeVisible({ timeout: 3000 });
			});

			test('swap a shared spot to a flat', async ({ page }) => {
				// Login first
				await login(page, ADMIN_FLAT, ADMIN_PIN);

				// Recreate spot 36 via API so we have something to swap
				const cookies = await page.context().cookies();
				const sessionCookie = cookies.find((c) => c.name === 'session');
				const cookieStr = sessionCookie ? `session=${sessionCookie.value}` : '';

				const res = await page.request.post('/api/spots', {
					headers: { 'Content-Type': 'application/json', Cookie: cookieStr },
					data: { number: TEST_SPOT, description: '' }
				});
				expect(res.ok()).toBeTruthy();

				await navigateTo(page, '/admin');

				// Find the shared spot row
				const spotRow = page.locator('div.rounded-md.border').filter({ hasText: TEST_SPOT }).first();
				await expect(spotRow).toBeVisible();

				// Click the swap icon (ArrowLeftRight button with aria-label "Échanger")
				await spotRow.getByRole('button', { name: 'Échanger' }).click();

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
				await expect(spotRow).not.toBeVisible({ timeout: 3000 });
			});
		});

		test.describe('Flat management', () => {
			test('edit flat display name', async ({ page }) => {
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await navigateTo(page, '/admin');

				// Open detail for A01
				const flatCard = page.locator('div.rounded-md.border').filter({ hasText: 'A01' }).first();
				await flatCard.getByRole('button', { name: 'Voir détails' }).click();

				const detailDialog = page.locator('[role="dialog"]').filter({ hasText: 'Appartement' });
				await expect(detailDialog).toBeVisible();

				// Click Modifier
				await detailDialog.getByRole('button', { name: 'Modifier' }).click();

				// Edit dialog should open inside the detail dialog
				const editDialog = page.locator('[role="dialog"]').filter({ hasText: 'Modifier A01' });
				await expect(editDialog).toBeVisible();

				// Change display name
				await editDialog.locator('[id="edit-flat-name"]').fill('Test Resident');

				// Save
				await editDialog.getByRole('button', { name: 'Enregistrer' }).click();

				// Toast confirmation
				await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'mis à jour' })).toBeVisible();

				// Close dialogs
				await page.keyboard.press('Escape');
				await expect(editDialog).not.toBeVisible({ timeout: 3000 });
				await page.keyboard.press('Escape');
				await expect(detailDialog).not.toBeVisible({ timeout: 3000 });
			});

			test('toggle admin status', async ({ page }) => {
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await navigateTo(page, '/admin');

				// Open detail for A02 (not admin)
				const flatCard = page.locator('div.rounded-md.border').filter({ hasText: 'A02' }).first();
				await flatCard.getByRole('button', { name: 'Voir détails' }).click();

				const detailDialog = page.locator('[role="dialog"]').filter({ hasText: 'Appartement' });
				await expect(detailDialog).toBeVisible();

				// Click "Rendre admin"
				await detailDialog.getByRole('button', { name: 'Rendre admin' }).click();

				// Toast confirmation
				await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'admin' })).toBeVisible();

				// Close detail dialog
				await page.keyboard.press('Escape');
				await expect(detailDialog).not.toBeVisible({ timeout: 3000 });

				// Reopen detail — should now show "Retirer admin"
				await flatCard.getByRole('button', { name: 'Voir détails' }).click();
				await expect(detailDialog).toBeVisible();
				await expect(detailDialog.getByRole('button', { name: 'Retirer admin' })).toBeVisible();

				// Revoke admin
				await detailDialog.getByRole('button', { name: 'Retirer admin' }).click();
				await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'admin' })).toBeVisible();

				// Close dialog
				await page.keyboard.press('Escape');
				await expect(detailDialog).not.toBeVisible({ timeout: 3000 });

				// Reopen — "Rendre admin" should be back
				await flatCard.getByRole('button', { name: 'Voir détails' }).click();
				await expect(detailDialog).toBeVisible();
				await expect(detailDialog.getByRole('button', { name: 'Rendre admin' })).toBeVisible();

				await page.keyboard.press('Escape');
			});

			test('reset a flat', async ({ page }) => {
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await navigateTo(page, '/admin');

				// Open detail for A03
				const flatCard = page.locator('div.rounded-md.border').filter({ hasText: 'A03' }).first();
				await flatCard.getByRole('button', { name: 'Voir détails' }).click();

				const detailDialog = page.locator('[role="dialog"]').filter({ hasText: 'Appartement' });
				await expect(detailDialog).toBeVisible();

				// Click Réinitialiser
				await detailDialog.getByRole('button', { name: 'Réinitialiser' }).click();

				// AlertDialog should open
				const alertDialog = page.locator('[role="alertdialog"]');
				await expect(alertDialog).toBeVisible();

				// Confirm
				await alertDialog.getByRole('button', { name: 'Réinitialiser' }).click();

				// Toast confirmation
				await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'réinitialisé' })).toBeVisible();

				// Close dialog
				await page.keyboard.press('Escape');
				await expect(detailDialog).not.toBeVisible({ timeout: 3000 });

				// Flat should now show "Inactif" badge
				const flatCardAfter = page.locator('div.rounded-md.border').filter({ hasText: 'A03' }).first();
				await expect(flatCardAfter.getByText('Inactif')).toBeVisible();
			});

			test('delete a flat', async ({ page }) => {
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await navigateTo(page, '/admin');

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
				await expect(flatCard).not.toBeVisible({ timeout: 3000 });
			});
		});

		test.describe('Request handling', () => {
			test('approve and reject a request', async ({ page }) => {
				// Step 1: Submit a request as an anonymous user
				await navigateTo(page, '/request');

				// Fill flat number (must be A or B prefix)
				await page.locator('[id="flat"]').fill('B05');
				await page.keyboard.press('Escape');

				// Add a spot
				await page.locator('input[placeholder="ex. 01"]').fill('50');
				await page.keyboard.press('Enter');

				// Add email
				await page.locator('input[type="email"]').fill('b05@test.com');
				await page.keyboard.press('Enter');

				// Add phone
				await page.locator('input[type="tel"]').fill('+33612345678');
				await page.keyboard.press('Enter');

				// Submit
				await page.click('button[type="submit"]');

				// Confirmation message
				await expect(page.getByText('Demande envoyée')).toBeVisible({ timeout: 5000 });

				// Step 2: Login as admin and approve
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await navigateTo(page, '/admin');

				// Request should appear in "Demandes en attente"
				const requestRow = page.locator('div.rounded-md.border.border-dashed').filter({ hasText: 'B05' });
				await expect(requestRow).toBeVisible({ timeout: 5000 });

				// Approve
				await requestRow.getByRole('button', { name: 'Approuver' }).click();

				// Toast confirmation
				await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'approuvé' })).toBeVisible();

				// Request should disappear
				await expect(requestRow).not.toBeVisible({ timeout: 3000 });

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
				await page.locator('[id="flat"]').fill('A99');
				await page.keyboard.press('Escape');
				await page.locator('input[placeholder="ex. 01"]').fill('70');
				await page.keyboard.press('Enter');
				await page.locator('input[type="email"]').fill('a99@test.com');
				await page.keyboard.press('Enter');
				await page.locator('input[type="tel"]').fill('+33698765432');
				await page.keyboard.press('Enter');
				await page.click('button[type="submit"]');
				await expect(page.getByText('Demande envoyée')).toBeVisible({ timeout: 5000 });

				// Login as admin again
				await login(page, ADMIN_FLAT, ADMIN_PIN);
				await navigateTo(page, '/admin');

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
				await expect(requestRow2).not.toBeVisible({ timeout: 3000 });
			});
		});
	});
