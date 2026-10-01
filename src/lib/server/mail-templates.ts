import { latte, mocha } from '$lib/colors';

interface ActivationEmailResult {
	subject: string;
	text: string;
	html: string;
}

export function activationEmail(
	flatNumber: string,
	activationCode: string,
	activationLink: string
): ActivationEmailResult {
	const subject = "Code d'activation — Créneau";

	const text = `Bonjour,

Bienvenue sur Créneau !

Votre lot : ${flatNumber}
Votre code d'activation : ${activationCode}

Pour activer votre compte, cliquez sur le lien ci-dessous ou saisissez le code sur la page d'activation :

${activationLink}

Ce code est valable 24 heures.

Si vous n'avez pas demandé cette activation, vous pouvez ignorer cet email.

—
Créneau, votre place de parking partagée`;

	const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Activation de votre compte Créneau</title>
  <style>
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
      .divider { border-top-color: ${mocha.surface1} !important; }
      .footer { background-color: ${mocha.mantle} !important; }
      .footer-text { color: ${mocha.overlay0} !important; }
    }
  </style>
</head>
<body class="email-bg" style="margin:0;padding:0;background-color:${latte.base};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${latte.base};padding:40px 20px;">
    <tr>
      <td align="center">
        <table class="card" role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:${latte.white};border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td class="header" style="background-color:${latte.blue};padding:32px;text-align:center;">
              <h1 style="margin:0;color:${latte.white};font-size:24px;font-weight:600;">Créneau</h1>
              <p style="margin:8px 0 0;color:${latte.white};font-size:14px;opacity:0.9;">Votre place de parking partagée</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 class="body-text" style="margin:0 0 16px;color:${latte.heading};font-size:20px;font-weight:600;">Bienvenue !</h2>
              <p class="body-text" style="margin:0 0 16px;color:${latte.text};font-size:15px;line-height:1.6;">
                Votre lot <strong style="color:${latte.heading};">${flatNumber}</strong> est prêt à être activé.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                <tr>
                  <td class="code-bg" style="background-color:${latte.base};border-radius:8px;padding:20px;text-align:center;">
                    <p class="muted" style="margin:0 0 8px;color:${latte.subtext0};font-size:13px;text-transform:uppercase;letter-spacing:0.5px;">Votre code d'activation</p>
                    <p class="code-text" style="margin:0;color:${latte.heading};font-size:32px;font-weight:700;letter-spacing:4px;font-family:'Courier New',monospace;">${activationCode}</p>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                <tr>
                  <td align="center">
                    <a class="btn" href="${activationLink}" style="display:inline-block;background-color:${latte.blue};color:${latte.white};text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">Activer mon compte</a>
                  </td>
                </tr>
              </table>

              <p class="muted" style="margin:0 0 8px;color:${latte.subtext0};font-size:13px;text-align:center;">
                Ou saisissez le code sur <a class="link" href="${activationLink}" style="color:${latte.blue};text-decoration:none;">creneau.wagou.fr/activate</a>
              </p>

              <hr class="divider" style="border:none;border-top:1px solid ${latte.mantle};margin:24px 0;">

              <p class="muted" style="margin:0;color:${latte.subtext0};font-size:13px;line-height:1.5;">
                Ce code est valable <strong>24 heures</strong>. Si vous n'avez pas demandé cette activation, vous pouvez ignorer cet email.
              </p>
            </td>
          </tr>
          <tr>
            <td class="footer" style="background-color:${latte.footerBg};padding:20px 32px;text-align:center;">
              <p class="footer-text" style="margin:0;color:${latte.overlay0};font-size:12px;">Créneau — Gestion de parkings partagés</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

	return { subject, text, html };
}
