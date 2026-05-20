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
			await page.fill('[id="flat"]', ADMIN_FLAT);
			await page.fill('[id="pin"]', ADMIN_PIN);
			await page.click('button[type="submit"]');
			await page.waitForURL('/calendar');

			// Go to admin page and create a spot
			await page.goto('/admin');
			const spotInput = page.locator('input[placeholder="Numéro (ex. 36)"]');
			await spotInput.fill(TEST_SPOT);
			// The "Ajouter" button is next to the spot input in a flex container
			await spotInput.locator('xpath=..').locator('button').click();

			// Wait for data to refresh and verify spot appears
			await page.waitForTimeout(1500);
			await page.reload();
			await expect(page.getByText(TEST_SPOT).first()).toBeVisible();
		});
	});
