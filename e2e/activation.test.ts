import { expect, test } from '@playwright/test';
import { ADMIN_FLAT, ADMIN_PIN, navigateTo, TEST_FLATS } from './helpers';

test.describe
	.serial('Activation flow', () => {
		test('admin creates flats and generates activation codes', async ({ page }) => {
			// Login as admin
			await navigateTo(page, '/login');
			await page.fill('[id="flat"]', ADMIN_FLAT);
			await page.keyboard.press('Escape'); // close combobox before proceeding
			await page.fill('[id="pin"]', ADMIN_PIN);
			await page.click('button[type="submit"]');
			await page.waitForURL('/calendar');

			await navigateTo(page, '/admin');

			// Create each test flat via the dialog
			for (const flat of TEST_FLATS) {
				// Click the "Ajouter" button (first match — page-level, not the one inside the dialog)
				await page.getByRole('button', { name: 'Ajouter', exact: true }).first().click();

				const dialog = page.locator('[role="dialog"]');
				await dialog.waitFor();
				await dialog.locator('[id="flat-number"]').fill(flat.number);
				await dialog.getByRole('button', { name: 'Ajouter' }).click();
				// Wait for dialog to close and flat to appear
				await expect(page.getByText(flat.number).first()).toBeVisible();
			}

			// Generate activation codes for each flat
			for (const flat of TEST_FLATS) {
				const flatCard = page.locator('div.rounded-md.border').filter({ hasText: flat.number }).first();
				await flatCard.getByRole('button', { name: 'Inviter' }).click();
				// Invite dialog should open with activation URL
				const inviteDialog = page.locator('[role="dialog"]');
				await expect(inviteDialog).toBeVisible({ timeout: 5000 });
				await expect(inviteDialog.locator('input[readonly]')).toHaveValue(
					new RegExp(`/activate\\?flat=${flat.number}`),
					{ timeout: 5000 }
				);
				// Close the dialog before moving to the next flat
				await page.keyboard.press('Escape');
				await expect(inviteDialog).not.toBeVisible({ timeout: 3000 });
			}
		});

		test('resident activates via activation link', async ({ page, request }) => {
			// Login as admin to get an activation code
			await navigateTo(page, '/login');
			await page.fill('[id="flat"]', ADMIN_FLAT);
			await page.keyboard.press('Escape'); // close combobox before proceeding
			await page.fill('[id="pin"]', ADMIN_PIN);
			await page.click('button[type="submit"]');
			await page.waitForURL('/calendar');

			// Get the flats list from API to retrieve activation codes
			const cookies = await page.context().cookies();
			const sessionCookie = cookies.find((c) => c.name === 'session');
			const res = await request.get('/api/admin/flats', {
				headers: { Cookie: `session=${sessionCookie?.value}` }
			});
			const { flats } = await res.json();

			// Logout
			await request.post('/api/auth/logout', {
				headers: { Cookie: `session=${sessionCookie?.value}` }
			});

			// Activate each test flat
			for (const testFlat of TEST_FLATS) {
				const flatData = flats.find((f: any) => f.number === testFlat.number);
				expect(flatData).toBeTruthy();
				expect(flatData.activationCode).toBeTruthy();

				// Visit activation link
				await navigateTo(page, `/activate?flat=${testFlat.number}&code=${flatData.activationCode}`);

				// Fill in the activation form
				await expect(page.locator('[id="flat"]')).toHaveValue(testFlat.number);
				await expect(page.locator('[id="code"]')).toHaveValue(flatData.activationCode);
				await page.fill('[id="name"]', `Resident ${testFlat.number}`);
				await page.fill('[id="pin"]', testFlat.pin);
				await page.fill('[id="pin-confirm"]', testFlat.pin);
				await page.click('button[type="submit"]');

				await page.waitForURL('/calendar');

				// Logout for next flat
				const newCookies = await page.context().cookies();
				const newSession = newCookies.find((c) => c.name === 'session');
				if (newSession) {
					await request.post('/api/auth/logout', {
						headers: { Cookie: `session=${newSession.value}` }
					});
				}
				await page.context().clearCookies();
			}
		});
	});
