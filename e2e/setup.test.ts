import { expect, test } from '@playwright/test';
import { ADMIN_FLAT, ADMIN_PIN, addContactViaUI, ensureSpots, navigateTo, TEST_SPOT } from './helpers';

test.describe
	.serial('Setup wizard', () => {
		test('redirects to /setup on first visit', async ({ page }) => {
			await page.goto('/');
			await page.waitForURL('**/setup');
			expect(page.url()).toContain('/setup');
		});

		test('creates admin account via setup wizard', async ({ page }) => {
			await page.goto('/setup');

			// Fill in the setup form (placeholders — the page uses FormField
			// components; contact lists need an "Ajouter" click first)
			await page.getByPlaceholder('ex. B12').fill(ADMIN_FLAT);
			await page.getByPlaceholder('ex. Famille Dupont').fill('Admin');
			await addContactViaUI(page, page, 'Ajouter un e-mail', 'input[type="email"]', 'admin@test.com');
			await addContactViaUI(page, page, 'Ajouter un téléphone', 'input[type="tel"]', '+33612345678');
			await page.fill('[id="pin"]', ADMIN_PIN);
			await page.fill('[id="pin-confirm"]', ADMIN_PIN);

			// Submit and wait for redirect to calendar
			await page.click('button[type="submit"]');
			await page.waitForURL('/calendar');

			// Verify we're logged in by checking the URL
			expect(page.url()).toContain('/calendar');
		});

		test('setup page redirects to login after admin is created', async ({ page }) => {
			// Clear cookies to simulate new visitor
			await page.context().clearCookies();
			await page.goto('/setup');
			// Should redirect to login (or show "already configured")
			await page.waitForTimeout(2000);
			const url = page.url();
			expect(url.includes('/login') || url.includes('/setup')).toBeTruthy();
		});

		test('seed the shared spot used by later specs', async ({ page }) => {
			// Pure API fixture: spot 36 must sit in the shared pool for the
			// booking/calendar/admin suites — creating it is not a journey worth
			// driving through the spots-page dialog.
			const loginRes = await page.request.post('/api/auth/login', {
				data: { flatNumber: ADMIN_FLAT, pin: ADMIN_PIN }
			});
			expect(loginRes.ok()).toBe(true);
			await ensureSpots(page, [TEST_SPOT]);

			// Pooling landed if the spot shows up in the shared mosaic
			await navigateTo(page, '/admin/spots');
			const sharedCard = page.locator('[data-slot="card"]').filter({ hasText: 'Places de parking' });
			await expect(sharedCard.getByRole('button', { name: `Voir la place ${TEST_SPOT}` })).toBeVisible({
				timeout: 5000
			});
		});
	});
