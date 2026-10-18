import { describe, expect, it } from 'vitest';
import { buildActivationEmail } from './activation';
import { buildBookingCancelledEmail, buildBookingConfirmationEmail, buildBookingMovedEmail } from './bookings';
import { buildLotDeletedEmail } from './lots';
import { buildRejectionEmail } from './requests';

describe('shared shell', () => {
	const allHtml = () => [
		buildActivationEmail('B12', '1234', 'https://x.test/activate?flat=B12&code=1234').html,
		buildBookingConfirmationEmail(
			{ spotNumber: '36', flatNumber: 'B12', startTime: '2026-07-24T14:00:00', endTime: '2026-07-24T16:00:00' },
			'https://x.test/my-bookings?booking=7'
		).html,
		buildBookingCancelledEmail({
			spotNumber: '36',
			flatNumber: 'B12',
			startTime: '2026-07-24T14:00:00',
			endTime: '2026-07-24T16:00:00'
		}).html,
		buildBookingMovedEmail(
			{ spotNumber: '36', flatNumber: 'B12', startTime: '2026-07-24T14:00:00', endTime: '2026-07-24T16:00:00' },
			'2026-07-24T10:00:00',
			'2026-07-24T12:00:00'
		).html,
		buildRejectionEmail('Dupont').html,
		buildLotDeletedEmail('B07').html
	];

	it('every mail shares header, footer and dark-mode support', () => {
		for (const html of allHtml()) {
			expect(html).toContain('Gestion de parkings partagés');
			expect(html).toContain('prefers-color-scheme');
			expect(html).not.toContain('Votre place de parking partagée');
			// Compact header: tight padding, no tagline fat
			expect(html).toContain('class="header" style="background-color:');
			expect(html).toContain('padding:20px;');
		}
	});

	it('embeds the header badge by content id with a text fallback', () => {
		for (const html of allHtml()) {
			expect(html).toContain('src="cid:creneau-logo"');
			expect(html).toContain('alt="Créneau"');
			expect(html).toContain('width="40"');
			expect(html).toContain('height="40"');
		}
	});

	it('renders a fluid card capped at 480px (no fixed width to overflow phones)', () => {
		for (const html of allHtml()) {
			expect(html).toContain('class="card" role="presentation" width="100%"');
			expect(html).toContain('max-width:480px;');
			expect(html).not.toContain('width="480"');
		}
	});

	it('links the footer brand to the guide when a host is known', () => {
		const linked = buildBookingConfirmationEmail(
			{ spotNumber: '36', flatNumber: 'B12', startTime: '2026-07-24T14:00:00', endTime: '2026-07-24T16:00:00' },
			'https://x.test/my-bookings?booking=7'
		).html;
		expect(linked).toContain('href="https://x.test/guide"');

		const plain = buildBookingCancelledEmail({
			spotNumber: '36',
			flatNumber: 'B12',
			startTime: '2026-07-24T14:00:00',
			endTime: '2026-07-24T16:00:00'
		}).html;
		expect(plain).toContain('Créneau — Gestion de parkings partagés');
		expect(plain).not.toContain('/guide"');
	});
});

describe('tinted info block', () => {
	const booking = {
		spotNumber: '36',
		flatNumber: 'B12',
		startTime: '2026-07-24T14:00:00',
		endTime: '2026-07-24T16:00:00'
	};

	it('wraps the booking summary in the three booking mails', () => {
		const bodies = [
			buildBookingConfirmationEmail(booking, 'https://x.test/my-bookings?booking=7').html,
			buildBookingCancelledEmail(booking).html,
			buildBookingMovedEmail(booking, '2026-07-24T10:00:00', '2026-07-24T12:00:00').html
		];
		for (const html of bodies) {
			expect(html).toContain('class="code-bg"');
		}
	});

	it('tints rejection rows only when present', () => {
		expect(buildRejectionEmail('Dupont').html).not.toContain('class="code-bg"');
		expect(buildRejectionEmail('Dupont', null, 'B07').html).not.toContain('class="code-bg"');
		expect(buildRejectionEmail('Dupont', 'Complet', null).html).toContain('class="code-bg"');
	});
});

describe('shared contact footer', () => {
	const CONTACT = 'Pour toute question, rapprochez-vous du conseil syndical.';
	const booking = {
		spotNumber: '36',
		flatNumber: 'B12',
		startTime: '2026-07-24T14:00:00',
		endTime: '2026-07-24T16:00:00'
	};

	it('signs every mail with the contact line in html and text, never gestionnaire', () => {
		const bodies = [
			buildActivationEmail('B12', '1234', 'https://x.test/activate?flat=B12&code=1234'),
			buildRejectionEmail('Dupont'),
			buildLotDeletedEmail('B07'),
			buildBookingConfirmationEmail(booking, 'https://x.test/my-bookings?booking=7'),
			buildBookingCancelledEmail(booking),
			buildBookingMovedEmail(booking, '2026-07-24T10:00:00', '2026-07-24T12:00:00')
		];
		for (const { text, html } of bodies) {
			expect(text).toContain(CONTACT);
			expect(html).toContain(CONTACT);
			expect(text).not.toContain('gestionnaire');
			expect(html).not.toContain('gestionnaire');
		}
	});

	it('renders no empty note paragraph or orphan separator in note-less mails', () => {
		for (const { html } of [
			buildRejectionEmail('Dupont'),
			buildLotDeletedEmail('B07'),
			buildBookingConfirmationEmail(booking, 'https://x.test/my-bookings?booking=7'),
			buildBookingCancelledEmail(booking),
			buildBookingMovedEmail(booking, '2026-07-24T10:00:00', '2026-07-24T12:00:00')
		]) {
			expect(html).not.toMatch(/<p class="muted" style="margin:0;color:[^"]*"><\/p>/);
			expect(html).not.toContain('class="divider"');
		}
		expect(buildBookingConfirmationEmail(booking, 'https://x.test/my-bookings?booking=7').html).toContain(CONTACT);
	});
});
