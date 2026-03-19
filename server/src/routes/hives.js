import { CollaboratorRole } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

export const hivesRouter = Router();

hivesRouter.use(requireAuth);

const hiveInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  boardData: z.any(),
});

const collaboratorRoleSchema = z.nativeEnum(CollaboratorRole);

async function getHiveOr404(id) {
  return prisma.hive.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, username: true, email: true } },
      collaborators: {
        include: { user: { select: { id: true, username: true, email: true } } },
      },
    },
  });
}

function getMembershipRole(hive, userId) {
  return hive.collaborators.find((c) => c.userId === userId)?.role || null;
}

function canReadHive(hive, user) {
  return user.isAdmin || hive.ownerId === user.id || Boolean(getMembershipRole(hive, user.id));
}

function canEditHive(hive, user) {
  const role = getMembershipRole(hive, user.id);
  return user.isAdmin || hive.ownerId === user.id || role === CollaboratorRole.ADMIN;
}

function canCommentOnHive(hive, user) {
  const role = getMembershipRole(hive, user.id);
  return (
    user.isAdmin ||
    hive.ownerId === user.id ||
    role === CollaboratorRole.ADMIN ||
    role === CollaboratorRole.COMMENT
  );
}

hivesRouter.get("/", async (req, res) => {
  const hives = await prisma.hive.findMany({
    where: {
      OR: [
        { ownerId: req.user.id },
        { collaborators: { some: { userId: req.user.id } } },
      ],
    },
    include: {
      owner: { select: { id: true, username: true, email: true } },
      collaborators: {
        where: { userId: req.user.id },
        select: { role: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return res.json(
    hives.map((hive) => ({
      id: hive.id,
      title: hive.title,
      owner: hive.owner,
      createdAt: hive.createdAt,
      updatedAt: hive.updatedAt,
      collaboratorRole: hive.collaborators[0]?.role || null,
      isOwner: hive.ownerId === req.user.id,
    })),
  );
});

hivesRouter.post("/", async (req, res) => {
  const parsed = hiveInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Donnees de ruche invalides" });
  }

  const hive = await prisma.hive.create({
    data: {
      title: parsed.data.title,
      boardData: parsed.data.boardData,
      ownerId: req.user.id,
    },
  });

  return res.status(201).json(hive);
});

hivesRouter.get("/:id", async (req, res) => {
  const hive = await getHiveOr404(req.params.id);
  if (!hive) {
    return res.status(404).json({ error: "Ruche introuvable" });
  }

  if (!canReadHive(hive, req.user)) {
    return res.status(403).json({ error: "Acces interdit" });
  }

  const comments = await prisma.hiveComment.findMany({
    where: { hiveId: hive.id },
    include: {
      author: { select: { id: true, username: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return res.json({
    id: hive.id,
    title: hive.title,
    boardData: hive.boardData,
    owner: hive.owner,
    createdAt: hive.createdAt,
    updatedAt: hive.updatedAt,
    canEdit: canEditHive(hive, req.user),
    canComment: canCommentOnHive(hive, req.user),
    collaborators: hive.collaborators.map((c) => ({
      id: c.user.id,
      username: c.user.username,
      email: c.user.email,
      role: c.role,
    })),
    comments: comments.map((comment) => ({
      id: comment.id,
      message: comment.message,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      author: comment.author,
    })),
  });
});

hivesRouter.put("/:id", async (req, res) => {
  const parsed = hiveInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Donnees de ruche invalides" });
  }

  const hive = await getHiveOr404(req.params.id);
  if (!hive) {
    return res.status(404).json({ error: "Ruche introuvable" });
  }

  if (!canEditHive(hive, req.user)) {
    return res.status(403).json({ error: "Vous ne pouvez pas modifier cette ruche" });
  }

  const updated = await prisma.hive.update({
    where: { id: hive.id },
    data: {
      title: parsed.data.title,
      boardData: parsed.data.boardData,
    },
  });

  return res.json(updated);
});

hivesRouter.delete("/:id", async (req, res) => {
  const hive = await getHiveOr404(req.params.id);
  if (!hive) {
    return res.status(404).json({ error: "Ruche introuvable" });
  }

  if (!(req.user.isAdmin || hive.ownerId === req.user.id)) {
    return res.status(403).json({ error: "Seul le proprietaire peut supprimer cette ruche" });
  }

  await prisma.hive.delete({ where: { id: hive.id } });
  return res.json({ message: "Ruche supprimee" });
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: collaboratorRoleSchema,
});

hivesRouter.post("/:id/collaborators", async (req, res) => {
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invitation invalide" });
  }

  const hive = await getHiveOr404(req.params.id);
  if (!hive) {
    return res.status(404).json({ error: "Ruche introuvable" });
  }

  if (!(req.user.isAdmin || hive.ownerId === req.user.id)) {
    return res.status(403).json({ error: "Seul le proprietaire peut inviter" });
  }

  const invitee = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!invitee) {
    return res.status(404).json({ error: "Aucun compte ne correspond a cet email" });
  }

  if (invitee.id === hive.ownerId) {
    return res.status(400).json({ error: "Le proprietaire est deja membre" });
  }

  const collaborator = await prisma.hiveCollaborator.upsert({
    where: {
      hiveId_userId: {
        hiveId: hive.id,
        userId: invitee.id,
      },
    },
    create: {
      hiveId: hive.id,
      userId: invitee.id,
      role: parsed.data.role,
    },
    update: { role: parsed.data.role },
    include: {
      user: { select: { id: true, username: true, email: true } },
    },
  });

  return res.status(201).json({
    id: collaborator.user.id,
    username: collaborator.user.username,
    email: collaborator.user.email,
    role: collaborator.role,
  });
});

const updateCollaboratorSchema = z.object({
  role: collaboratorRoleSchema,
});

hivesRouter.patch("/:id/collaborators/:userId", async (req, res) => {
  const parsed = updateCollaboratorSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Role invalide" });
  }

  const hive = await getHiveOr404(req.params.id);
  if (!hive) {
    return res.status(404).json({ error: "Ruche introuvable" });
  }

  if (!(req.user.isAdmin || hive.ownerId === req.user.id)) {
    return res.status(403).json({ error: "Seul le proprietaire peut modifier les droits" });
  }

  const updated = await prisma.hiveCollaborator.update({
    where: {
      hiveId_userId: {
        hiveId: hive.id,
        userId: req.params.userId,
      },
    },
    data: {
      role: parsed.data.role,
    },
    include: {
      user: { select: { id: true, username: true, email: true } },
    },
  });

  return res.json({
    id: updated.user.id,
    username: updated.user.username,
    email: updated.user.email,
    role: updated.role,
  });
});

hivesRouter.delete("/:id/collaborators/:userId", async (req, res) => {
  const hive = await getHiveOr404(req.params.id);
  if (!hive) {
    return res.status(404).json({ error: "Ruche introuvable" });
  }

  if (!(req.user.isAdmin || hive.ownerId === req.user.id)) {
    return res.status(403).json({ error: "Seul le proprietaire peut supprimer un collaborateur" });
  }

  await prisma.hiveCollaborator.delete({
    where: {
      hiveId_userId: {
        hiveId: hive.id,
        userId: req.params.userId,
      },
    },
  });

  return res.json({ message: "Collaborateur supprime" });
});

const commentSchema = z.object({
  message: z.string().trim().min(1).max(1200),
});

hivesRouter.post("/:id/comments", async (req, res) => {
  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Commentaire invalide" });
  }

  const hive = await getHiveOr404(req.params.id);
  if (!hive) {
    return res.status(404).json({ error: "Ruche introuvable" });
  }

  if (!canCommentOnHive(hive, req.user)) {
    return res.status(403).json({ error: "Vous ne pouvez pas commenter cette ruche" });
  }

  const comment = await prisma.hiveComment.create({
    data: {
      hiveId: hive.id,
      authorId: req.user.id,
      message: parsed.data.message,
    },
    include: {
      author: { select: { id: true, username: true, email: true } },
    },
  });

  return res.status(201).json(comment);
});

hivesRouter.patch("/:id/comments/:commentId", async (req, res) => {
  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Commentaire invalide" });
  }

  const hive = await getHiveOr404(req.params.id);
  if (!hive || !canReadHive(hive, req.user)) {
    return res.status(404).json({ error: "Ruche introuvable" });
  }

  const comment = await prisma.hiveComment.findUnique({ where: { id: req.params.commentId } });
  if (!comment || comment.hiveId !== hive.id) {
    return res.status(404).json({ error: "Commentaire introuvable" });
  }

  if (!(req.user.isAdmin || comment.authorId === req.user.id)) {
    return res.status(403).json({ error: "Vous ne pouvez modifier que vos commentaires" });
  }

  const updated = await prisma.hiveComment.update({
    where: { id: comment.id },
    data: { message: parsed.data.message },
    include: {
      author: { select: { id: true, username: true, email: true } },
    },
  });

  return res.json(updated);
});

hivesRouter.delete("/:id/comments/:commentId", async (req, res) => {
  const hive = await getHiveOr404(req.params.id);
  if (!hive || !canReadHive(hive, req.user)) {
    return res.status(404).json({ error: "Ruche introuvable" });
  }

  const comment = await prisma.hiveComment.findUnique({ where: { id: req.params.commentId } });
  if (!comment || comment.hiveId !== hive.id) {
    return res.status(404).json({ error: "Commentaire introuvable" });
  }

  if (!(req.user.isAdmin || comment.authorId === req.user.id)) {
    return res.status(403).json({ error: "Vous ne pouvez supprimer que vos commentaires" });
  }

  await prisma.hiveComment.delete({ where: { id: comment.id } });
  return res.json({ message: "Commentaire supprime" });
});
