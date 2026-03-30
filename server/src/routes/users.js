import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { sanitizeUser } from "../lib/auth.js";
import { USER_ROLES, normalizeRole } from "../lib/roles.js";

export const usersRouter = Router();

const deleteMeSchema = z.object({
  confirmation: z.string(),
  password: z.string().min(1),
});

const updateMeSchema = z.object({
  role: z.string().trim().optional(),
  roleOtherText: z.string().trim().max(120).optional().or(z.literal("")),
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(8).max(100).optional(),
  newPasswordConfirm: z.string().min(8).max(100).optional(),
});

usersRouter.patch("/me", requireAuth, async (req, res) => {
  const parsed = updateMeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || "Données invalides" });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) {
    return res.status(404).json({ error: "Utilisateur introuvable" });
  }

  const {
    role,
    roleOtherText,
    currentPassword,
    newPassword,
    newPasswordConfirm,
  } = parsed.data;

  const wantsPasswordChange = Boolean(
    currentPassword || newPassword || newPasswordConfirm,
  );

  if (wantsPasswordChange) {
    if (!currentPassword || !newPassword || !newPasswordConfirm) {
      return res.status(400).json({
        error: "Veuillez renseigner le mot de passe actuel et le nouveau mot de passe deux fois",
      });
    }

    if (newPassword !== newPasswordConfirm) {
      return res.status(400).json({ error: "Les mots de passe ne correspondent pas" });
    }

    const passwordOk = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!passwordOk) {
      return res.status(401).json({ error: "Mot de passe actuel incorrect" });
    }
  }

  let normalizedRole;
  if (typeof role === "string") {
    normalizedRole = normalizeRole(role);
    if (!USER_ROLES.includes(normalizedRole)) {
      return res.status(400).json({ error: "Rôle invalide" });
    }
  }

  const effectiveRole = normalizedRole || user.roleLabel;
  const trimmedRoleOtherText =
    typeof roleOtherText === "string" ? roleOtherText.trim() : undefined;

  if (effectiveRole === "Autre") {
    const hasIncomingOtherText = typeof trimmedRoleOtherText === "string";
    const effectiveOtherText = hasIncomingOtherText
      ? trimmedRoleOtherText
      : user.roleOtherText?.trim() || "";

    if (!effectiveOtherText) {
      return res.status(400).json({ error: "Veuillez préciser votre rôle" });
    }
  }

  const updateData = {};

  if (typeof normalizedRole === "string") {
    updateData.roleLabel = normalizedRole;
  }

  if (effectiveRole === "Autre" && typeof trimmedRoleOtherText === "string") {
    updateData.roleOtherText = trimmedRoleOtherText || null;
  }

  if (effectiveRole !== "Autre") {
    updateData.roleOtherText = null;
  }

  if (wantsPasswordChange) {
    updateData.passwordHash = await bcrypt.hash(newPassword, 12);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: updateData,
  });

  return res.json({
    message: "Profil mis à jour",
    user: sanitizeUser(updated),
  });
});

usersRouter.delete("/me", requireAuth, async (req, res) => {
  const parsed = deleteMeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Confirmation invalide" });
  }

  if (parsed.data.confirmation !== "DELETE") {
    return res.status(400).json({ error: "Veuillez confirmer avec DELETE" });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) {
    return res.status(404).json({ error: "Utilisateur introuvable" });
  }

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "Mot de passe incorrect" });
  }

  await prisma.user.delete({ where: { id: req.user.id } });
  return res.json({ message: "Profil supprimé" });
});
