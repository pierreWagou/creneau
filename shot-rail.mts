import { chromium } from '@playwright/test';

for (const scheme of ['dark', 'light'] as const) {
	const browser = await chromium.launch();
	const ctx = await browser.newContext({ colorScheme: scheme, viewport: { width: 1280, height: 900 } });
	const login = await ctx.request.post('http://localhost:5176/api/auth/login', {
		data: { flatNumber: 'A00', pin: '1234' }
	});
	if (login.status() !== 200) {
		console.log(scheme, 'login failed');
		await browser.close();
		continue;
	}
	const page = await ctx.newPage();
	page.setDefaultTimeout(10000);
	await page.goto('http://localhost:5176/admin');
	await page.waitForTimeout(1000);
	const row = page.locator('div.rounded-md.border.border-dashed').filter({ hasText: 'B06' });
	await row.getByRole('button', { name: 'Voir détails' }).click();
	const drawer = page.locator('[role="dialog"]').last();
	await drawer.waitFor({ state: 'visible' });
	await page.waitForTimeout(500);
	await drawer.screenshot({ path: `/tmp/shot-rail-${scheme}.png` });
	// Hover the conflicted card (its number) to capture the tooltip
	await drawer.getByText('03', { exact: true }).hover({ force: true });
	await page.waitForTimeout(600);
	await drawer.screenshot({ path: `/tmp/shot-rail-hover-${scheme}.png` });
	await browser.close();
	console.log(scheme, 'done');
}
