import { chromium } from '@playwright/test';

async function shot(scheme: 'dark', width: number, name: string, scrollDown: boolean) {
	const browser = await chromium.launch();
	const ctx = await browser.newContext({
		colorScheme: scheme,
		viewport: { width, height: width < 640 ? 844 : 900 }
	});
	const login = await ctx.request.post('http://localhost:5176/api/auth/login', {
		data: { flatNumber: 'A00', pin: '1234' }
	});
	if (login.status() !== 200) {
		console.log(name, 'login failed');
		await browser.close();
		return;
	}
	const page = await ctx.newPage();
	page.setDefaultTimeout(10000);
	await page.goto('http://localhost:5176/admin');
	await page.waitForTimeout(1000);
	const flatCard = page.locator('div.rounded-md.border').filter({ hasText: 'Actif' }).first();
	await flatCard.getByRole('button', { name: 'Voir détails' }).click();
	const drawer = page.locator('[role="dialog"]').last();
	await drawer.waitFor({ state: 'visible' });
	await page.waitForTimeout(500);
	if (scrollDown) {
		await drawer
			.locator('div.overflow-y-auto')
			.first()
			.evaluate((d) => d.scrollTo(0, 600));
		await page.waitForTimeout(400);
	}
	await drawer.screenshot({ path: `/tmp/shot-sticky-${name}.png` });
	await browser.close();
	console.log(name, 'done');
}

await shot('dark', 390, 'mobile-scrolled', true);
await shot('dark', 390, 'mobile-top', false);
await shot('dark', 1280, 'desktop-scrolled', true);
