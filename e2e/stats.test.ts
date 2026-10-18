import { expect, test } from '@playwright/test';
import { login, navigateTo, TEST_FLATS } from './helpers';

const FLAT = TEST_FLATS[0]; // A01

test.describe
	.serial('Stats page', () => {
		test('loads personal and building sections', async ({ page }) => {
			await login(page, FLAT.number, FLAT.pin);
			await navigateTo(page, '/stats');
			await expect(page.getByRole('heading', { name: 'Activité' })).toBeVisible();
			await expect(page.getByText('Mon activité').first()).toBeVisible();
			await expect(page.getByText('Immeuble').first()).toBeVisible();
		});
	});
