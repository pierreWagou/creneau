import { expect, test } from '@playwright/test';
import { ADMIN_FLAT, ADMIN_PIN, TEST_SPOT } from './helpers';

test.describe
	.serial('Setup wizard', () => {
		test('redirects to /setup on first visit', async ({ page }) => {
			await page.goto('/');
			await page.waitForURL('/setup');
			await expect(page.locator('[data-slot="card-title"]')).toContainText('Configuration initiale');
		});

		test('creates admin account via setup wizard', async ({ page }) => {
			await page.goto('/setup');
			await page.waitForLoadState('networkidle');

			await page.fill('[id="flat"]', ADMIN_FLAT);
			await page.fill('[id="name"]', 'Admin');
			await page.fill('[id="pin"]', ADMIN_PIN);
			await page.fill('[id="pin-confirm"]', ADMIN_PIN);
			await page.click('button[type="submit"]');

			await page.waitForURL('/calendar');
			// Verify we're logged in — header shows the flat number or display name
			await expect(page.locator('header')).toContainText('Admin');
		});

		test('setup page redirects to login after admin is created', async ({ page }) => {
			await page.goto('/setup');
			await page.waitForURL('/login');
		});

		test('admin creates a parking spot', async ({ page }) => {
			// Login as admin
			await page.goto('/login');
			await page.waitForLoadState('networkidle');
			await page.fill('[id="flat"]', ADMIN_FLAT);
			await page.fill('[id="pin"]', ADMIN_PIN);
			await page.click('button[type="submit"]');
			await page.waitForURL('/calendar');

			// Go to admin page and open the add spot dialog
			await page.goto('/admin');
			await page.waitForLoadState('networkidle');
			const btn = page.getByRole('button', { name: 'Ajouter une place' });
			await btn.click();

			// Fill spot number in the dialog
			const dialog = page.locator('[role="dialog"]');
			await dialog.waitFor({ timeout: 5000 });
			await dialog.locator('[id="spot-number"]').fill(TEST_SPOT);
			await dialog.getByRole('button', { name: 'Ajouter' }).click();

			// Wait for data to refresh and verify spot appears
			await page.waitForTimeout(1500);
			await page.reload();
			await expect(page.getByText(TEST_SPOT).first()).toBeVisible();
		});
	});
