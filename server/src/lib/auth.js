/* eslint-env node */

import jwt from "jsonwebtoken";

const env = globalThis.process?.env || {};
const JWT_SECRET = env.JWT_SECRET || "dev-secret";
const JWT_EXPIRES_IN = env.JWT_EXPIRES_IN || "7d";

export function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      username: user.username,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function sanitizeUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    roleLabel: user.roleLabel,
    roleOtherText: user.roleOtherText,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastActivityAt: user.lastActivityAt,
  };
}

export function isAdminEmail(email) {
  const adminEmail = (env.ADMIN_EMAIL || "").toLowerCase().trim();
  return Boolean(adminEmail) && email.toLowerCase().trim() === adminEmail;
}
