/* eslint-env node */

import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { signAccessToken, sanitizeUser } from "../lib/auth.js";
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
    message: "Les mots de passe ne correspondent pas",
    path: ["passwordConfirm"],
  });

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || "Données invalides" });
  }

  const role = normalizeRole(parsed.data.role);
  if (!USER_ROLES.includes(role)) {
    return res.status(400).json({ error: "Rôle invalide" });
  }

  if (role === "Autre" && !parsed.data.roleOtherText?.trim()) {
    return res.status(400).json({ error: "Veuillez préciser votre rôle" });
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { username: parsed.data.username },
        { email: parsed.data.email.toLowerCase() },
      ],
    },
  });

  if (existing?.username === parsed.data.username) {
    return res.status(409).json({ error: "Nom d'utilisateur déjà utilisé" });
  }

  if (existing?.email === parsed.data.email.toLowerCase()) {
    return res.status(409).json({ error: "Email déjà utilisé" });
  }

  const user = await prisma.user.create({
    data: {
      username: parsed.data.username,
      email: parsed.data.email.toLowerCase(),
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      roleLabel: role,
      roleOtherText: role === "Autre" ? parsed.data.roleOtherText?.trim() || null : null,
    },
  });

  const token = signAccessToken(user);
  return res.status(201).json({ token, user: sanitizeUser(user) });
});

const loginSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Identifiants invalides" });
  }

  const identifier = parsed.data.identifier.trim();
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier.toLowerCase() }, { username: identifier }],
    },
  });

  if (!user) {
    return res.status(401).json({ error: "Identifiants invalides" });
  }

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "Identifiants invalides" });
  }

  const token = signAccessToken(user);
  return res.json({ token, user: sanitizeUser(user) });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: {
      hives: {
        select: {
          id: true,
          title: true,
          boardSnapshot: true,
          boardPreviewImage: true,
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
              boardSnapshot: true,
              boardPreviewImage: true,
              createdAt: true,
              updatedAt: true,
              owner: { select: { username: true, email: true } },
            },
          },
        },
      },
    },
  });

  return res.json({
    user: sanitizeUser(user),
    isAdmin: req.user.isAdmin,
    ownedHives: user.hives,
    sharedHives: user.collaborations.map((c) => ({
      id: c.hive.id,
      title: c.hive.title,
      boardSnapshot: c.hive.boardSnapshot,
      boardPreviewImage: c.hive.boardPreviewImage,
      createdAt: c.hive.createdAt,
      updatedAt: c.hive.updatedAt,
      owner: c.hive.owner,
      collaboratorRole: c.role,
    })),
  });
});

const forgotSchema = z.object({
  email: z.string().email(),
});

authRouter.post("/forgot-password", async (req, res) => {
  const parsed = forgotSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Email invalide" });
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.json({ message: "Si le compte existe, un email a été envoyé." });
  }

  const { token, tokenHash, expiresAt } = makeResetToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  const appUrl = globalThis.process?.env.APP_URL || "http://localhost:5173";
  const link = `${appUrl}/reset-password?token=${token}`;
  await sendResetPasswordEmail({ to: user.email, link });

  return res.json({ message: "Si le compte existe, un email a été envoyé." });
});

const resetSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(8).max(100),
    passwordConfirm: z.string().min(8).max(100),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Les mots de passe ne correspondent pas",
    path: ["passwordConfirm"],
  });

authRouter.post("/reset-password", async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || "Données invalides" });
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
    return res.status(400).json({ error: "Lien invalide ou expiré" });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: await bcrypt.hash(parsed.data.password, 12) },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return res.json({ message: "Mot de passe mis à jour" });
});
