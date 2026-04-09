/* eslint-env node */

import nodemailer from "nodemailer";

const env = globalThis.process?.env || {};
let transportPromise = null;

const RESET_EMAIL_COPY = {
  fr: {
    lang: "fr",
    subject: "Réinitialisez votre mot de passe - La Ruche",
    preview: "Réinitialisez votre mot de passe La Ruche en toute sécurité.",
    title: "Réinitialisez votre mot de passe",
    greeting: "Bonjour,",
    intro:
      "Nous avons reçu une demande de réinitialisation de votre mot de passe La Ruche. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.",
    button: "Réinitialiser mon mot de passe",
    fallback:
      "Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :",
    ignore:
      "Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce courriel.",
    textLines: [
      "Bonjour,",
      "",
      "Nous avons reçu une demande de réinitialisation de votre mot de passe La Ruche.",
      "Lien de réinitialisation : {link}",
      "",
      "Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce courriel.",
    ],
  },
  en: {
    lang: "en",
    subject: "Reset your password - La Ruche",
    preview: "Reset your La Ruche password securely.",
    title: "Reset your password",
    greeting: "Hello,",
    intro:
      "We received a request to reset your La Ruche password. Click the button below to choose a new one.",
    button: "Reset my password",
    fallback:
      "If the button does not work, copy and paste this link into your browser:",
    ignore: "If you did not request this, you can safely ignore this email.",
    textLines: [
      "Hello,",
      "",
      "We received a request to reset your La Ruche password.",
      "Reset link: {link}",
      "",
      "If you did not request this, you can safely ignore this email.",
    ],
  },
  nl: {
    lang: "nl",
    subject: "Stel je wachtwoord opnieuw in - La Ruche",
    preview: "Stel je La Ruche-wachtwoord veilig opnieuw in.",
    title: "Stel je wachtwoord opnieuw in",
    greeting: "Hallo,",
    intro:
      "We ontvingen een aanvraag om je La Ruche-wachtwoord opnieuw in te stellen. Klik op de knop hieronder om een nieuw wachtwoord te kiezen.",
    button: "Wachtwoord opnieuw instellen",
    fallback:
      "Werkt de knop niet? Kopieer en plak deze link in je browser:",
    ignore:
      "Als je deze aanvraag niet hebt gedaan, mag je deze e-mail veilig negeren.",
    textLines: [
      "Hallo,",
      "",
      "We ontvingen een aanvraag om je La Ruche-wachtwoord opnieuw in te stellen.",
      "Resetlink: {link}",
      "",
      "Als je deze aanvraag niet hebt gedaan, mag je deze e-mail veilig negeren.",
    ],
  },
};

function getLocaleCopy(locale) {
  const normalizedLocale = String(locale || "fr").toLowerCase();
  return RESET_EMAIL_COPY[normalizedLocale] || RESET_EMAIL_COPY.fr;
}

function getMailerSendConfig() {
  const token = (env.MAILERSEND_API_TOKEN || env.MAILERSEND_API_KEY || "").trim();
  return {
    token,
    endpoint: "https://api.mailersend.com/v1/email",
  };
}

function getSmtpConfig() {
  const host = (env.SMTP_HOST || "").trim();
  const port = Number(env.SMTP_PORT || 587);
  const user = (env.SMTP_USER || "").trim();
  const pass = (env.SMTP_PASS || "").trim();

  return {
    host,
    port,
    auth: user && pass ? { user, pass } : undefined,
  };
}

