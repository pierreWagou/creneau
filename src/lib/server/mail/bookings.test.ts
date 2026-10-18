import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { latte, mocha } from '$lib/colors';
import { buildActivationEmail } from './activation';
import { buildBookingCancelledEmail, buildBookingConfirmationEmail, buildBookingMovedEmail } from './bookings';

const SLOT = {
	spotNumber: '36',
	flatNumber: 'B12',
	startTime: '2026-07-24T14:00:00',
	endTime: '2026-07-24T16:00:00'
};

describe('buildBookingConfirmationEmail', () => {
	it('includes spot and slot in subject/text/html', () => {
		const { subject, text, html } = buildBookingConfirmationEmail(SLOT, 'https://x.test/my-bookings?booking=7');
		expect(subject).toContain('36');
		expect(text).toContain('36');
		expect(text).toContain('14:00');
		expect(text).toContain('https://x.test/my-bookings?booking=7');
		expect(text).not.toContain('Présentez-vous');
		expect(html).toContain('36');
		expect(html).toContain('my-bookings?booking=7');
		expect(html).toContain('La réservation suivante a été confirmée :');
	});

	it('links directly to the booking', () => {
		const { text, html } = buildBookingConfirmationEmail(SLOT, 'https://x.test/my-bookings?booking=7');
		expect(html).toContain('Voir ma réservation');
		expect(html).toContain('href="https://x.test/my-bookings?booking=7"');
		expect(text).toContain('Lien vers votre réservation : https://x.test/my-bookings?booking=7');
	});

	it('shares the activation button markup', () => {
		const confirmation = buildBookingConfirmationEmail(SLOT, 'https://x.test/my-bookings?booking=7').html;
		const activation = buildActivationEmail('B12', '1234', 'https://x.test/activate?flat=B12&code=1234').html;
		expect(confirmation).toContain('padding:14px 32px');
		expect(activation).toContain('padding:14px 32px');
	});

	it('leaves no bottom margin under the CTA (cell padding owns the footer gap)', () => {
		const confirmation = buildBookingConfirmationEmail(SLOT, 'https://x.test/my-bookings?booking=7').html;
		expect(confirmation).toContain('margin:24px 0 0;');
		expect(confirmation).not.toContain('margin:24px 0;');
	});

	it('renders the spot chip over a badge slot line', () => {
		const { html, text } = buildBookingConfirmationEmail(SLOT, 'https://x.test/my-bookings?booking=7');
		expect(html).toContain('border-radius:10px');
		expect(html).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
		expect(html).toContain('&nbsp;36</span>');
		// Badge: upper month, big day, weekday, hours — date shown once
		expect(html).toContain('>JUIL</td>');
		expect(html).toContain('>24</td>');
		expect(html).toContain('border-radius:0 0 6px 6px');
		expect(html).toContain('M12 6v6l4 2');
		expect(html).toContain('width="16" height="16"');
		expect(html).not.toContain('Vendredi');
		expect(html).toContain('14:00 → 16:00');
		expect(html).toContain('→ 16:00');
		expect(html).toContain('<span class="body-text" style="font-size:18px;');
		expect(html).toContain('Place réservée');
		expect(html).toContain('Créneau</p>');
		expect(html).not.toContain('24 juil., 14:00');
		// Text version stays plain
		expect(text).toContain('Place : 36');
	});

	it('renders double badges spanning days', () => {
		const span = { ...SLOT, startTime: '2026-07-24T18:00:00', endTime: '2026-07-25T10:00:00' };
		const { html } = buildBookingConfirmationEmail(span, 'https://x.test/my-bookings?booking=7');
		expect(html).toContain('>JUIL</td>');
		expect(html).toContain('>24</td>');
		expect(html).toContain('>25</td>');
		expect(html).toContain('18:00</span>');
		expect(html).toContain('10:00</span>');
		// Stacked groups with a connector — no side-by-side arrow row to overflow phones
		expect(html).toContain('↓');
		expect(html).not.toContain('padding:0 10px');
	});

	it('tracks the installed Lucide clock artwork', () => {
		const source = readFileSync('node_modules/@lucide/svelte/dist/icons/clock.svelte', 'utf8');
		const raw = source.match(/const iconNode = (\[.*?\]);/s)?.[1];
		expect(raw).toBeDefined();
		const values = new Set<string>();
		for (const [, attrs] of JSON.parse(raw!) as [string, Record<string, string>][]) {
			for (const v of Object.values(attrs)) values.add(v);
		}
		expect(values.size).toBeGreaterThan(0);
		const { html } = buildBookingConfirmationEmail(SLOT, 'https://x.test/my-bookings?booking=7');
		for (const v of values) expect(html).toContain(v);
	});

	it('covers the badge in dark mode', () => {
		const { html } = buildBookingConfirmationEmail(SLOT, 'https://x.test/my-bookings?booking=7');
		expect(html).toContain('.badge-month');
		expect(html).toContain('.badge-day');
	});

	it('tracks the installed Lucide car-front artwork', () => {
		const source = readFileSync('node_modules/@lucide/svelte/dist/icons/car-front.svelte', 'utf8');
		const raw = source.match(/const iconNode = (\[.*?\]);/s)?.[1];
		expect(raw).toBeDefined();
		const values = new Set<string>();
		for (const [, attrs] of JSON.parse(raw!) as [string, Record<string, string>][]) {
			for (const v of Object.values(attrs)) values.add(v);
		}
		expect(values.size).toBeGreaterThan(0);
		const { html } = buildBookingConfirmationEmail(SLOT, 'https://x.test/my-bookings?booking=7');
		for (const v of values) expect(html).toContain(v);
	});

	it('covers the chip in dark mode with the dark primary', () => {
		const { html } = buildBookingConfirmationEmail(SLOT, 'https://x.test/my-bookings?booking=7');
		expect(html).toContain('.chip { background-color: transparent');
		expect(html).toContain(mocha.blue);
	});

	it('escapes the spot number in the chip', () => {
		const evil = { ...SLOT, spotNumber: '<b>36</b>' };
		const { html } = buildBookingCancelledEmail(evil);
		expect(html).not.toContain('<b>36</b>');
		expect(html).toContain('&lt;b&gt;36&lt;/b&gt;');
	});

	it('move mail stacks old/new labeled slots under one chip', () => {
		const { html } = buildBookingMovedEmail(SLOT, '2026-07-24T10:00:00', '2026-07-24T12:00:00');
		expect(html).toContain('Ancien créneau');
		expect(html).toContain('Nouveau créneau');
		expect(html).toContain('&nbsp;36</span>');
	});
});

