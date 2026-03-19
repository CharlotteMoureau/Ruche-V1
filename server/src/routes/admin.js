/* eslint-env node */

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { USER_ROLES } from "../lib/roles.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      roleLabel: true,
      roleOtherText: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          hives: true,
          collaborations: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return res.json(users);
});

const updateUserSchema = z.object({
  username: z.string().trim().min(3).max(40).optional(),
  roleLabel: z.string().trim().optional(),
  roleOtherText: z.string().trim().max(120).optional().nullable(),
});

adminRouter.patch("/users/:id", async (req, res) => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Donnees invalides" });
  }

  if (parsed.data.roleLabel && !USER_ROLES.includes(parsed.data.roleLabel)) {
    return res.status(400).json({ error: "Role invalide" });
  }

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      username: parsed.data.username,
      roleLabel: parsed.data.roleLabel,
      roleOtherText: parsed.data.roleOtherText,
    },
  });

  return res.json({
    id: updated.id,
    username: updated.username,
    email: updated.email,
    roleLabel: updated.roleLabel,
    roleOtherText: updated.roleOtherText,
  });
});

adminRouter.delete("/users/:id", async (req, res) => {
  const adminEmail = (globalThis.process?.env.ADMIN_EMAIL || "")
    .toLowerCase()
    .trim();
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });

  if (!user) {
    return res.status(404).json({ error: "Utilisateur introuvable" });
  }

  if (user.email.toLowerCase() === adminEmail) {
    return res.status(400).json({ error: "Le compte admin ne peut pas etre supprime" });
  }

  await prisma.user.delete({ where: { id: user.id } });
  return res.json({ message: "Utilisateur supprime" });
});

adminRouter.get("/hives", async (_req, res) => {
  const hives = await prisma.hive.findMany({
    include: {
      owner: { select: { id: true, username: true, email: true } },
      _count: {
        select: {
          collaborators: true,
          comments: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return res.json(hives);
});

const updateHiveSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  boardData: z.any().optional(),
});

adminRouter.patch("/hives/:id", async (req, res) => {
  const parsed = updateHiveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Donnees invalides" });
  }

  const updated = await prisma.hive.update({
    where: { id: req.params.id },
    data: {
      title: parsed.data.title,
      boardData: parsed.data.boardData,
    },
  });

  return res.json(updated);
});

adminRouter.delete("/hives/:id", async (req, res) => {
  await prisma.hive.delete({ where: { id: req.params.id } });
  return res.json({ message: "Ruche supprimee" });
});
