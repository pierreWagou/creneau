import { describe, expect, it } from 'vitest';
import { buildLotDeletedEmail } from './lots';

describe('buildLotDeletedEmail', () => {
	it('states the deletion with the lot number', () => {
		const { subject, text, html } = buildLotDeletedEmail('B07');
		expect(subject).toContain('supprimé');
		expect(text).toContain('Votre lot B07 a été supprimé de Créneau.');
		expect(html).toContain('Votre lot B07 a été supprimé de Créneau.');
		expect(html).toContain('Lot supprimé');
	});

	it('renders notice-only with no frame, CTA, or separator', () => {
		const { html } = buildLotDeletedEmail('B07');
		expect(html).not.toContain('class="code-bg"');
		expect(html).not.toContain('class="divider"');
	});

	it('offers no booking-style CTA (the lot is gone)', () => {
		const { html } = buildLotDeletedEmail('B07');
		expect(html).not.toContain('Voir ma réservation');
		expect(html).not.toContain('my-bookings?booking=');
	});

	it('escapes the lot number', () => {
		const { text, html } = buildLotDeletedEmail('<b>B07</b>');
		expect(html).not.toContain('<b>B07</b>');
		expect(html).toContain('&lt;b&gt;B07&lt;/b&gt;');
		expect(text).toContain('<b>B07</b>');
	});
});
