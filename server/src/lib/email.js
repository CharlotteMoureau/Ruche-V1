/* eslint-env node */

import nodemailer from "nodemailer";

const env = globalThis.process?.env || {};
let transportPromise = null;

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

export async function sendResetPasswordEmail({ to, link }) {
  const from = (env.SMTP_FROM || "no-reply@ruche.local").trim();
  const subject = "Reset your password - La Ruche";
  const text = `To reset your password, click this link: ${link}`;
  const html = `
    <p>Hello,</p>
    <p>You requested a password reset.</p>
    <p><a href="${link}">Reset my password</a></p>
    <p>If you did not request this, you can safely ignore this email.</p>
  `;

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
