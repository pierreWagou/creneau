import { latte } from '$lib/colors';
import { ACTIVATION_CODE_TTL_MS, MS_PER_HOUR } from '$lib/constants';
import { ctaButton } from './blocks';
import {
	escapeHtml,
	type InfoEmailResult,
	shellClose,
	shellFooter,
	shellHead,
	shellHeader,
	shellOpen,
	textFooter
} from './shell';

export function buildActivationEmail(
	flatNumber: string,
	activationCode: string,
	activationLink: string
): InfoEmailResult {
	const subject = "Code d'activation — Créneau";
	// Displayed TTL + host derive from the TTL constant and the runtime link
	// (preview and production hosts differ) — never hardcoded.
	const ttlHours = ACTIVATION_CODE_TTL_MS / MS_PER_HOUR;
	const ttlLabel = ttlHours > 1 ? `${ttlHours} heures` : '1 heure';
	// Guide URL derives from the runtime link (preview and production hosts
	// differ) — never hardcoded.
	const guideUrl = `${new URL(activationLink).origin}/guide`;

	const text = `Bonjour,

Bienvenue sur Créneau !

Votre lot ${flatNumber} est prêt à être activé dans l'application Créneau. Le code suivant expirera dans ${ttlLabel}.

Votre code d'activation : ${activationCode}

Pour activer votre compte, cliquez sur le lien ci-dessous ou saisissez le code sur la page d'activation :

${activationLink}

—
Créneau, votre place de parking partagée${textFooter(guideUrl)}`;

	const html =
		shellHead('Activation de votre compte Créneau') +
		shellOpen() +
		shellHeader() +
		`
          <tr>
            <td style="padding:32px;">
              <h2 class="body-text" style="margin:0 0 16px;color:${latte.heading};font-size:20px;font-weight:600;">Bienvenue !</h2>
              <p class="body-text" style="margin:0 0 16px;color:${latte.text};font-size:15px;line-height:1.6;">
                Votre lot <strong style="color:${latte.heading};">${escapeHtml(flatNumber)}</strong> est prêt à être activé dans l'application Créneau. Le code suivant expirera dans ${ttlLabel}.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                <tr>
                  <td class="code-bg" style="background-color:${latte.base};border-radius:8px;padding:20px;text-align:center;">
                    <p class="muted" style="margin:0 0 8px;color:${latte.subtext0};font-size:13px;text-transform:uppercase;letter-spacing:0.5px;">Votre code d'activation</p>
                    <p class="code-text" style="margin:0;color:${latte.heading};font-size:32px;font-weight:700;letter-spacing:4px;font-family:'Courier New',monospace;">${escapeHtml(activationCode)}</p>
                  </td>
                </tr>
              </table>

              ${ctaButton(activationLink, 'Activer mon compte')}
            </td>
          </tr>
` +
		shellFooter(guideUrl) +
		shellClose();

	return { subject, text, html };
}
