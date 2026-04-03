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
    return res.status(400).json({
      error: parsed.error.issues[0]?.message || "Invalid data",
      code: "VALIDATION_INVALID_DATA",
    });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) {
    return res.status(404).json({ error: "User not found", code: "PROFILE_USER_NOT_FOUND" });
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
        error: "Please provide your current password and confirm the new password",
        code: "PROFILE_PASSWORD_CHANGE_FIELDS_REQUIRED",
      });
    }

    if (newPassword !== newPasswordConfirm) {
      return res.status(400).json({ error: "Passwords do not match", code: "PASSWORDS_DO_NOT_MATCH" });
    }

    const passwordOk = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!passwordOk) {
      return res.status(401).json({
        error: "Current password is incorrect",
        code: "PROFILE_PASSWORD_CURRENT_INCORRECT",
      });
    }
  }

  let normalizedRole;
  if (typeof role === "string") {
    normalizedRole = normalizeRole(role);
    if (!USER_ROLES.includes(normalizedRole)) {
      return res.status(400).json({ error: "Invalid role", code: "VALIDATION_INVALID_ROLE" });
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
      return res.status(400).json({
        error: "Please specify your role",
        code: "VALIDATION_ROLE_REQUIRED",
      });
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
    message: "Profile updated",
    code: "MSG_PROFILE_UPDATED",
    user: sanitizeUser(updated),
  });
});

usersRouter.delete("/me", requireAuth, async (req, res) => {
  const parsed = deleteMeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid confirmation",
      code: "PROFILE_CONFIRMATION_INVALID",
    });
  }

  if (parsed.data.confirmation !== "DELETE") {
    return res.status(400).json({
      error: "Please confirm with DELETE",
      code: "PROFILE_CONFIRM_DELETE_REQUIRED",
    });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) {
    return res.status(404).json({ error: "User not found", code: "PROFILE_USER_NOT_FOUND" });
  }

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "Incorrect password", code: "PROFILE_PASSWORD_INCORRECT" });
  }

  await prisma.user.delete({ where: { id: req.user.id } });
  return res.json({ message: "Profile deleted", code: "MSG_PROFILE_DELETED" });
});
