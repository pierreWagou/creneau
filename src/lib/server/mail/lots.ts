import { infoShell } from './blocks';
import { escapeHtml, type InfoEmailResult, textFooter } from './shell';

export function buildLotDeletedEmail(flatNumber: string, guideUrl: string | null = null): InfoEmailResult {
	const subject = 'Lot supprimé — Créneau';
	const intro = `Votre lot ${flatNumber} a été supprimé de Créneau.`;
	const text = `Bonjour,\n\n${intro}\n\n—\nCréneau, votre place de parking partagée${textFooter(guideUrl)}`;
	const html = infoShell('Lot supprimé', `${escapeHtml(intro)}`, '', guideUrl);
	return { subject, text, html };
}
