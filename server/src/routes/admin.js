/* eslint-env node */

import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
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
      firstName: true,
      lastName: true,
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
  email: z.string().trim().email().max(120).optional(),
  firstName: z.string().trim().max(80).optional().nullable(),
  lastName: z.string().trim().max(80).optional().nullable(),
  roleLabel: z.string().trim().optional(),
  roleOtherText: z.string().trim().max(120).optional().nullable(),
});

adminRouter.patch("/users/:id", async (req, res) => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid data" });
  }

  if (parsed.data.roleLabel && !USER_ROLES.includes(parsed.data.roleLabel)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  if (parsed.data.email) {
    const existing = await prisma.user.findFirst({
      where: { email: parsed.data.email, NOT: { id: req.params.id } },
    });
    if (existing) {
      return res.status(409).json({ error: "Email already in use" });
    }
  }

  if (parsed.data.username) {
    const existing = await prisma.user.findFirst({
      where: {
        username: {
          equals: parsed.data.username,
          mode: "insensitive",
        },
        NOT: { id: req.params.id },
      },
    });
    if (existing) {
      return res.status(409).json({ error: "Username already in use" });
    }
  }

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      username: parsed.data.username,
      email: parsed.data.email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      roleLabel: parsed.data.roleLabel,
      roleOtherText: parsed.data.roleOtherText,
    },
  });

  return res.json({
    id: updated.id,
    username: updated.username,
    email: updated.email,
    firstName: updated.firstName,
    lastName: updated.lastName,
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
    return res.status(404).json({ error: "User not found" });
  }

  if (user.email.toLowerCase() === adminEmail) {
    return res.status(400).json({ error: "Admin account cannot be deleted" });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const ownedHives = await tx.hive.findMany({
        where: { ownerId: user.id },
        select: { id: true },
      });
      const ownedHiveIds = ownedHives.map((h) => h.id);

      if (ownedHiveIds.length > 0) {
        await tx.hiveComment.deleteMany({ where: { hiveId: { in: ownedHiveIds } } });
        await tx.hiveCollaborator.deleteMany({ where: { hiveId: { in: ownedHiveIds } } });
        await tx.hive.deleteMany({ where: { id: { in: ownedHiveIds } } });
      }

      await tx.hiveComment.deleteMany({ where: { authorId: user.id } });
      await tx.hiveCollaborator.deleteMany({ where: { userId: user.id } });
      await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await tx.user.delete({ where: { id: user.id } });
    });

    return res.json({ message: "User deleted" });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return res.status(409).json({ error: "Deletion blocked: linked data exists" });
    }
    throw err;
  }
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
  title: z.string().trim().min(1).max(100).optional(),
  boardData: z.any().optional(),
});

adminRouter.patch("/hives/:id", async (req, res) => {
  const parsed = updateHiveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid data" });
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
  return res.json({ message: "Hive deleted" });
});

adminRouter.get("/hives/:id/details", async (req, res) => {
  const hive = await prisma.hive.findUnique({
    where: { id: req.params.id },
    include: {
      collaborators: {
        include: {
          user: { select: { id: true, username: true, email: true } },
        },
        orderBy: { invitedAt: "asc" },
      },
      comments: {
        where: { parentId: null },
        include: {
          author: { select: { id: true, username: true } },
          replies: {
            include: { author: { select: { id: true, username: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!hive) {
    return res.status(404).json({ error: "Hive not found" });
  }

  return res.json({
    collaborators: hive.collaborators.map((c) => ({
      id: c.id,
      userId: c.user.id,
      username: c.user.username,
      email: c.user.email,
      role: c.role,
    })),
    comments: hive.comments.map((c) => ({
      id: c.id,
      message: c.message,
      createdAt: c.createdAt,
      author: c.author,
      replies: c.replies.map((r) => ({
        id: r.id,
        message: r.message,
        createdAt: r.createdAt,
        author: r.author,
        parentId: r.parentId,
      })),
    })),
  });
});

adminRouter.delete("/hives/:id/collaborators/:userId", async (req, res) => {
  await prisma.hiveCollaborator.deleteMany({
    where: { hiveId: req.params.id, userId: req.params.userId },
  });
  return res.json({ message: "Collaborator removed" });
});

adminRouter.delete("/hives/:id/comments/:commentId", async (req, res) => {
  const comment = await prisma.hiveComment.findFirst({
    where: { id: req.params.commentId, hiveId: req.params.id },
  });
  if (!comment) {
    return res.status(404).json({ error: "Comment not found" });
  }
  await prisma.hiveComment.delete({ where: { id: comment.id } });
  return res.json({ message: "Comment deleted" });
});
