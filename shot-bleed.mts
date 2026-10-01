import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const ctx = await browser.newContext({ colorScheme: 'dark', viewport: { width: 390, height: 600 } });
await ctx.request.post('http://localhost:5176/api/auth/login', { data: { flatNumber: 'A00', pin: '1234' } });
const page = await ctx.newPage();
page.setDefaultTimeout(10000);
await page.goto('http://localhost:5176/admin');
await page.waitForTimeout(1000);
const flatCard = page.locator('div.rounded-md.border').filter({ hasText: 'Actif' }).first();
await flatCard.getByRole('button', { name: 'Voir détails' }).click();
const drawer = page.locator('[role="dialog"]').last();
await drawer.waitFor({ state: 'visible' });
await page.waitForTimeout(800);
await drawer
	.locator('div.overflow-y-auto')
	.first()
	.evaluate((d) => d.scrollTo(0, 700));
await page.waitForTimeout(600);
await drawer.screenshot({ path: '/tmp/shot-bleed.png' });
// Measure: shell top vs scrollport top (gap?), shell bg, and sample for text nodes in the strip zone
const info = await drawer.evaluate(() => {
	const shell = document.querySelector('div.sticky.top-0.z-10') as HTMLElement | null;
	const scroller = document.querySelector('div.overflow-y-auto') as HTMLElement | null;
	if (!shell || !scroller) return { found: false };
	const sr = shell.getBoundingClientRect();
	const cr = scroller.getBoundingClientRect();
	const cs = getComputedStyle(shell);
	return {
		found: true,
		shellTopVsScrollportTop: Math.round(sr.top - cr.top),
		shellBg: cs.backgroundColor,
		marginTop: cs.marginTop
	};
});
console.log(JSON.stringify(info));
await browser.close();
console.log('done');
