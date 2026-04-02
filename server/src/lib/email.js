/* eslint-env node */

import nodemailer from "nodemailer";

const env = globalThis.process?.env || {};
let transportPromise = null;

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

export async function sendResetPasswordEmail({ to, link }) {
  const from = (env.SMTP_FROM || "no-reply@ruche.local").trim();
  const subject = "Reinitialisation de votre mot de passe - La Ruche";
  const text = `Pour reinitialiser votre mot de passe, cliquez sur ce lien: ${link}`;
  const html = `
    <p>Bonjour,</p>
    <p>Vous avez demande la reinitialisation de votre mot de passe.</p>
    <p><a href="${link}">Reinitialiser mon mot de passe</a></p>
    <p>Si vous n'etes pas a l'origine de cette demande, ignorez simplement cet email.</p>
  `;

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