describe('buildBookingCancelledEmail', () => {
	it('states the cancellation and slot with one neutral intro', () => {
		for (const byOwner of [false, true]) {
			const { subject, text, html } = buildBookingCancelledEmail(SLOT, byOwner);
			expect(subject).toContain('annulée');
			expect(text).toContain('La réservation suivante a été annulée :');
			expect(text).not.toContain('administrateur');
			expect(text).not.toContain('a bien été');
			expect(text).toContain('36');
			expect(html).toContain('La réservation suivante a été annulée :');
		}
	});

	it('links to the booking below the frame when a manage URL is given', () => {
		const manageUrl = 'https://x.test/my-bookings?booking=7';
		const { text, html } = buildBookingCancelledEmail(SLOT, false, null, manageUrl);
		expect(text).toContain(`Lien vers votre réservation : ${manageUrl}`);
		expect(html).toContain(`href="${manageUrl}"`);
		expect(html).toContain('Voir ma réservation');

		const { text: noLinkText, html: noLinkHtml } = buildBookingCancelledEmail(SLOT);
		expect(noLinkText).not.toContain('Lien vers votre réservation');
		expect(noLinkHtml).not.toContain('Voir ma réservation');
	});

	it('words self-moves with the same neutral intro as admin moves', () => {
		const admin = buildBookingMovedEmail(SLOT, '2026-07-24T10:00:00', '2026-07-24T12:00:00');
		expect(admin.text).toContain('La réservation suivante a été modifiée :');
		expect(admin.text).not.toContain('administrateur');
		const own = buildBookingMovedEmail(SLOT, '2026-07-24T10:00:00', '2026-07-24T12:00:00', true);
		expect(own.text).toContain('La réservation suivante a été modifiée :');
		expect(own.text).not.toContain('a bien été');
	});

	it('links a moved booking below the frame when a manage URL is given', () => {
		const manageUrl = 'https://x.test/my-bookings?booking=7';
		const { text, html } = buildBookingMovedEmail(
			SLOT,
			'2026-07-24T10:00:00',
			'2026-07-24T12:00:00',
			false,
			null,
			manageUrl
		);
		expect(text).toContain(`Lien vers votre réservation : ${manageUrl}`);
		expect(html).toContain(`href="${manageUrl}"`);
		expect(html).toContain('Voir ma réservation');
	});
});

