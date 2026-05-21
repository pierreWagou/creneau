import { expect, test } from '@playwright/test';
import { login, navigateTo, TEST_FLATS } from './helpers';

const FLAT = TEST_FLATS[3]; // A04

test.describe
	.serial('Authentication flows', () => {
		test('login with correct PIN', async ({ page }) => {
			await login(page, FLAT.number, FLAT.pin);
			await expect(page).toHaveURL('/calendar');
		});

		test('login with wrong PIN fails', async ({ page }) => {
			await navigateTo(page, '/login');
			await page.fill('[id="flat"]', FLAT.number);
			await page.fill('[id="pin"]', '9999');
			await page.click('button[type="submit"]');

			// Should stay on login page (or show error toast)
			await page.waitForTimeout(1000);
			await expect(page).toHaveURL(/\/login/);
		});

		test('change PIN and login with new PIN', async ({ page }) => {
			await login(page, FLAT.number, FLAT.pin);

			// Go to account page
			await navigateTo(page, '/account');

			// Fill PIN change form
			await page.fill('[id="current-pin"]', FLAT.pin);
			await page.fill('[id="new-pin"]', '5678');
			await page.fill('[id="confirm-pin"]', '5678');

			// Submit PIN change
			await page.locator('button:text("Modifier le PIN")').click();

			// Verify success
			await expect(page.locator('[data-sonner-toast]')).toBeVisible({ timeout: 5000 });

			// Logout
			await page.locator('button:text("Se déconnecter")').click();
			await page.waitForURL(/\/login/);

			// Login with old PIN should fail
			await page.waitForLoadState('networkidle');
			await page.fill('[id="flat"]', FLAT.number);
			await page.fill('[id="pin"]', FLAT.pin);
			await page.click('button[type="submit"]');
			await page.waitForTimeout(1000);
			await expect(page).toHaveURL(/\/login/);

			// Login with new PIN should work
			await page.fill('[id="flat"]', FLAT.number);
			await page.fill('[id="pin"]', '5678');
			await page.click('button[type="submit"]');
			await page.waitForURL('/calendar');
		});

		test('logout redirects to login', async ({ page }) => {
			await login(page, FLAT.number, '5678'); // PIN was changed in previous test
			await navigateTo(page, '/account');
			await page.locator('button:text("Se déconnecter")').click();
			await page.waitForURL(/\/login/);

			// Trying to access protected page redirects to login
			await navigateTo(page, '/calendar');
			await page.waitForURL(/\/login/);
		});
	});
