import { latte, mocha } from '$lib/colors';

export interface InfoEmailResult {
	subject: string;
	text: string;
	html: string;
}

/** Escape user-controlled values before HTML interpolation (defense in depth —
 *  callers already validate formats, but mail HTML must never trust input). */
export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * Dark-mode overrides shared by every mail (light design is the default).
 * Superset of every class any mail body uses — hooks only, no light styles.
 */
const DARK_CSS = `
    @media (prefers-color-scheme: dark) {
      body, .email-bg { background-color: ${mocha.base} !important; }
      .card { background-color: ${mocha.surface0} !important; box-shadow: none !important; }
      .header { background-color: ${mocha.blue} !important; }
      .header h1, .header p { color: ${mocha.base} !important; }
      .body-text { color: ${mocha.text} !important; }
      .body-text strong { color: ${mocha.text} !important; }
      .muted { color: ${mocha.subtext0} !important; }
      .code-bg { background-color: ${mocha.base} !important; }
      .code-text { color: ${mocha.text} !important; }
      .btn { background-color: ${mocha.blue} !important; color: ${mocha.base} !important; }
      .link { color: ${mocha.blue} !important; }
      .chip { background-color: transparent !important; border-color: ${mocha.blue} !important; color: ${mocha.blue} !important; }
      .badge-month { background-color: ${mocha.blue} !important; color: ${mocha.base} !important; }
      .badge-day { border-color: ${mocha.blue} !important; color: ${mocha.text} !important; }
      .chip-disabled { background-color: transparent !important; border-color: ${mocha.overlay0} !important; color: ${mocha.overlay0} !important; }
      .badge-month-disabled { background-color: ${mocha.surface1} !important; color: ${mocha.subtext0} !important; }
      .badge-day-disabled { border-color: ${mocha.surface1} !important; color: ${mocha.overlay0} !important; }
      .hours-void { color: ${mocha.overlay0} !important; }
      .divider { border-top-color: ${mocha.surface1} !important; }
      .footer { background-color: ${mocha.mantle} !important; }
      .footer-text { color: ${mocha.overlay0} !important; }
    }`;

/** Shared shell primitives: doctype/head, card open, brand header, footer, close. */
export function shellHead(title: string): string {
	return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>${DARK_CSS}
  </style>
</head>`;
}

export function shellOpen(): string {
	return `<body class="email-bg" style="margin:0;padding:0;background-color:${latte.base};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${latte.base};padding:40px 20px;">
    <tr>
      <td align="center">
        <table class="card" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${latte.white};border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);max-width:480px;">`;
}

export function shellHeader(): string {
	return `          <tr>
            <td class="header" style="background-color:${latte.blue};padding:20px;text-align:center;">
              <img src="cid:creneau-logo" alt="Créneau" width="40" height="40" style="display:block;margin:0 auto 8px;border:0;outline:none;">
              <h1 style="margin:0;color:${latte.white};font-size:22px;font-weight:600;">Créneau</h1>
            </td>
          </tr>`;
}

/** Contact line shared by every mail footer (single voice: conseil syndical). */
const CONTACT_LINE = 'Pour toute question, rapprochez-vous du conseil syndical.';

export function shellFooter(guideUrl: string | null = null): string {
	const brand =
		guideUrl !== null
			? `<a class="link" href="${escapeHtml(guideUrl)}" style="color:${latte.overlay0};text-decoration:underline;">Créneau</a>`
			: 'Créneau';
	return `          <tr>
            <td class="footer" style="background-color:${latte.footerBg};padding:20px 32px;text-align:center;">
              <p class="footer-text" style="margin:0;color:${latte.overlay0};font-size:12px;">${brand} — Gestion de parkings partagés</p>
              <p class="footer-text" style="margin:6px 0 0;color:${latte.overlay0};font-size:12px;">${CONTACT_LINE}</p>
            </td>
          </tr>`;
}
export function textFooter(guideUrl: string | null = null): string {
	return `\n${CONTACT_LINE}${guideUrl !== null ? `\nGuide : ${guideUrl}` : ''}`;
}

export function shellClose(): string {
	return `        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
