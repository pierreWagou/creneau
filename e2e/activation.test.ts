import { expect, test } from '@playwright/test';
import { ADMIN_FLAT, ADMIN_PIN, createFlatViaAPI, ensureInviteCode, login, navigateTo, TEST_FLATS } from './helpers';

test.describe
	.serial('Activation flow', () => {
		test('admin creates lots and generates an activation code', async ({ page }) => {
			await login(page, ADMIN_FLAT, ADMIN_PIN);

			// The four test flats are pure fixtures for downstream projects —
			// created via API, no dialog choreography. Each claims one spot
			// (the API requires ≥1; bindSpotsToFlat auto-creates them).
			for (const [i, flat] of TEST_FLATS.entries()) {
				await createFlatViaAPI(page.request, { number: flat.number, spotNumbers: [String(10 + i)] });
			}

			// One UI pass: lot drawer → Sécurité tab → generate → invite modal
			// carries the activation URL.
			await navigateTo(page, '/admin/lots');
			const flatCard = page.locator('div.rounded-md.border').filter({ hasText: TEST_FLATS[0].number }).first();
			await flatCard.getByRole('button', { name: 'Voir détails' }).click();
			const detailDialog = page.locator('[role="dialog"]').filter({ hasText: 'Sécurité' });
			await expect(detailDialog).toBeVisible({ timeout: 5000 });
			await detailDialog.getByRole('tab', { name: 'Sécurité' }).click();
			// API-created flats are codeless — generate and leave the invite modal open
			await ensureInviteCode(page, detailDialog);
			const inviteDialog = page.getByRole('dialog', { name: 'Invitation' });
			await expect(inviteDialog.locator('input[readonly]')).toHaveValue(
				new RegExp(`/activate\\?flat=${TEST_FLATS[0].number}`),
				{ timeout: 5000 }
			);
			await page.keyboard.press('Escape');
			await expect(inviteDialog).not.toBeVisible({ timeout: 10000 });
		});

		test('resident activates via activation link', async ({ page }) => {
			// Admin generates codes for every test flat (flat 0 is already
			// pending from the UI pass — refresh on pending is legal), then
			// seeds a display name on flat 0 to exercise lookup auto-fill.
			await login(page, ADMIN_FLAT, ADMIN_PIN);
			for (const { number } of TEST_FLATS) {
				const res = await page.request.post(`/api/admin/flats/${number}/activation`);
				expect(res.ok()).toBe(true);
			}
			const seeded = await page.request.patch(`/api/admin/flats/${TEST_FLATS[0].number}`, {
				data: { displayName: 'Résident Auto' }
			});
			expect(seeded.ok()).toBe(true);

			// Read the flats list (with codes) while still admin
			const flatsRes = await page.request.get('/api/admin/flats');
			expect(flatsRes.ok()).toBe(true);
			const { flats } = await flatsRes.json();

			// Resident side must be unauthenticated
			await page.request.post('/api/auth/logout');
			await page.context().clearCookies();

			for (const [i, testFlat] of TEST_FLATS.entries()) {
				const flatData = flats.find((f: { number: string }) => f.number === testFlat.number);
				expect(flatData).toBeTruthy();
				expect(flatData.activationCode).toBeTruthy();

				// Visit the activation link from the invitation
				await navigateTo(page, `/activate?flat=${testFlat.number}&code=${flatData.activationCode}`);
				await expect(page.getByText(`Lot ${testFlat.number}`).first()).toBeVisible();

				// Set the display name via the header editor
				if (i === 0) {
					// Lookup auto-fill: seeded name appears without typing
					await expect(page.getByText('Résident Auto').first()).toBeVisible({ timeout: 5000 });
				}
				await page
					.getByRole('button', { name: i === 0 ? 'Modifier le nom' : 'Ajouter un nom' })
					.first()
					.click();
				await page.getByPlaceholder('ex. Jean, Famille Dupont').fill(`Resident ${testFlat.number}`);
				// .first(): header editor precedes the (also open) PIN editor in DOM order.
				await page.getByRole('button', { name: 'Valider' }).first().click();
				await expect(page.getByText(`Resident ${testFlat.number}`).first()).toBeVisible();

				// PIN editor open by default: fill directly, then activate
				await page.getByPlaceholder('Nouveau PIN', { exact: true }).fill(testFlat.pin);
				await page.getByPlaceholder('Confirmation nouveau PIN').fill(testFlat.pin);
				await page.getByRole('button', { name: 'Valider' }).click();
				await expect(page.getByRole('button', { name: 'Activer' })).toBeEnabled();
				await page.getByRole('button', { name: 'Activer' }).click();
				await page.waitForURL('/calendar');

				// Logout for next flat
				await page.request.post('/api/auth/logout');
				await page.context().clearCookies();
			}
		});

		test('invitation revoke returns flat to inactive', async ({ page }) => {
			await login(page, ADMIN_FLAT, ADMIN_PIN);

			// Fixture: A05 via API (claims spot 20; invite lifecycle doesn't touch it)
			await createFlatViaAPI(page.request, { number: 'A05', spotNumbers: ['20'] });
			await navigateTo(page, '/admin/lots');

			const flatCard = page.locator('div.rounded-md.border').filter({ hasText: 'A05' }).first();
			await flatCard.getByRole('button', { name: 'Voir détails' }).click();
			const detailDialog = page.locator('[role="dialog"]').filter({ hasText: 'Sécurité' });
			await expect(detailDialog).toBeVisible({ timeout: 5000 });
			await detailDialog.getByRole('tab', { name: 'Sécurité' }).click();

			// Generate an invitation → En attente (leaves the invite modal open)
			await ensureInviteCode(page, detailDialog);
			await expect(detailDialog.getByText('En attente').first()).toBeVisible({ timeout: 5000 });
			const inviteDialog = page.getByRole('dialog', { name: 'Invitation' });
			await expect(inviteDialog).toBeVisible({ timeout: 5000 });
			await page.keyboard.press('Escape');
			await expect(inviteDialog).not.toBeVisible({ timeout: 10000 });

			// Revoke → Inactif (no invitation ⟹ inactive)
			await detailDialog.getByRole('button', { name: "Révoquer l'invitation" }).click();
			await expect(detailDialog.getByText('Inactif').first()).toBeVisible({ timeout: 5000 });

			// Regenerate re-arms → En attente with a fresh invitation
			await detailDialog.getByRole('button', { name: 'Générer un lien' }).click();
			await expect(detailDialog.getByText('En attente').first()).toBeVisible({ timeout: 5000 });
			await expect(page.getByRole('dialog', { name: 'Invitation' })).toBeVisible({ timeout: 5000 });
			await page.keyboard.press('Escape');
			await expect(inviteDialog).not.toBeVisible({ timeout: 10000 });
		});
	});
