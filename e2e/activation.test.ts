import { expect, test } from '@playwright/test';
import { ADMIN_FLAT, ADMIN_PIN, TEST_FLATS } from './helpers';

test.describe
	.serial('Activation flow', () => {
		test('admin creates flats and generates activation codes', async ({ page }) => {
			// Login as admin
			await page.goto('/login');
			await page.fill('[id="flat"]', ADMIN_FLAT);
			await page.fill('[id="pin"]', ADMIN_PIN);
			await page.click('button[type="submit"]');
			await page.waitForURL('/calendar');

			await page.goto('/admin');

			// Create each test flat
			for (const flat of TEST_FLATS) {
				await page.fill('input[placeholder="Numéro (ex. B12)"]', flat.number);
				await page.locator('button:text("Ajouter")').last().click();
				// Wait for the flat to appear in the list
				await expect(page.locator(`text=${flat.number}`).first()).toBeVisible();
			}

			// Generate activation codes for each flat
			for (const flat of TEST_FLATS) {
				const flatCard = page.locator(`div:has(> div > div > span:text("${flat.number}"))`).first();
				await flatCard.locator('button:text("Générer un lien")').click();
				// Wait for the activation code to appear
				await expect(flatCard.locator('text=Code :')).toBeVisible({ timeout: 5000 });
			}
		});

		test('resident activates via activation link', async ({ page, request }) => {
			// Login as admin to get an activation code
			await page.goto('/login');
			await page.fill('[id="flat"]', ADMIN_FLAT);
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
				await page.goto(`/activate?flat=${testFlat.number}&code=${flatData.activationCode}`);

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
