import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

export const hivesRouter = Router();

hivesRouter.use(requireAuth);

const hiveInputSchema = z.object({
  title: z.string().trim().min(1).max(100),
  boardData: z.any(),
  boardPreviewImage: z.string().max(5_000_000).nullable().optional(),
});

const COLLABORATOR_ROLES = ["ADMIN", "EDITOR", "COMMENT", "READ", "EDIT"];
const collaboratorRoleSchema = z.enum(COLLABORATOR_ROLES);

let invitationsTableReadyPromise = null;

function isEditorRole(role) {
  return role === "EDITOR" || role === "EDIT";
}

function normalizeCollaboratorRole(role) {
  return role === "EDIT" ? "EDITOR" : role;
}

function normalizeInvitationRole(role) {
  return normalizeCollaboratorRole(role);
}

function mapInvitationRow(row) {
  return {
    id: row.id,
    role: row.role,
    status: row.status,
    createdAt: row.createdAt,
    respondedAt: row.respondedAt,
    hive: {
      id: row.hiveId,
      title: row.hiveTitle,
    },
    inviter: {
      id: row.inviterId,
      username: row.inviterUsername,
      email: row.inviterEmail,
    },
  };
}

async function ensureInvitationsTable() {
  if (!invitationsTableReadyPromise) {
    invitationsTableReadyPromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "HiveInvitation" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "hiveId" TEXT NOT NULL,
          "inviterId" TEXT NOT NULL,
          "inviteeId" TEXT NOT NULL,
          "role" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'PENDING',
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "respondedAt" DATETIME,
          CONSTRAINT "HiveInvitation_hiveId_fkey" FOREIGN KEY ("hiveId") REFERENCES "Hive" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "HiveInvitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "HiveInvitation_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
      `);

      await prisma.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "HiveInvitation_inviteeId_status_idx" ON "HiveInvitation"("inviteeId", "status")',
      );
      await prisma.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "HiveInvitation_hiveId_idx" ON "HiveInvitation"("hiveId")',
      );
    })();
  }

  return invitationsTableReadyPromise;
}

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function buildBoardSnapshot(boardData) {
  const boardCards = Array.isArray(boardData?.boardCards)
    ? boardData.boardCards
    : [];

  return boardCards
    .filter((card) => card && typeof card === "object")
    .map((card, index) => ({
      id: String(card.id ?? `card-${index}`),
      title: typeof card.title === "string" ? card.title : "",
      category: typeof card.category === "string" ? card.category : null,
      x: toFiniteNumber(card.position?.x),
      y: toFiniteNumber(card.position?.y),
    }));
}

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
  return (
    user.isAdmin ||
    hive.ownerId === user.id ||
    role === "ADMIN" ||
    isEditorRole(role)
  );
}

function canCommentOnHive(hive, user) {
  const role = getMembershipRole(hive, user.id);
  return (
    user.isAdmin ||
    hive.ownerId === user.id ||
    role === "ADMIN" ||
    isEditorRole(role) ||
    role === "COMMENT"
  );
}

function canManageHive(hive, user) {
  const role = getMembershipRole(hive, user.id);
  return user.isAdmin || hive.ownerId === user.id || role === "ADMIN";
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

hivesRouter.get("/invitations/count", async (req, res) => {
  await ensureInvitationsTable();

  const rows = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM "HiveInvitation"
    WHERE "inviteeId" = ${req.user.id}
      AND "status" = 'PENDING'
  `;

  return res.json({ count: Number(rows[0]?.count || 0) });
});

hivesRouter.get("/invitations", async (req, res) => {
  await ensureInvitationsTable();

  const rows = await prisma.$queryRaw`
    SELECT
      i."id",
      i."role",
      i."status",
      i."createdAt",
      i."respondedAt",
      h."id" as "hiveId",
      h."title" as "hiveTitle",
      u."id" as "inviterId",
      u."username" as "inviterUsername",
      u."email" as "inviterEmail"
    FROM "HiveInvitation" i
    JOIN "Hive" h ON h."id" = i."hiveId"
    JOIN "User" u ON u."id" = i."inviterId"
    WHERE i."inviteeId" = ${req.user.id}
      AND i."status" = 'PENDING'
    ORDER BY i."createdAt" DESC
  `;

  return res.json(rows.map(mapInvitationRow));
});

