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
	// Pages with SSE (/calendar, /book, /my-bookings, /admin/bookings) never reach networkidle
	// because EventSource keeps a connection open. Use load + brief wait instead.
	const hasSSE = /\/(calendar|book|my-bookings|admin\/bookings)/.test(path);
	if (hasSSE) {
		await page.waitForLoadState('load');
		await page.waitForTimeout(200);
	} else {
		await page.waitForLoadState('networkidle');
	}
}

export async function login(page: Page, flat: string, pin: string) {
	// Start from a clean session: /login redirects already-authenticated
	// users to /calendar (SSE open — networkidle would hang), so a re-login
	// against a live session would silently no-op or stall.
	await page.context().clearCookies();
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

/** Drag a mercato chip onto a drop zone with real mouse input.
 *  Both ends are scrolled into view first: svelte-dnd-action resolves the
 *  drop target under the cursor, so a below-the-fold target would otherwise
 *  miss (mousedown lands on <html>). locator.dragTo can't be used — it
 *  targets element centers without scrolling, and column wrappers are not
 *  zones (only the chips container receives drops). */
export async function boardDrag(page: Page, board: Locator, chipName: string, zoneTestId: string) {
	const src = board.getByLabel(chipName, { exact: true });
	const tgt = board.getByTestId(zoneTestId);
	// Centre both endpoints in the viewport: svelte-dnd-action's multi-scroller
	// auto-scrolls when the cursor dwells near a viewport edge, which shifts
	// the pre-measured drop point off the zone (silent no-op drop at origin).
	await src.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
	await tgt.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
	const sb = await src.boundingBox();
	const tb = await tgt.boundingBox();
	if (!sb || !tb) throw new Error(`boardDrag: no box for ${chipName} → ${zoneTestId}`);
	const sx = sb.x + sb.width / 2;
	const sy = sb.y + sb.height / 2;
	const tx = tb.x + tb.width / 2;
	const ty = tb.y + tb.height / 2;
	await page.mouse.move(sx, sy);
	await page.mouse.down();
	// Step timing matters: svelte-dnd-action detects zone entry on an
	// observation tick (~107ms cadence), not on mousemove — steps slower
	// than the tick risk the drag ending before any tick lands inside the
	// target zone (silent no-op drop back at the origin).
	for (let i = 1; i <= 10; i++) {
		await page.mouse.move(sx + ((tx - sx) * i) / 10, sy + ((ty - sy) * i) / 10, { steps: 3 });
		await page.waitForTimeout(150);
	}
	await page.mouse.up();
	// svelte-dnd-action arms and tracks on real mouse input, but a real
	// CDP mouseup never reaches its window-level drop listener (the
	// library preventDefaults the arming mousedown), so the release is
	// re-fired synthetically — the whole consider/finalize/commit path
	// below it is still genuinely exercised.
	await page.evaluate(() => {
		window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }));
	});
}

/** Create a lot via the admin API (fixture — no UI dialog choreography).
 *  Spots must already exist (use ensureSpots first or pass raw numbers for limbo). */
export async function createFlatViaAPI(
	request: APIRequestContext,
	data: { number: string; spotNumbers: string[]; emails?: string[]; phones?: string[] }
) {
	const res = await request.post('/api/admin/flats', {
		data: {
			emails: [`${data.number.toLowerCase()}@test.com`],
			phones: ['+33612345678'],
			...data
		}
	});
	expect(res.ok()).toBe(true);
	return res.json();
}

/** Pre-create spots via the admin API and pool them (idempotent — 409s ignored).
 *  Creation lands spots unassigned; requests and picker adds need them shared. */ export async function ensureSpots(
	page: Page,
	numbers: string[]
) {
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

/** The create-lot flow chains into the invite modal — dismiss it before continuing. */
export async function dismissInviteModal(page: Page) {
	const inviteDialog = page.getByRole('dialog', { name: 'Invitation' });
	await expect(inviteDialog).toBeVisible({ timeout: 5000 });
	await page.keyboard.press('Escape');
	await expect(inviteDialog).not.toBeVisible({ timeout: 10000 });
}

/**
 * Ensure the flat in an open detail drawer has an invitation code,
 * generating one only when codeless (the create flow usually beat us to it).
 * Leaves the invite modal open with the activation URL.
 */
export async function ensureInviteCode(page: Page, detailDialog: Locator) {
	const generateBtn = detailDialog.getByRole('button', { name: 'Générer un lien' });
	if ((await generateBtn.count()) > 0) {
		await generateBtn.click();
		await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'activation' }).first()).toBeVisible({
			timeout: 5000
		});
	} else {
		await detailDialog.getByRole('button', { name: "Voir l'invitation" }).click();
	}
	const inviteDialog = page.getByRole('dialog', { name: 'Invitation' });
	await expect(inviteDialog).toBeVisible({ timeout: 5000 });
}

/**
 * Fill an inline editor and commit with Enter, tolerating a blur-commit
 * that fires first: dialog focus settling can steal focus and commit a
 * valid draft before Enter lands. Either path ends committed.
 */
export async function fillAndCommit(locator: Locator, value: string) {
	await locator.fill(value);
	await locator.press('Enter').catch(() => {});
}