describe('buildBookingMovedEmail', () => {
	it('states old and new slots', () => {
		const { subject, text, html } = buildBookingMovedEmail(SLOT, '2026-07-24T10:00:00', '2026-07-24T12:00:00');
		expect(subject).toContain('modifiée');
		expect(text).toContain('10:00');
		expect(text).toContain('14:00');
		expect(html).toContain('Ancien créneau');
		expect(html).toContain('Nouveau créneau');
	});

	it('renders a folded midnight end as same-day 24:00', () => {
		const evening = { ...SLOT, startTime: '2026-10-15T18:00:00', endTime: '2026-10-15T24:00:00' };
		const { text } = buildBookingConfirmationEmail(evening, 'https://x.test/my-bookings?booking=7');
		expect(text).toContain('15 oct., 24:00');
		expect(text).not.toContain('16 oct.');
	});
});

describe('moved booking mail', () => {
	const booking = {
		spotNumber: '36',
		flatNumber: 'B12',
		startTime: '2026-07-24T14:00:00',
		endTime: '2026-07-24T16:00:00'
	};

	it('shows no Lot line — spot and slots only', () => {
		const bodies = [
			buildBookingConfirmationEmail(booking, 'https://x.test/my-bookings?booking=7'),
			buildBookingCancelledEmail(booking),
			buildBookingMovedEmail(booking, '2026-07-24T10:00:00', '2026-07-24T12:00:00')
		];
		for (const { text, html } of bodies) {
			expect(text).not.toContain('Lot :');
			expect(html).not.toContain('>Lot</p>');
		}
	});

	it('keeps the Place caption above the chip in the moved mail', () => {
		const { html } = buildBookingMovedEmail(booking, '2026-07-24T10:00:00', '2026-07-24T12:00:00');
		expect(html).toContain('>Place réservée</p>');
	});

	it('renders old→new spot chips and text lines on a cross-spot move', () => {
		const { text, html } = buildBookingMovedEmail(
			booking,
			'2026-07-24T10:00:00',
			'2026-07-24T12:00:00',
			false,
			null,
			null,
			'37'
		);
		expect(text).toContain('Place : 36');
		expect(text).toContain('Ancienne place : 37');
		expect(html).toContain('&nbsp;37</span>');
		expect(html).toContain('&nbsp;36</span>');
		expect(html).toContain('&nbsp;→&nbsp;');
	});

	it('renders a single chip when the spot is unchanged', () => {
		const same = buildBookingMovedEmail(booking, '2026-07-24T10:00:00', '2026-07-24T12:00:00', false, null, null, '36');
		expect(same.text).not.toContain('Ancienne place');
		expect(same.html.match(/&nbsp;36<\/span>/g)).toHaveLength(1);
		expect(same.html).not.toContain('&nbsp;→&nbsp;');
	});
});

describe('void treatment', () => {
	const booking = {
		spotNumber: '36',
		flatNumber: 'B12',
		startTime: '2026-07-24T14:00:00',
		endTime: '2026-07-24T16:00:00'
	};

	it('renders cancelled blocks void and live blocks live', () => {
		const cancelled = buildBookingCancelledEmail(booking).html;
		expect(cancelled).toContain('chip chip-disabled');
		expect(cancelled).toContain('text-decoration:line-through');
		expect(cancelled).toContain(latte.overlay0);

		const live = buildBookingConfirmationEmail(booking, 'https://x.test/my-bookings?booking=7').html;
		expect(live).toContain('class="chip" style=');
		expect(live).not.toContain('chip chip-disabled');
		expect(live).not.toContain('text-decoration:line-through');
		expect(live).toContain(latte.blue);
	});

	it('voids only the old slot in move mails', () => {
		const { html } = buildBookingMovedEmail(booking, '2026-07-24T10:00:00', '2026-07-24T12:00:00');
		expect(html).toContain('badge-day-disabled');
		expect(html).toContain('text-decoration:line-through');
		// The shared spot chip and the new slot stay live
		expect(html).toContain(`chip" style="display:inline-block;border:1px solid ${latte.blue}`);
		expect(html).toContain('badge-month" align="center"');
	});

	it('covers void variants in dark mode', () => {
		const { html } = buildBookingCancelledEmail(booking);
		expect(html).toContain('.chip-disabled');
		expect(html).toContain('.badge-month-disabled');
		expect(html).toContain('.badge-day-disabled');
		expect(html).toContain('.hours-void');
	});
});
