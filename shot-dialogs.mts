import { chromium } from '@playwright/test';

// ---- 390 dark: spot add, swap, invite, generic confirm, approval conflict ----
{
	const browser = await chromium.launch();
	const ctx = await browser.newContext({ colorScheme: 'dark', viewport: { width: 390, height: 900 } });
	const page = await ctx.newPage();
	page.setDefaultTimeout(10000);
	await page.goto('http://localhost:5176/admin');
	await page.waitForTimeout(1200);

	// need login first
	await ctx.request.post('http://localhost:5176/api/auth/login', { data: { flatNumber: 'A00', pin: '1234' } });
	await page.goto('http://localhost:5176/admin');
	await page.waitForTimeout(1200);

	// 1. spot add dialog
	const spotsCard = page.locator('[data-slot="card"]').filter({ hasText: 'partagée' }).first();
	await spotsCard.getByRole('button', { name: 'Ajouter une place' }).click();
	let dialog = page.locator('[role="dialog"]');
	await dialog.waitFor();
	await page.waitForTimeout(400);
	await dialog.screenshot({ path: '/tmp/shot-dlg-spotadd.png' });
	await page.keyboard.press('Escape');

	// 2. spot drawer -> swap dialog (spot 36 shared)
	await spotsCard.getByRole('button', { name: 'Voir la place 36' }).click();
	const drawer = page.locator('[role="dialog"]').last();
	await drawer.waitFor({ state: 'visible' });
	await drawer.getByRole('button', { name: 'Échanger' }).click();
	dialog = page.locator('[role="dialog"]');
	await dialog.waitFor();
	await page.waitForTimeout(400);
	await dialog.screenshot({ path: '/tmp/shot-dlg-swap.png' });
	await page.keyboard.press('Escape');
	await page.keyboard.press('Escape');

	// 3. invite modal (flat with code: generate via drawer)
	const flatCard = page.locator('div.rounded-md.border').filter({ hasText: 'A01' }).first();
	await flatCard.getByRole('button', { name: 'Voir détails' }).click();
	const dd = page.locator('[role="dialog"]').last();
	await dd.waitFor({ state: 'visible' });
	await dd.getByRole('tab', { name: 'Sécurité' }).click();
	await dd.getByRole('button', { name: 'Générer un lien' }).click();
	const invite = page.getByRole('dialog', { name: 'Invitation' });
	await invite.waitFor({ state: 'visible' });
	await page.waitForTimeout(400);
	await invite.screenshot({ path: '/tmp/shot-dlg-invite.png' });
	await page.keyboard.press('Escape');
	await page.keyboard.press('Escape');

	// 4. generic confirm (flat delete, no confirm)
	await flatCard.getByRole('button', { name: 'Voir détails' }).click();
	const dd2 = page.locator('[role="dialog"]').last();
	await dd2.waitFor({ state: 'visible' });
	await dd2.evaluate((d) => d.scrollTo(0, d.scrollHeight));
	await dd2.getByRole('button', { name: 'Supprimer le lot' }).click();
	const alert = page.locator('[role="alertdialog"]');
	await alert.waitFor({ state: 'visible' });
	await page.waitForTimeout(400);
	await alert.screenshot({ path: '/tmp/shot-dlg-confirm.png' });
	await page.keyboard.press('Escape');
	await page.keyboard.press('Escape');

	// 5. approval conflict (B06 requests bound spot 03)
	const reqRow = page.locator('div.rounded-md.border.border-dashed').filter({ hasText: 'B06' });
	await reqRow.getByRole('button', { name: 'Approuver' }).click();
	const conflict = page.locator('[role="alertdialog"]');
	await conflict.waitFor({ state: 'visible' });
	await page.waitForTimeout(400);
	await conflict.screenshot({ path: '/tmp/shot-dlg-approveconflict.png' });
	await browser.close();
	console.log('admin dialogs done');
}
