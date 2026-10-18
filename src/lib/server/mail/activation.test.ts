import { describe, expect, it } from 'vitest';
import { buildActivationEmail } from './activation';

describe('buildActivationEmail', () => {
	it('includes flat, code, and link in subject/text/html', () => {
		const { subject, text, html } = buildActivationEmail('B12', '1234', 'https://x.test/activate?flat=B12&code=1234');
		expect(subject).toContain('activation');
		expect(text).toContain('B12');
		expect(text).toContain('1234');
		expect(text).toContain('https://x.test/activate?flat=B12&code=1234');
		expect(html).toContain('https://x.test/activate?flat=B12&amp;code=1234');
	});

	it('escapes HTML in the display name (XSS via flat number)', () => {
		const evil = '<script>alert(1)</script>';
		const { html, text } = buildActivationEmail(evil, '1234', 'https://x.test/');
		expect(html).not.toContain('<script>');
		expect(html).toContain('&lt;script&gt;');
		expect(text).toContain(evil);
	});

	it('announces the lot with the expiry notice and no validity block', () => {
		const { text, html } = buildActivationEmail('B07', '1234', 'https://x.test/activate?flat=B07&code=1234');
		expect(text).toContain('Votre lot B07 est prêt à être activé');
		expect(text).toContain('Le code suivant expirera dans 24 heures.');
		expect(text).not.toContain('Ce code est valable');
		expect(text).not.toContain('ignorer cet email');
		expect(html).toContain('est prêt à être activé');
		expect(html).toContain('Le code suivant expirera dans 24 heures.');
		expect(html).not.toContain('Ce code est valable');
		expect(html).not.toContain('class="divider"');
		expect(html).not.toContain('ignorer cet email');
		// The guide stays one click away via the shared footer brand link
		expect(text).toContain('Guide : https://x.test/guide');
		expect(html).toContain('href="https://x.test/guide"');
	});

	it('keeps its code block and CTA', () => {
		const { html } = buildActivationEmail('B12', '1234', 'https://x.test/activate?flat=B12&code=1234');
		expect(html).toContain('1234');
		expect(html).toContain('Activer mon compte');
		expect(html).toContain('expirera dans');
	});
});
