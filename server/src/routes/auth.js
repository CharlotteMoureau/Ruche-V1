/* eslint-env node */

import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { signAccessToken, sanitizeUser, isAdminEmail } from "../lib/auth.js";
import { USER_ROLES, normalizeRole } from "../lib/roles.js";
import { makeResetToken, hashResetToken } from "../lib/passwordReset.js";
import { sendResetPasswordEmail } from "../lib/email.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

const registerSchema = z
  .object({
    username: z.string().trim().min(3).max(40),
    email: z.string().trim().email(),
    password: z.string().min(8).max(100),
    passwordConfirm: z.string().min(8).max(100),
    firstName: z.string().trim().min(1).max(50),
    lastName: z.string().trim().min(1).max(50),
    role: z.string().trim().min(1),
    roleOtherText: z.string().trim().max(120).optional().or(z.literal("")),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Passwords do not match",
    path: ["passwordConfirm"],
  });

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    const firstIssueMessage = parsed.error.issues[0]?.message;
    const isPasswordMismatch = firstIssueMessage === "Passwords do not match";
    return res.status(400).json({
      error: firstIssueMessage || "Invalid data",
      code: isPasswordMismatch
        ? "PASSWORDS_DO_NOT_MATCH"
        : "VALIDATION_INVALID_DATA",
    });
  }

  const role = normalizeRole(parsed.data.role);
  if (!USER_ROLES.includes(role)) {
    return res
      .status(400)
      .json({ error: "Invalid role", code: "VALIDATION_INVALID_ROLE" });
  }

  if (role === "Autre" && !parsed.data.roleOtherText?.trim()) {
    return res.status(400).json({
      error: "Please specify your role",
      code: "VALIDATION_ROLE_REQUIRED",
    });
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        {
          username: {
            equals: parsed.data.username,
            mode: "insensitive",
          },
        },
        { email: parsed.data.email.toLowerCase() },
      ],
    },
  });

  if (
    existing?.username &&
    existing.username.toLowerCase() === parsed.data.username.toLowerCase()
  ) {
    return res
      .status(409)
      .json({ error: "Username already in use", code: "AUTH_USERNAME_TAKEN" });
  }

  if (existing?.email === parsed.data.email.toLowerCase()) {
    return res
      .status(409)
      .json({ error: "Email already in use", code: "AUTH_EMAIL_TAKEN" });
  }

  const user = await prisma.user.create({
    data: {
      username: parsed.data.username,
      email: parsed.data.email.toLowerCase(),
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      roleLabel: role,
      roleOtherText:
        role === "Autre" ? parsed.data.roleOtherText?.trim() || null : null,
    },
  });

  const token = signAccessToken(user);
  return res.status(201).json({
    token,
    user: sanitizeUser(user),
    isAdmin: isAdminEmail(user.email),
  });
});

const loginSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid credentials", code: "AUTH_INVALID_CREDENTIALS" });
  }

  const identifier = parsed.data.identifier.trim();
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: identifier.toLowerCase() },
        {
          username: {
            equals: identifier,
            mode: "insensitive",
          },
        },
      ],
    },
  });

  if (!user) {
    return res
      .status(401)
      .json({ error: "Invalid credentials", code: "AUTH_INVALID_CREDENTIALS" });
  }

  if (!user.passwordHash || typeof user.passwordHash !== "string") {
    return res
      .status(401)
      .json({ error: "Invalid credentials", code: "AUTH_INVALID_CREDENTIALS" });
  }

  let ok = false;
  try {
    ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  } catch {
    return res
      .status(401)
      .json({ error: "Invalid credentials", code: "AUTH_INVALID_CREDENTIALS" });
  }

  if (!ok) {
    return res
      .status(401)
      .json({ error: "Invalid credentials", code: "AUTH_INVALID_CREDENTIALS" });
  }

  const token = signAccessToken(user);
  return res.json({
    token,
    user: sanitizeUser(user),
    isAdmin: isAdminEmail(user.email),
  });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const includeCollections = req.query.includeCollections === "1";
  const includePreviews = req.query.includePreviews === "1";
  const includePreviewImages = req.query.includePreviewImages === "1";
  if (!includeCollections) {
    return res.json({
      user: sanitizeUser(req.user),
      isAdmin: req.user.isAdmin,
      ownedHives: [],
      sharedHives: [],
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: {
      hives: {
        select: {
          id: true,
          title: true,
          kind: true,
          boardSnapshot: includePreviews,
          boardPreviewImage: includePreviews && includePreviewImages,
          updatedAt: true,
          createdAt: true,
        },
        orderBy: { updatedAt: "desc" },
      },
      collaborations: {
        select: {
          role: true,
          hive: {
            select: {
              id: true,
              title: true,
              kind: true,
              boardSnapshot: includePreviews,
              boardPreviewImage: includePreviews && includePreviewImages,
              createdAt: true,
              updatedAt: true,
              owner: { select: { username: true, email: true } },
            },
          },
        },
      },
    },
  });

  if (!user) {
    return res.status(401).json({
      error: "Invalid user",
      code: "AUTH_INVALID_USER",
    });
  }

  const sharedHives = user.collaborations
    .filter((c) => c?.hive)
    .map((c) => ({
      id: c.hive.id,
      title: c.hive.title,
      kind: c.hive.kind,
      boardSnapshot: c.hive.boardSnapshot,
      boardPreviewImage: c.hive.boardPreviewImage,
      createdAt: c.hive.createdAt,
      updatedAt: c.hive.updatedAt,
      owner: c.hive.owner,
      collaboratorRole: c.role,
    }));

  return res.json({
    user: sanitizeUser(user),
    isAdmin: req.user.isAdmin,
    ownedHives: user.hives,
    sharedHives,
  });
});

const forgotSchema = z.object({
  email: z.string().email(),
  locale: z.enum(["fr", "en", "nl"]).optional(),
});

authRouter.post("/forgot-password", async (req, res) => {
  const parsed = forgotSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid email", code: "AUTH_INVALID_EMAIL" });
  }

  const email = parsed.data.email.toLowerCase();
  const locale = parsed.data.locale || "fr";
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.json({
      message: "If the account exists, an email has been sent.",
      code: "MSG_PASSWORD_RESET_EMAIL_SENT",
    });
  }

  const { token, tokenHash, expiresAt } = makeResetToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  const appUrl = globalThis.process?.env.APP_URL || "http://127.0.0.1:5173";
  const link = `${appUrl}/reset-password?token=${token}`;
  try {
    await sendResetPasswordEmail({ to: user.email, link, locale });
  } catch (error) {
    console.error("Failed to send reset password email", error);
  }

  return res.json({
    message: "If the account exists, an email has been sent.",
    code: "MSG_PASSWORD_RESET_EMAIL_SENT",
  });
});

const resetSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(8).max(100),
    passwordConfirm: z.string().min(8).max(100),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Passwords do not match",
    path: ["passwordConfirm"],
  });

authRouter.post("/reset-password", async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) {
    const firstIssueMessage = parsed.error.issues[0]?.message;
    const isPasswordMismatch = firstIssueMessage === "Passwords do not match";
    return res.status(400).json({
      error: firstIssueMessage || "Invalid data",
      code: isPasswordMismatch
        ? "PASSWORDS_DO_NOT_MATCH"
        : "VALIDATION_INVALID_DATA",
    });
  }

  const tokenHash = hashResetToken(parsed.data.token);
  const record = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!record) {
    return res.status(400).json({
      error: "Invalid or expired link",
      code: "AUTH_RESET_LINK_INVALID",
    });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: await bcrypt.hash(parsed.data.password, 12) },
    }),
    prisma.passwordResetToken.deleteMany({
      where: { userId: record.userId },
    }),
  ]);

  return res.json({
    message: "Password updated",
    code: "MSG_PASSWORD_UPDATED",
  });
});
