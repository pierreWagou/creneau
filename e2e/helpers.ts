import type { APIRequestContext, Page } from '@playwright/test';

export const ADMIN_FLAT = 'B12';
export const ADMIN_PIN = '0000';
export const TEST_SPOT = '36';

export const TEST_FLATS = [
	{ number: 'A01', pin: '1234' },
	{ number: 'A02', pin: '1234' },
	{ number: 'A03', pin: '1234' },
	{ number: 'A04', pin: '1234' }
];

export async function login(page: Page, flat: string, pin: string) {
	await page.goto('/login');
	await page.fill('[id="flat"]', flat);
	await page.fill('[id="pin"]', pin);
	await page.click('button[type="submit"]');
	await page.waitForURL('/calendar');
}

export async function getSessionCookie(page: Page): Promise<string> {
	const cookies = await page.context().cookies();
	const session = cookies.find((c) => c.name === 'session');
	return session ? `session=${session.value}` : '';
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
		data: { spot, startTime, endTime, note: note || null }
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

export function getDayAfterTomorrowDate(): string {
	const d = new Date();
	d.setDate(d.getDate() + 2);
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}
