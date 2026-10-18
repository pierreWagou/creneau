import { describe, expect, it } from 'vitest';
import { buildRejectionEmail } from './requests';

describe('buildRejectionEmail', () => {
	it('greets by name and escapes it in html', () => {
		const named = buildRejectionEmail('Dupont');
		expect(named.subject).toContain('demande');
		expect(named.text).toContain('Dupont');
		const evil = buildRejectionEmail('<b>Bob</b>');
		expect(evil.html).not.toContain('<b>Bob</b>');
		expect(evil.html).toContain('&lt;b&gt;Bob&lt;/b&gt;');
	});

	it('falls back to a bare greeting without a name', () => {
		expect(buildRejectionEmail(null).text).toContain('Bonjour,');
	});

	it('includes an optional reason and escapes it in html', () => {
		const without = buildRejectionEmail('Dupont');
		expect(without.text).not.toContain('Motif');
		expect(without.html).not.toContain('Motif');

		const evil = buildRejectionEmail('Dupont', '<b>complet</b>');
		expect(evil.text).toContain('Motif indiqué par le conseil syndical : <b>complet</b>');
		expect(evil.html).not.toContain('<b>complet</b>');
		expect(evil.html).toContain('&lt;b&gt;complet&lt;/b&gt;');
		expect(evil.html).toContain('>Motif</p>');
	});

	it('words the refusal with the lot, and the motif segment only when given', () => {
		const bare = buildRejectionEmail('Dupont');
		expect(bare.html).toContain('Demande refusée');
		expect(bare.text).toContain('conseil syndical');
		expect(bare.text).not.toContain('gestionnaire');

		const noMotif = buildRejectionEmail('Nouveau B', null, 'B07');
		expect(noMotif.text).toContain(
			"Bonjour Nouveau B,\n\nVotre demande d'accès à Créneau pour le lot B07 a été refusée :"
		);
		expect(noMotif.text).not.toContain('pour le motif suivant');
		expect(noMotif.text).not.toContain('Motif');
		expect(noMotif.html).toContain('pour le lot B07 a été refusée :');
		expect(noMotif.html).not.toContain('pour le motif suivant');
		expect(noMotif.html).not.toContain('>Motif</p>');

		const withMotif = buildRejectionEmail('Nouveau B', 'Place déjà attribuée', 'B07');
		expect(withMotif.text).toContain('a été refusée pour le motif suivant :');
		expect(withMotif.text).toContain('Motif indiqué par le conseil syndical : Place déjà attribuée');
		expect(withMotif.html).toContain('a été refusée pour le motif suivant :');
		expect(withMotif.html).toContain('Place déjà attribuée');
		expect(withMotif.html).toContain('>Motif</p>');

		// No lot block anywhere: no avatar, no Lot caption, no spots
		for (const { text, html } of [noMotif, withMotif]) {
			expect(text).not.toContain('Lot :');
			expect(text).not.toContain('Places :');
			expect(html).not.toContain('border-radius:50%');
			expect(html).not.toContain('>Lot</p>');
		}

		const full = buildRejectionEmail('Dupont', 'Place déjà attribuée', 'B07', 'https://x.test/guide');
		expect(full.text).toContain('Guide : https://x.test/guide');
		expect(full.html).toContain('href="https://x.test/guide"');
	});

	it('falls back to a lot-less refusal when the flat is unknown', () => {
		const { text, html } = buildRejectionEmail('Dupont', 'Complet', null);
		expect(text).toContain("Votre demande d'accès à Créneau a été refusée pour le motif suivant :");
		expect(text).not.toContain('pour le lot');
		expect(html).toContain('demande d&#39;accès à Créneau a été refusée pour le motif suivant :');
	});

	it('escapes the lot number in the refusal sentence', () => {
		const evil = buildRejectionEmail('Dupont', null, '<b>B07</b>');
		expect(evil.html).not.toContain('<b>B07</b>');
		expect(evil.html).toContain('&lt;b&gt;B07&lt;/b&gt;');
		expect(evil.text).toContain('pour le lot <b>B07</b>');
	});
});
