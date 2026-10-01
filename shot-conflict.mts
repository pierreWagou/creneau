import { chromium, expect } from '@playwright/test';

// Screenshots: spot drawer per status (light + dark), holder-link landing, mobile.
async function openSpot(browser: any, url: string, spot: string, scheme: 'light' | 'dark', vp: any) {
	const ctx = await browser.newContext({ colorScheme: scheme, viewport: vp });
	const page = await ctx.newPage();
	page.setDefaultTimeout(10000);
	await ctx.request.post('http://localhost:5176/api/auth/login', {
		data: { flatNumber: 'A00', pin: '1234' }
	});
	await page.goto(url);
	await page.waitForTimeout(2500);
	await expect(async () => {
		await expect(page.locator('[data-slot="card"]').filter({ hasText: 'Places de parking' })).toBeVisible({
			timeout: 2000
		});
	}).toPass({ timeout: 20000 });
	return { ctx, page };
}

const browser = await chromium.launch();

// Assigned 82 (light)
{
	const { ctx, page } = await openSpot(browser, 'http://localhost:5176/admin/spots', '82', 'light', {
		width: 1280,
		height: 900
	});
	const card = page.locator('[data-slot="card"]').filter({ hasText: 'Places de parking' });
	await card.getByRole('button', { name: /Attribuées/ }).click();
	await card.getByRole('button', { name: /Voir la place 03/ }).click();
	const drawer = page.locator('[role="dialog"]').last();
	await expect(drawer).toBeVisible({ timeout: 5000 });
	await page.waitForTimeout(400);
	await drawer.screenshot({ path: '/tmp/shot-spot-assigned.png' });

	// Holder link landing
	await drawer.getByRole('link', { name: /A01/ }).click();
	await expect(page).toHaveURL(/\/admin\/lots\?q=A01/, { timeout: 5000 });
	await page.waitForTimeout(400);
	await page.screenshot({ path: '/tmp/shot-spot-holder-jump.png' });
	await ctx.close();
}

// Shared 36 (dark)
{
	const { ctx, page } = await openSpot(browser, 'http://localhost:5176/admin/spots', '36', 'dark', {
		width: 1280,
		height: 900
	});
	const card = page.locator('[data-slot="card"]').filter({ hasText: 'Places de parking' });
	await card.getByRole('button', { name: /Voir la place 36/ }).click();
	const drawer = page.locator('[role="dialog"]').last();
	await expect(drawer).toBeVisible({ timeout: 5000 });
	await page.waitForTimeout(400);
	await drawer.screenshot({ path: '/tmp/shot-spot-shared-dark.png' });
	await ctx.close();
}

// Mobile assigned
{
	const { ctx, page } = await openSpot(browser, 'http://localhost:5176/admin/spots', '82', 'light', {
		width: 390,
		height: 844
	});
	const mcard = page.locator('[data-slot="card"]').filter({ hasText: 'Places de parking' });
	await mcard.getByRole('button', { name: /Attribuées/ }).click();
	await mcard.getByRole('button', { name: /Voir la place 03/ }).click();
	const mdrawer = page.locator('[role="dialog"]').last();
	await expect(mdrawer).toBeVisible({ timeout: 5000 });
	await page.waitForTimeout(400);
	await page.screenshot({ path: '/tmp/shot-spot-mobile.png' });
	await ctx.close();
}

await browser.close();
console.log('spot drawer shots done');
