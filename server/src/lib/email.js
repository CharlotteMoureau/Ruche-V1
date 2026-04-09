/* eslint-env node */

import nodemailer from "nodemailer";

const env = globalThis.process?.env || {};
let transportPromise = null;

function getMailerSendConfig() {
  const token = (
    env.MAILERSEND_API_TOKEN ||
    env.MAILERSEND_API_KEY ||
    ""
  ).trim();
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

function getResetEmailContent(link, locale = "fr") {
  const lang = ["fr", "en", "nl"].includes(locale) ? locale : "fr";

  if (lang === "en") {
    return {
      subject: "Reset your password - La Ruche",
      text: `To reset your password, click this link: ${link}`,
      html: `
        <p>Hello,</p>
        <p>You requested a password reset.</p>
        <p><a href="${link}">Reset my password</a></p>
        <p>If you did not request this, you can safely ignore this email.</p>
      `,
    };
  }

  if (lang === "nl") {
    return {
      subject: "Stel je wachtwoord opnieuw in - La Ruche",
      text: `Klik op deze link om je wachtwoord opnieuw in te stellen: ${link}`,
      html: `
        <p>Hallo,</p>
        <p>Je hebt een aanvraag gedaan om je wachtwoord opnieuw in te stellen.</p>
        <p><a href="${link}">Mijn wachtwoord opnieuw instellen</a></p>
        <p>Als je dit niet hebt aangevraagd, mag je deze e-mail negeren.</p>
      `,
    };
  }

  return {
    subject: "Reinitialisez votre mot de passe - La Ruche",
    text: `Pour reinitialiser votre mot de passe, cliquez sur ce lien : ${link}`,
    html: `
      <p>Bonjour,</p>
      <p>Vous avez demande la reinitialisation de votre mot de passe.</p>
      <p><a href="${link}">Reinitialiser mon mot de passe</a></p>
      <p>Si vous n'etes pas a l'origine de cette demande, vous pouvez ignorer cet email.</p>
    `,
  };
}

export async function sendResetPasswordEmail({ to, link, locale = "fr" }) {
  const from = (env.SMTP_FROM || "no-reply@ruche.local").trim();
  const { subject, text, html } = getResetEmailContent(link, locale);

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
