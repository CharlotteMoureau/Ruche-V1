/* eslint-env node */

import nodemailer from "nodemailer";

function hasSmtpConfig() {
  return Boolean(
      globalThis.process?.env.SMTP_HOST &&
        globalThis.process?.env.SMTP_PORT &&
        globalThis.process?.env.SMTP_USER &&
        globalThis.process?.env.SMTP_PASS,
  );
}

export async function sendResetPasswordEmail({ to, link }) {
  if (!hasSmtpConfig()) {
    console.info(`[RESET PASSWORD LINK for ${to}] ${link}`);
    return;
  }

  const transporter = nodemailer.createTransport({
      host: globalThis.process?.env.SMTP_HOST,
      port: Number(globalThis.process?.env.SMTP_PORT),
      secure: Number(globalThis.process?.env.SMTP_PORT) === 465,
    auth: {
        user: globalThis.process?.env.SMTP_USER,
        pass: globalThis.process?.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
      from: globalThis.process?.env.SMTP_FROM,
    to,
    subject: "Reinitialisation de votre mot de passe - La Ruche",
    text: `Pour reinitialiser votre mot de passe, cliquez sur ce lien: ${link}`,
  });
}
