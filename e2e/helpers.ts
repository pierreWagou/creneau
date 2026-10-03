import type { APIRequestContext, Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export const ADMIN_FLAT = 'B12';
export const ADMIN_PIN = '0000';
export const TEST_SPOT = '36';

export const TEST_FLATS = [
	{ number: 'A01', pin: '1234' },
	{ number: 'A02', pin: '1234' },
	{ number: 'A03', pin: '1234' },
	{ number: 'A04', pin: '1234' }
];

const FREEZE_CSS = `*,*::before,*::after{transition-duration:.01ms!important;transition-delay:0s!important;animation-duration:.01ms!important;animation-delay:0s!important}`;

/** Zero out CSS transitions/animations on every document load in this context.
 *  Bits-ui presence (drawers/dialogs) unmounts on animation end — under CI/load
 *  starved frames stall exit animations and `not.toBeVisible` flakes. Visual
 *  flight animations are WAAPI-driven and unaffected; e2e asserts behavior,
 *  not motion smoothness. Idempotent per context. */
export async function freezeAnimations(page: Page) {
	const ctx = page.context();
	await ctx.addInitScript((css: string) => {
		const apply = () => {
			if (document.getElementById('e2e-freeze')) return;
			const style = document.createElement('style');
			style.id = 'e2e-freeze';
			style.textContent = css;
			(document.head || document.documentElement).appendChild(style);
		};
		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', apply, { once: true });
		} else {
			apply();
		}
	}, FREEZE_CSS);
}

/** Navigate to a path and wait for hydration.
 *  Uses networkidle for auth pages (no SSE), load + small delay for app pages (SSE keeps connection open). */
export async function navigateTo(page: Page, path: string) {
	await freezeAnimations(page);
	await page.goto(path);
	// Pages with SSE (/calendar, /book, /my-bookings) never reach networkidle
	// because EventSource keeps a connection open. Use load + brief wait instead.
	const hasSSE = /\/(calendar|book|my-bookings)/.test(path);
	if (hasSSE) {
		await page.waitForLoadState('load');
		await page.waitForTimeout(200);
	} else {
		await page.waitForLoadState('networkidle');
	}
}

export async function login(page: Page, flat: string, pin: string) {
	await navigateTo(page, '/login');
	await page.fill('[id="flat"]', flat);
	// Close the combobox dropdown (if open) before proceeding — prevents bits-ui from
	// resetting flatNumber via the binding when the dropdown closes on PIN focus.
	await page.keyboard.press('Escape');
	await page.fill('[id="pin"]', pin);
	await page.click('button[type="submit"]');
	await page.waitForURL('/calendar');
}

export async function getSessionCookie(page: Page): Promise<string> {
	const cookies = await page.context().cookies();
	const session = cookies.find((c) => c.name === 'session');
	return session ? `session=${session.value}` : '';
}

/** Pre-create spots via the admin API and pool them (idempotent — 409s ignored).
 *  Creation lands spots unassigned; requests and picker adds need them shared. */
export async function ensureSpots(page: Page, numbers: string[]) {
	for (const number of numbers) {
		await page.request.post('/api/spots', { data: { number } });
		await page.request.patch(`/api/spots/${number}`, { data: { status: 'shared' } });
	}
}

/** Add a spot through the constrained picker popover (spot must exist — use ensureSpots first).
 *  The "+" tile is scoped (dialog/drawer/page); grid chips live in a portaled
 *  popover so they are always located from the page. Clicks real chip buttons
 *  (no typed-entry race), expanding Libres→Toutes and the preview limit as
 *  needed. Fails fast if the picker doesn't close on select. */
export async function addSpotViaPicker(page: Page, scopeOrSpot: Page | Locator | string, spotNumber?: string) {
	const scope: Page | Locator = typeof scopeOrSpot === 'string' ? page : scopeOrSpot;
	const number = typeof scopeOrSpot === 'string' ? scopeOrSpot : (spotNumber as string);
	const addTile = scope.getByRole('button', { name: 'Ajouter une place' });
	// Drawers use a sticky header that can cover the tile after auto-scroll —
	// center it first so the click isn't intercepted.
	await addTile.evaluate((e) => e.scrollIntoView({ block: 'center' }));
	await addTile.click();
	const exactName = `Choisir la place ${number}`;
	let chip = page.getByRole('button', { name: exactName, exact: true });
	if ((await chip.count()) === 0) {
		await page.getByRole('tab', { name: 'Toutes' }).click();
		chip = page.getByRole('button', {
			name: new RegExp(`^(Choisir la place ${number}|Place ${number},)`)
		});
	}
	if ((await chip.count()) === 0) {
		await page.getByRole('button', { name: 'Afficher plus de places' }).click();
	}
	await chip.first().click();
	// Grid chips live only in the portaled popover — their removal proves it
	// closed. (The typed-entry input may stay rendered when the tile keeps
	// focus, so it can't serve as the close signal.)
	await expect(chip).toHaveCount(0, { timeout: 5000 });
}

export async function createBookingViaAPI(
	request: APIRequestContext,
	cookies: string,
	spot: string,
	startTime: string,
	endTime: string,
	note?: string
) {
	return request.post('/api/bookings', {
		headers: { 'Content-Type': 'application/json', Cookie: cookies },
		data: { spotNumber: spot, startTime, endTime, note: note || null }
	});
}

export async function cancelBookingViaAPI(request: APIRequestContext, cookies: string, bookingId: number) {
	return request.delete(`/api/bookings/${bookingId}`, {
		headers: { Cookie: cookies }
	});
}

export function getTomorrowDate(): string {
	const d = new Date();
	d.setDate(d.getDate() + 1);
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

export function getDatePlusDays(days: number): string {
	const d = new Date();
	d.setDate(d.getDate() + days);
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}
