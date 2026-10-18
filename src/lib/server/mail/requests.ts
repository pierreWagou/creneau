import { captionedValue, infoShell, tintBlock } from './blocks';
import { escapeHtml, type InfoEmailResult, textFooter } from './shell';

export function buildRejectionEmail(
	requesterName: string | null,
	reason: string | null = null,
	flatNumber: string | null = null,
	guideUrl: string | null = null
): InfoEmailResult {
	const subject = 'Votre demande — Créneau';
	const greeting = requesterName ? `Bonjour ${requesterName},` : 'Bonjour,';
	const lotSegment = flatNumber ? ` pour le lot ${flatNumber}` : '';
	const motifSegment = reason ? ' pour le motif suivant' : '';
	const refusal = `Votre demande d'accès à Créneau${lotSegment} a été refusée${motifSegment} :`;
	const reasonText = reason ? `\n\nMotif indiqué par le conseil syndical : ${reason}` : '';
	const reasonHtml = reason ? captionedValue('Motif', reason) : '';
	// Tinted only when there is something to show — a motiveless rejection
	// keeps today's unboxed rendering instead of an empty grey box.
	const text = `${greeting}\n\n${refusal}${reasonText}\n\n—\nCréneau, votre place de parking partagée${textFooter(guideUrl)}`;
	const html = infoShell(
		'Demande refusée',
		`${escapeHtml(greeting)} ${escapeHtml(refusal)}`,
		reasonHtml === '' ? '' : tintBlock(reasonHtml),
		guideUrl
	);
	return { subject, text, html };
}
