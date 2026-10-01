import { chromium } from '@playwright/test';

for (const [width, name] of [
	[390, 'mobile'],
	[1280, 'desktop']
] as const) {
	const browser = await chromium.launch();
	const ctx = await browser.newContext({ colorScheme: 'dark', viewport: { width, height: 900 } });
	const login = await ctx.request.post('http://localhost:5176/api/auth/login', {
		data: { flatNumber: 'A00', pin: '1234' }
	});
	if (login.status() !== 200) {
		console.log(name, 'login failed');
		await browser.close();
		continue;
	}
	const page = await ctx.newPage();
	page.setDefaultTimeout(10000);
	await page.goto('http://localhost:5176/admin');
	await page.waitForTimeout(1200);
	const geom = await page.evaluate(() => {
		const group = document.querySelector('[aria-label="Filtrer par statut"]') as HTMLElement | null;
		if (!group) return null;
		return { scrollW: group.scrollWidth, clientW: group.clientWidth, fits: group.scrollWidth <= group.clientWidth + 1 };
	});
	console.log(name, JSON.stringify(geom));
	const card = page.locator('[data-slot="card"]').filter({ hasText: 'Gérez les lots' }).first();
	await card.scrollIntoViewIfNeeded();
	await card.screenshot({ path: `/tmp/shot-row-${name}.png` });
	await browser.close();
	console.log(name, 'done');
}