hivesRouter.post("/invitations/:invitationId/accept", async (req, res) => {
  await ensureInvitationsTable();

  const rows = await prisma.$queryRaw`
    SELECT
      i."id",
      i."hiveId",
      i."inviteeId",
      i."role",
      i."status"
    FROM "HiveInvitation" i
    WHERE i."id" = ${req.params.invitationId}
  `;

  const invitation = rows[0];
  if (!invitation || invitation.inviteeId !== req.user.id) {
    return res.status(404).json({ error: "Invitation introuvable" });
  }

  if (invitation.status !== "PENDING") {
    return res.status(400).json({ error: "Invitation deja traitée" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.hiveCollaborator.upsert({
      where: {
        hiveId_userId: {
          hiveId: invitation.hiveId,
          userId: req.user.id,
        },
      },
      create: {
        hiveId: invitation.hiveId,
        userId: req.user.id,
        role: normalizeInvitationRole(invitation.role),
      },
      update: {
        role: normalizeInvitationRole(invitation.role),
      },
    });

    await tx.$executeRaw`
      UPDATE "HiveInvitation"
      SET "status" = 'ACCEPTED',
          "updatedAt" = CURRENT_TIMESTAMP,
          "respondedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${invitation.id}
    `;
  });

  return res.json({ message: "Invitation acceptée" });
});

hivesRouter.post("/invitations/:invitationId/decline", async (req, res) => {
  await ensureInvitationsTable();

  const rows = await prisma.$queryRaw`
    SELECT
      i."id",
      i."inviteeId",
      i."status"
    FROM "HiveInvitation" i
    WHERE i."id" = ${req.params.invitationId}
  `;

  const invitation = rows[0];
  if (!invitation || invitation.inviteeId !== req.user.id) {
    return res.status(404).json({ error: "Invitation introuvable" });
  }

  if (invitation.status !== "PENDING") {
    return res.status(400).json({ error: "Invitation deja traitée" });
  }

  await prisma.$executeRaw`
    UPDATE "HiveInvitation"
    SET "status" = 'DECLINED',
        "updatedAt" = CURRENT_TIMESTAMP,
        "respondedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${invitation.id}
  `;

  return res.json({ message: "Invitation refusée" });
});

hivesRouter.post("/", async (req, res) => {
  const parsed = hiveInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Données de ruche invalides" });
  }

  const hive = await prisma.hive.create({
    data: {
      title: parsed.data.title,
      boardData: parsed.data.boardData,
      boardSnapshot: buildBoardSnapshot(parsed.data.boardData),
      boardPreviewImage: parsed.data.boardPreviewImage || null,
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
    where: { hiveId: hive.id, parentId: null },
    include: {
      author: { select: { id: true, username: true, email: true } },
      replies: {
        include: {
          author: { select: { id: true, username: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return res.json({
    id: hive.id,
    title: hive.title,
    boardData: hive.boardData,
    boardPreviewImage: hive.boardPreviewImage,
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
      replies: comment.replies.map((reply) => ({
        id: reply.id,
        message: reply.message,
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt,
        author: reply.author,
        parentId: reply.parentId,
      })),
    })),
  });
});

hivesRouter.get("/:id/invitations", async (req, res) => {
  await ensureInvitationsTable();

  const hive = await getHiveOr404(req.params.id);
  if (!hive) {
    return res.status(404).json({ error: "Ruche introuvable" });
  }

  if (!canManageHive(hive, req.user)) {
    return res.status(403).json({ error: "Vous ne pouvez pas consulter les invitations" });
  }

  const rows = await prisma.$queryRaw`
    SELECT
      i."id",
      i."role",
      i."status",
      i."createdAt",
      i."respondedAt",
      h."id" as "hiveId",
      h."title" as "hiveTitle",
      u."id" as "inviterId",
      u."username" as "inviterUsername",
      u."email" as "inviterEmail",
      ui."id" as "inviteeId",
      ui."username" as "inviteeUsername",
      ui."email" as "inviteeEmail"
    FROM "HiveInvitation" i
    JOIN "Hive" h ON h."id" = i."hiveId"
    JOIN "User" u ON u."id" = i."inviterId"
    JOIN "User" ui ON ui."id" = i."inviteeId"
    WHERE i."hiveId" = ${hive.id}
    ORDER BY i."createdAt" DESC
  `;

  return res.json(
    rows.map((row) => ({
      ...mapInvitationRow(row),
      invitee: {
        id: row.inviteeId,
        username: row.inviteeUsername,
        email: row.inviteeEmail,
      },
    })),
  );
});

hivesRouter.put("/:id", async (req, res) => {
  const parsed = hiveInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Données de ruche invalides" });
  }

  const hive = await getHiveOr404(req.params.id);
  if (!hive) {
    return res.status(404).json({ error: "Ruche introuvable" });
  }

  if (!canEditHive(hive, req.user)) {
    return res.status(403).json({ error: "Vous ne pouvez pas modifier cette ruche" });
  }

  const isRenamingHive = parsed.data.title.trim() !== hive.title.trim();
  if (isRenamingHive && !canManageHive(hive, req.user)) {
    return res.status(403).json({ error: "Vous ne pouvez pas renommer cette ruche" });
  }

  const updated = await prisma.hive.update({
    where: { id: hive.id },
    data: {
      title: parsed.data.title,
      boardData: parsed.data.boardData,
      boardSnapshot: buildBoardSnapshot(parsed.data.boardData),
      boardPreviewImage: parsed.data.boardPreviewImage || null,
    },
  });

  return res.json(updated);
});

hivesRouter.delete("/:id", async (req, res) => {
  const hive = await getHiveOr404(req.params.id);
  if (!hive) {
    return res.status(404).json({ error: "Ruche introuvable" });
  }

  if (!canManageHive(hive, req.user)) {
    return res.status(403).json({ error: "Vous ne pouvez pas supprimer cette ruche" });
  }

  await prisma.hive.delete({ where: { id: hive.id } });
  return res.json({ message: "Ruche supprimée" });
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: collaboratorRoleSchema,
});

hivesRouter.post("/:id/collaborators", async (req, res) => {
  await ensureInvitationsTable();

  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invitation invalide" });
  }

  const hive = await getHiveOr404(req.params.id);
  if (!hive) {
    return res.status(404).json({ error: "Ruche introuvable" });
  }

  if (!canManageHive(hive, req.user)) {
    return res.status(403).json({ error: "Vous ne pouvez pas inviter de collaborateurs" });
  }

  const invitee = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!invitee) {
    return res.status(404).json({ error: "Aucun compte ne correspond a cet email" });
  }

  if (invitee.id === hive.ownerId) {
    return res.status(400).json({ error: "Le propriétaire est deja membre" });
  }

  const existingCollaborator = await prisma.hiveCollaborator.findUnique({
    where: {
      hiveId_userId: {
        hiveId: hive.id,
        userId: invitee.id,
      },
    },
  });

  if (existingCollaborator) {
    return res.status(400).json({ error: "Cet utilisateur est deja collaborateur" });
  }

  const pendingRows = await prisma.$queryRaw`
    SELECT "id"
    FROM "HiveInvitation"
    WHERE "hiveId" = ${hive.id}
      AND "inviteeId" = ${invitee.id}
      AND "status" = 'PENDING'
    LIMIT 1
  `;

  const normalizedRole = normalizeInvitationRole(parsed.data.role);

  if (pendingRows[0]?.id) {
    await prisma.$executeRaw`
      UPDATE "HiveInvitation"
      SET "role" = ${normalizedRole},
          "inviterId" = ${req.user.id},
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${pendingRows[0].id}
    `;

    return res.status(200).json({
      id: invitee.id,
      username: invitee.username,
      email: invitee.email,
      role: normalizedRole,
      status: "PENDING",
    });
  }

  await prisma.$executeRaw`
    INSERT INTO "HiveInvitation" (
      "id", "hiveId", "inviterId", "inviteeId", "role", "status", "createdAt", "updatedAt"
    ) VALUES (
      ${randomUUID()},
      ${hive.id},
      ${req.user.id},
      ${invitee.id},
      ${normalizedRole},
      'PENDING',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `;

  return res.status(201).json({
    id: invitee.id,
    username: invitee.username,
    email: invitee.email,
    role: normalizedRole,
    status: "PENDING",
  });
});

const updateCollaboratorSchema = z.object({
  role: collaboratorRoleSchema,
});

hivesRouter.patch("/:id/collaborators/:userId", async (req, res) => {
  const parsed = updateCollaboratorSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Rôle invalide" });
  }

  const hive = await getHiveOr404(req.params.id);
  if (!hive) {
    return res.status(404).json({ error: "Ruche introuvable" });
  }

  if (!canManageHive(hive, req.user)) {
    return res.status(403).json({ error: "Vous ne pouvez pas modifier les droits" });
  }

  const updated = await prisma.hiveCollaborator.update({
    where: {
      hiveId_userId: {
        hiveId: hive.id,
        userId: req.params.userId,
      },
    },
    data: {
      role: normalizeCollaboratorRole(parsed.data.role),
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

  const isOwnerOrAdmin = canManageHive(hive, req.user);
  const isSelfRemoval = req.user.id === req.params.userId;

  if (!(isOwnerOrAdmin || isSelfRemoval)) {
    return res.status(403).json({ error: "Action non autorisée" });
  }

  await prisma.hiveCollaborator.delete({
    where: {
      hiveId_userId: {
        hiveId: hive.id,
        userId: req.params.userId,
      },
    },
  });

  return res.json({ message: "Collaborateur supprimé" });
});

const commentSchema = z.object({
  message: z.string().trim().min(1).max(1200),
  parentId: z.string().optional(),
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

  let resolvedParentId = null;
  if (parsed.data.parentId) {
    const parent = await prisma.hiveComment.findUnique({ where: { id: parsed.data.parentId } });
    if (!parent || parent.hiveId !== hive.id) {
      return res.status(400).json({ error: "Commentaire parent introuvable" });
    }
    // Replies always attach to the top-level parent (no third tier)
    resolvedParentId = parent.parentId ?? parent.id;
  }

  const comment = await prisma.hiveComment.create({
    data: {
      hiveId: hive.id,
      authorId: req.user.id,
      message: parsed.data.message,
      parentId: resolvedParentId,
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
  return res.json({ message: "Commentaire supprimé" });
});
