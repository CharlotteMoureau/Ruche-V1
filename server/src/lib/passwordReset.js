import crypto from "crypto";

export function makeResetToken() {
  const token = crypto.randomBytes(32).toString("hex");
  return {
    token,
    tokenHash: hashResetToken(token),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60),
  };
}

export function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
