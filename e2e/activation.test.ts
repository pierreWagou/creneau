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

			await navigateTo(page, '/admin/lots');

			// Create each test flat via the dialog
			for (let i = 0; i < TEST_FLATS.length; i++) {
				const flat = TEST_FLATS[i];
				// Click the "Ajouter" button in the Lots card (not the spots card)
				const flatsCard = page.locator('[data-slot="card"]').filter({ hasText: 'Lots' });
				await flatsCard.getByRole('button', { name: 'Ajouter', exact: true }).click();

				const dialog = page.locator('[role="dialog"]');
				await dialog.waitFor();
				// Number editor open by default: fill + Enter commits to static title text
				await dialog.getByPlaceholder('ex. B12').fill(flat.number);
				await dialog.getByPlaceholder('ex. B12').press('Enter');
				await expect(dialog.getByText(`Lot ${flat.number}`).first()).toBeVisible();
				// Fill a valid 2-digit spot number
				const spotNumber = String(10 + i).padStart(2, '0');
				await dialog.getByRole('button', { name: 'Ajouter une place' }).click();
				await dialog.locator('input[placeholder="ex. 01"]').fill(spotNumber);
				await dialog.locator('input[placeholder="ex. 01"]').press('Enter');
				// Fill email
				await dialog.getByRole('button', { name: 'Ajouter un e-mail' }).click();
				await dialog.locator('input[type="email"]').fill(`${flat.number.toLowerCase()}@test.com`);
				await dialog.locator('input[type="email"]').press('Enter');
				// Fill phone
				await dialog.getByRole('button', { name: 'Ajouter un téléphone' }).click();
				await dialog.locator('input[type="tel"]').fill(`+3361234${String(i).padStart(2, '0')}78`);
				await dialog.locator('input[type="tel"]').press('Enter');
				// Click the main "Ajouter" button to submit the flat
				await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
				// Wait for dialog to close and flat to appear
				await expect(page.getByText(flat.number).first()).toBeVisible();
			}

			// Generate activation codes for each flat
			for (const flat of TEST_FLATS) {
				const flatCard = page.locator('div.rounded-md.border').filter({ hasText: flat.number }).first();
				await flatCard.getByRole('button', { name: 'Voir détails' }).click();
				// Flat detail drawer should open
				const detailDialog = page.locator('[role="dialog"]').filter({ hasText: 'Sécurité' });
				await expect(detailDialog).toBeVisible({ timeout: 5000 });
				// The invitation section lives under the Sécurité tab
				await detailDialog.getByRole('tab', { name: 'Sécurité' }).click();
				// Click "Générer un lien" since the flat is inactive
				await detailDialog.getByRole('button', { name: 'Générer un lien' }).click();
				// Wait for the activation code to be generated (toast confirms success)
				await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'activation' }).first()).toBeVisible({
					timeout: 5000
				});
				// The invitation modal opens automatically with the activation URL
				const inviteDialog = page.getByRole('dialog', { name: 'Invitation' });
				await expect(inviteDialog).toBeVisible({ timeout: 5000 });
				await expect(inviteDialog.locator('input[readonly]')).toHaveValue(
					new RegExp(`/activate\\?flat=${flat.number}`),
					{ timeout: 5000 }
				);
				// Close the modal, then the drawer, before moving to the next flat
				await page.keyboard.press('Escape');
				await expect(inviteDialog).not.toBeVisible({ timeout: 3000 });
				await page.keyboard.press('Escape');
				await expect(detailDialog).not.toBeVisible({ timeout: 3000 });
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

			// Seed a display name on the first flat to exercise lookup auto-fill
			const SEEDED_NAME = 'Résident Auto';
			await request.patch(`/api/admin/flats/${TEST_FLATS[0].number}`, {
				data: { displayName: SEEDED_NAME },
				headers: { Cookie: `session=${sessionCookie?.value}` }
			});

			// Logout
			await request.post('/api/auth/logout', {
				headers: { Cookie: `session=${sessionCookie?.value}` }
			});

			// Activate each test flat
			for (const [i, testFlat] of TEST_FLATS.entries()) {
				const flatData = flats.find((f: any) => f.number === testFlat.number);
				expect(flatData).toBeTruthy();
				expect(flatData.activationCode).toBeTruthy();

				// Visit activation link
				await navigateTo(page, `/activate?flat=${testFlat.number}&code=${flatData.activationCode}`);

				// Number is prefilled as static header text; code as static invitation text
				await expect(page.getByText(`Lot ${testFlat.number}`).first()).toBeVisible();
				await expect(page.getByText(flatData.activationCode).first()).toBeVisible();

				// Code editor round-trip (open prefilled + Escape cancels, no change)
				await page.getByRole('button', { name: 'Modifier le code' }).click();
				await expect(page.getByPlaceholder('ex. K7X9')).toHaveValue(flatData.activationCode);
				await page.keyboard.press('Escape');
				await expect(page.getByText(flatData.activationCode).first()).toBeVisible();

				// Blur-commit: reopen, change the code, click outside → commits.
				// (click target = closed number title: static text outside the invitation card)
				await page.getByRole('button', { name: 'Modifier le code' }).click();
				await page.getByPlaceholder('ex. K7X9').fill('ZZ99');
				await page.getByText(`Lot ${testFlat.number}`).first().click();
				await expect(page.getByText('ZZ99').first()).toBeVisible();
				// Restore the real code for the activation below
				await page.getByRole('button', { name: 'Modifier le code' }).click();
				await page.getByPlaceholder('ex. K7X9').fill(flatData.activationCode);
				await page.getByRole('button', { name: 'Valider' }).first().click();
				await expect(page.getByText(flatData.activationCode).first()).toBeVisible();

				// Number editor opens prefilled (open + Escape cancels, no change)
				await page.getByRole('button', { name: 'Modifier le numéro' }).click();
				await expect(page.getByText('Lot', { exact: true })).toBeVisible();
				await expect(page.getByPlaceholder('ex. B12')).toHaveValue(testFlat.number);
				await page.keyboard.press('Escape');
				await expect(page.getByText(`Lot ${testFlat.number}`).first()).toBeVisible();

				const residentName = `Resident ${testFlat.number}`;
				if (i === 0) {
					// Lookup auto-fill: seeded name appears without typing
					await expect(page.getByText(SEEDED_NAME).first()).toBeVisible({ timeout: 5000 });
				}
				// Set the display name via the header pencil flow
				await page
					.getByRole('button', { name: i === 0 ? 'Modifier le nom' : 'Ajouter un nom' })
					.first()
					.click();
				await page.getByPlaceholder('ex. Jean, Famille Dupont').fill(residentName);
				// .first(): header editor precedes the (also open) PIN editor in DOM order.
				await page.getByRole('button', { name: 'Valider' }).first().click();
				await expect(page.getByText(residentName).first()).toBeVisible();
				// PIN editor open by default: fill directly, commit collapses to masked value
				await page.getByPlaceholder('Nouveau PIN', { exact: true }).fill(testFlat.pin);
				await page.getByPlaceholder('Confirmation nouveau PIN').fill(testFlat.pin);
				await page.getByRole('button', { name: 'Valider' }).click();
				await expect(page.getByLabel('PIN masqué')).toBeVisible();
				await expect(page.getByRole('button', { name: 'Activer' })).toBeEnabled();
				await page.getByRole('button', { name: 'Activer' }).click();

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

		test('invitation revoke returns flat to inactive', async ({ page }) => {
			// Login as admin
			await navigateTo(page, '/login');
			await page.fill('[id="flat"]', ADMIN_FLAT);
			await page.keyboard.press('Escape'); // close combobox before proceeding
			await page.fill('[id="pin"]', ADMIN_PIN);
			await page.click('button[type="submit"]');
			await page.waitForURL('/calendar');

			await navigateTo(page, '/admin/lots');

			// Create a dedicated flat via the dialog
			const flatsCard = page.locator('[data-slot="card"]').filter({ hasText: 'Lots' });
			await flatsCard.getByRole('button', { name: 'Ajouter', exact: true }).click();
			const dialog = page.locator('[role="dialog"]');
			await dialog.waitFor();
			await dialog.getByPlaceholder('ex. B12').fill('A05');
			await dialog.getByPlaceholder('ex. B12').press('Enter');
			await dialog.getByRole('button', { name: 'Ajouter une place' }).click();
			await dialog.locator('input[placeholder="ex. 01"]').fill('20');
			await dialog.locator('input[placeholder="ex. 01"]').press('Enter');
			await dialog.getByRole('button', { name: 'Ajouter un e-mail' }).click();
			await dialog.locator('input[type="email"]').fill('a05@test.com');
			await dialog.locator('input[type="email"]').press('Enter');
			await dialog.getByRole('button', { name: 'Ajouter un téléphone' }).click();
			await dialog.locator('input[type="tel"]').fill('+33612340578');
			await dialog.locator('input[type="tel"]').press('Enter');
			await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
			await expect(page.getByText('A05').first()).toBeVisible();

			// Generate an invitation → En attente
			const flatCard = page.locator('div.rounded-md.border').filter({ hasText: 'A05' }).first();
			await flatCard.getByRole('button', { name: 'Voir détails' }).click();
			const detailDialog = page.locator('[role="dialog"]').filter({ hasText: 'Sécurité' });
			await expect(detailDialog).toBeVisible({ timeout: 5000 });
			await detailDialog.getByRole('tab', { name: 'Sécurité' }).click();
			await detailDialog.getByRole('button', { name: 'Générer un lien' }).click();
			await expect(detailDialog.getByText('En attente').first()).toBeVisible({ timeout: 5000 });

			// Dismiss the auto-opened invite modal
			const inviteDialog = page.getByRole('dialog', { name: 'Invitation' });
			await expect(inviteDialog).toBeVisible({ timeout: 5000 });
			await page.keyboard.press('Escape');
			await expect(inviteDialog).not.toBeVisible({ timeout: 3000 });

			// Revoke → Inactif (no invitation ⟹ inactive)
			await detailDialog.getByRole('button', { name: "Révoquer l'invitation" }).click();
			await expect(detailDialog.getByText('Inactif').first()).toBeVisible({ timeout: 5000 });

			// Regenerate re-arms → En attente with a fresh invitation
			await detailDialog.getByRole('button', { name: 'Générer un lien' }).click();
			await expect(detailDialog.getByText('En attente').first()).toBeVisible({ timeout: 5000 });
			await expect(page.getByRole('dialog', { name: 'Invitation' })).toBeVisible({ timeout: 5000 });
			await page.keyboard.press('Escape');
			await expect(page.getByRole('dialog', { name: 'Invitation' })).not.toBeVisible({ timeout: 3000 });
			await page.keyboard.press('Escape');
			await expect(detailDialog).not.toBeVisible({ timeout: 3000 });
		});

		test('number editor is open by default without prefill', async ({ page }) => {
			await page.context().clearCookies();
			await navigateTo(page, '/activate');

			// Editor open immediately, empty, with the Lot prefix beside it
			await expect(page.getByText('Lot', { exact: true })).toBeVisible();
			await expect(page.getByPlaceholder('ex. B12')).toBeVisible();
			await expect(page.getByPlaceholder('ex. B12')).toHaveValue('');

			// Invalid draft: error shown, no Valider anywhere (header shows the warning icon,
			// pristine PIN shows nothing); then recover to a valid value.
			await page.getByPlaceholder('ex. B12').fill('ZZ');
			await expect(page.getByText('Format invalide')).toBeVisible();
			await expect(page.getByRole('button', { name: 'Valider' })).toHaveCount(0);

			// Commit an existing number → static text + lookup auto-fills the admin name.
			// .first(): header editor precedes the (also open) PIN editor in DOM order.
			await page.getByPlaceholder('ex. B12').fill(ADMIN_FLAT);
			await page.getByRole('button', { name: 'Valider' }).first().click();
			await expect(page.getByText(`Lot ${ADMIN_FLAT}`).first()).toBeVisible();
			await expect(page.getByText('Admin').first()).toBeVisible({ timeout: 5000 });

			// Code editor open by default too (empty)
			await expect(page.getByPlaceholder('ex. K7X9')).toHaveValue('');

			// PIN inputs open by default; no code → Activer stays disabled
			await expect(page.getByPlaceholder('Nouveau PIN', { exact: true })).toBeVisible();
			await expect(page.getByRole('button', { name: 'Activer' })).toBeDisabled();
		});
	});