function buildResetPasswordHtml({ link, locale }) {
  const copy = getLocaleCopy(locale);
  const year = new Date().getFullYear();

  return `
  <!doctype html>
  <html lang="${copy.lang}">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${copy.subject}</title>
    </head>
    <body style="margin:0;padding:0;background:#f7f3ee;font-family:'Segoe UI',Arial,sans-serif;color:#575756;">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;visibility:hidden;">
        ${copy.preview}
      </div>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f3ee;padding:28px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e5ddd1;border-radius:16px;overflow:hidden;">
              <tr>
                <td style="background:#312783;padding:22px 24px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="left" style="vertical-align:middle;">
                        <span style="display:inline-block;color:#ffffff;font-size:22px;font-weight:700;vertical-align:middle;">La Ruche</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:30px 24px 18px 24px;">
                  <h1 style="margin:0 0 14px 0;color:#312783;font-size:24px;line-height:1.25;">${copy.title}</h1>
                  <p style="margin:0 0 12px 0;font-size:16px;line-height:1.6;color:#575756;">${copy.greeting}</p>
                  <p style="margin:0 0 12px 0;font-size:16px;line-height:1.6;color:#575756;">
                    ${copy.intro}
                  </p>
                </td>
              </tr>

              <tr>
                <td style="padding:0 24px 8px 24px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0;">
                    <tr>
                      <td align="center" style="border-radius:999px;background:#f2b500;">
                        <a href="${link}" style="display:inline-block;padding:12px 24px;font-size:16px;font-weight:700;color:#222222;text-decoration:none;border-radius:999px;">
                          ${copy.button}
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:14px 24px 20px 24px;">
                  <p style="margin:0 0 10px 0;font-size:14px;line-height:1.6;color:#575756;">
                    ${copy.fallback}
                  </p>
                  <p style="margin:0;padding:10px 12px;border:1px solid #dfd5c7;border-radius:10px;background:#fbf8f3;word-break:break-all;font-size:13px;line-height:1.5;color:#312783;">
                    ${link}
                  </p>
                </td>
              </tr>

              <tr>
                <td style="padding:18px 24px 28px 24px;border-top:1px solid #ece4d8;">
                  <p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#575756;">
                    ${copy.ignore}
                  </p>
                  <p style="margin:0;font-size:12px;line-height:1.6;color:#8b857a;">
                    © ${year} La Ruche
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
}

async function getTransport() {
  if (transportPromise) {
    return transportPromise;
  }

  transportPromise = (async () => {
    const smtp = getSmtpConfig();
    if (smtp.host && smtp.port) {
      return {
        kind: "smtp",
        transporter: nodemailer.createTransport({
          host: smtp.host,
          port: smtp.port,
          secure: smtp.port === 465,
          ...(smtp.auth ? { auth: smtp.auth } : {}),
        }),
      };
    }

    if (env.NODE_ENV !== "production") {
      const testAccount = await nodemailer.createTestAccount();
      return {
        kind: "ethereal",
        transporter: nodemailer.createTransport({
          host: "smtp.ethereal.email",
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        }),
      };
    }

    return null;
  })();

  return transportPromise;
}

async function sendWithMailerSend({ to, from, subject, text, html }) {
  const config = getMailerSendConfig();
  if (!config.token) {
    return false;
  }

  const fromName = (env.SMTP_FROM_NAME || "La Ruche").trim();
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: {
        email: from,
        name: fromName,
      },
      to: [{ email: to }],
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`MailerSend API error ${response.status}: ${body}`);
  }

  return true;
}

export async function sendResetPasswordEmail({ to, link, locale }) {
  const copy = getLocaleCopy(locale);
  const from = (env.SMTP_FROM || "no-reply@ruche.local").trim();
  const subject = copy.subject;
  const text = copy.textLines.map((line) => line.replace("{link}", link)).join("\n");
  const html = buildResetPasswordHtml({ link, locale });

  const sentByApi = await sendWithMailerSend({ to, from, subject, text, html });
  if (sentByApi) {
    return;
  }

  const transport = await getTransport();
  if (!transport) {
    console.info(`[RESET PASSWORD LINK for ${to}] ${link}`);
    return;
  }

  const info = await transport.transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });

  if (transport.kind === "ethereal") {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.info(`[RESET EMAIL PREVIEW for ${to}] ${previewUrl}`);
    }
  }
}
