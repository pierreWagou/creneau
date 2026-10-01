import { expect, test } from '@playwright/test';
import { ADMIN_FLAT, ADMIN_PIN, navigateTo, TEST_SPOT } from './helpers';

test.describe
	.serial('Setup wizard', () => {
		test('redirects to /setup on first visit', async ({ page }) => {
			await navigateTo(page, '/');
			await page.waitForURL('/setup');
			await expect(page.locator('[data-slot="card-title"]')).toContainText('Configuration initiale');
		});

		test('creates admin account via setup wizard', async ({ page }) => {
			await navigateTo(page, '/setup');

			await page.getByPlaceholder('ex. B12').fill(ADMIN_FLAT);
			await page.getByPlaceholder('ex. Marc').fill('Admin');

			// Add an email (required)
			await page.getByRole('button', { name: 'Ajouter un e-mail' }).click();
			await page.locator('input[type="email"]').fill('admin@test.com');
			await page.keyboard.press('Enter');

			// Add a phone (required)
			await page.getByRole('button', { name: 'Ajouter un téléphone' }).click();
			await page.locator('input[type="tel"]').fill('+33612345678');
			await page.keyboard.press('Enter');

			await page.fill('[id="pin"]', ADMIN_PIN);
			await page.fill('[id="pin-confirm"]', ADMIN_PIN);
			await page.click('button[type="submit"]');

			await page.waitForURL('/calendar');
			// Verify we're logged in — header shows the flat number or display name
			await expect(page.locator('header')).toContainText('Admin');
		});

		test('setup page redirects to login after admin is created', async ({ page }) => {
			await navigateTo(page, '/setup');
			await page.waitForURL('/login');
		});

		test('admin creates a parking spot', async ({ page }) => {
			// Login as admin
			await navigateTo(page, '/login');
			await page.fill('[id="flat"]', ADMIN_FLAT);
			await page.fill('[id="pin"]', ADMIN_PIN);
			await page.click('button[type="submit"]');
			await page.waitForURL('/calendar');

			// Go to admin page and open the add spot dialog
			await navigateTo(page, '/admin/spots');
			await page.getByRole('button', { name: 'Ajouter une place' }).click();

			// Fill spot number in the dialog
			const dialog = page.locator('[role="dialog"]');
			await dialog.waitFor({ timeout: 5000 });
			await dialog.getByPlaceholder('ex. 01').fill(TEST_SPOT);
			await dialog.getByRole('button', { name: 'Ajouter' }).click();

			// New spots land unassigned — pool 36 so bookings (and later specs) can use it
			await page.waitForTimeout(1500);
			await page.reload();
			const waitingCard = page.locator('[data-slot="card"]').filter({ hasText: 'En attente' });
			await waitingCard.getByRole('button', { name: /Voir la place 36/ }).click();
			const spotDrawer = page.locator('[role="dialog"]').last();
			await expect(spotDrawer).toBeVisible();
			await spotDrawer.getByRole('button', { name: 'Mettre en commun' }).click();
			await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'mise en commun' })).toBeVisible();
			await page.keyboard.press('Escape');

			// Verify spot appears in the shared mosaic
			const sharedCard = page.locator('[data-slot="card"]').filter({ hasText: 'Places de parking' });
			await expect(sharedCard.getByText(TEST_SPOT).first()).toBeVisible({ timeout: 5000 });
		});
	});
