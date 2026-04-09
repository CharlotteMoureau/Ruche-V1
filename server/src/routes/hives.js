import { randomUUID } from "node:crypto";
import process from "node:process";
import { Router } from "express";
import { z } from "zod";
import { HIVE_KINDS, normalizeHiveKind } from "../lib/hives.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

export const hivesRouter = Router();

hivesRouter.use(requireAuth);

const hiveInputSchema = z.object({
  title: z.string().trim().min(1).max(100),
  boardData: z.any(),
  boardPreviewImage: z.string().trim().max(260_000).optional(),
  kind: z.string().trim().optional(),
  expectedUpdatedAt: z.string().trim().optional(),
});

function getHiveInputValidationResponse(error) {
  const titleTooLong = error?.issues?.some(
    (issue) =>
      issue.path?.[0] === "title" &&
      issue.code === "too_big" &&
      issue.maximum === 100,
  );

  if (titleTooLong) {
    return {
      status: 400,
      body: {
        error: "Hive title must be 100 characters or fewer",
        code: "HIVE_TITLE_TOO_LONG",
      },
    };
  }

  return {
    status: 400,
    body: {
      error: "Invalid hive data",
      code: "HIVE_INVALID_DATA",
    },
  };
}

const cardNoteSchema = z.object({
  message: z.string().trim().min(1).max(1200),
});

const COLLABORATOR_ROLES = ["ADMIN", "EDITOR", "COMMENT", "READ", "EDIT"];
const collaboratorRoleSchema = z.enum(COLLABORATOR_ROLES);
const PRESENCE_TTL_MS = 30_000;
const COMMENT_PAGE_LIMIT_DEFAULT = 30;
const COMMENT_PAGE_LIMIT_MAX = 100;
const COMMENT_RATE_WINDOW_MS = Number(process.env.HIVE_COMMENT_RATE_WINDOW_MS || 60_000);
const COMMENT_RATE_MAX = Number(process.env.HIVE_COMMENT_RATE_MAX || 20);
const MAX_COMMENTS_PER_HIVE = Number(process.env.HIVE_MAX_COMMENTS || 100);

const hivePresence = new Map();
const commentRateBuckets = new Map();

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
          "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "respondedAt" TIMESTAMPTZ(3),
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
    })().catch((error) => {
      invitationsTableReadyPromise = null;
      throw error;
    });
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

function sanitizePreviewImage(value) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (!trimmed.startsWith("data:image/webp;base64,")) {
    return null;
  }

  return trimmed;
}

function updateBoardCard(boardData, cardId, updater) {
  const sourceBoardData =
    boardData && typeof boardData === "object" ? boardData : {};
  const boardCards = Array.isArray(sourceBoardData.boardCards)
    ? sourceBoardData.boardCards
    : [];

  let found = false;
  const nextBoardCards = boardCards.map((card) => {
    if (!card || typeof card !== "object") {
      return card;
    }

    if (String(card.id) !== String(cardId)) {
      return card;
    }

    found = true;
    return updater(card);
  });

  if (!found) {
    return null;
  }

  return {
    ...sourceBoardData,
    boardCards: nextBoardCards,
  };
}

function buildUserActor(user) {
  return {
    id: user?.id || null,
    username: user?.username || null,
    email: user?.email || null,
  };
}

function mapComment(comment) {
  return {
    id: comment.id,
    message: comment.message,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    author: comment.author,
    replies: (comment.replies || []).map((reply) => ({
      id: reply.id,
      message: reply.message,
      createdAt: reply.createdAt,
      updatedAt: reply.updatedAt,
      author: reply.author,
      parentId: reply.parentId,
    })),
  };
}

function parseCommentPageLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return COMMENT_PAGE_LIMIT_DEFAULT;
  return Math.min(
    COMMENT_PAGE_LIMIT_MAX,
    Math.max(1, Math.trunc(parsed)),
  );
}

async function fetchHiveCommentsPage(hiveId, { limit, cursor }) {
  const pageLimit = parseCommentPageLimit(limit);
  const findManyArgs = {
    where: { hiveId, parentId: null },
    include: {
      author: { select: { id: true, username: true, email: true } },
      replies: {
        include: {
          author: { select: { id: true, username: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: pageLimit + 1,
  };

  if (cursor) {
    findManyArgs.cursor = { id: cursor };
    findManyArgs.skip = 1;
  }

  const [rows, totalCommentCount] = await Promise.all([
    prisma.hiveComment.findMany(findManyArgs),
    prisma.hiveComment.count({ where: { hiveId } }),
  ]);

  const hasMore = rows.length > pageLimit;
  const pageRows = hasMore ? rows.slice(0, pageLimit) : rows;
  const nextCursor = hasMore ? pageRows[pageRows.length - 1]?.id || null : null;

  return {
    comments: pageRows.map(mapComment),
    pagination: {
      limit: pageLimit,
      hasMore,
      nextCursor,
      totalCommentCount,
    },
  };
}

function isCommentRateLimited(hiveId, userId) {
  const key = `${hiveId}:${userId}`;
  const now = Date.now();
  const windowStart = now - COMMENT_RATE_WINDOW_MS;
  const previous = commentRateBuckets.get(key) || [];
  const fresh = previous.filter((timestamp) => timestamp >= windowStart);

  if (fresh.length >= COMMENT_RATE_MAX) {
    commentRateBuckets.set(key, fresh);
    return true;
  }

  fresh.push(now);
  commentRateBuckets.set(key, fresh);
  return false;
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

function getOrCreatePresenceBucket(hiveId) {
  let bucket = hivePresence.get(hiveId);
  if (!bucket) {
    bucket = new Map();
    hivePresence.set(hiveId, bucket);
  }
  return bucket;
}

function prunePresence(hiveId) {
  const bucket = hivePresence.get(hiveId);
  if (!bucket) return;

  const now = Date.now();
  for (const [userId, entry] of bucket.entries()) {
    if (now - entry.lastSeenAt > PRESENCE_TTL_MS) {
      bucket.delete(userId);
    }
  }

  if (bucket.size === 0) {
    hivePresence.delete(hiveId);
  }
}

function listPresence(hiveId) {
  prunePresence(hiveId);
  const bucket = hivePresence.get(hiveId);
  if (!bucket) return [];

  return Array.from(bucket.values())
    .map((entry) => ({
      userId: entry.userId,
      username: entry.username,
      lastSeenAt: new Date(entry.lastSeenAt).toISOString(),
    }))
    .sort((a, b) => a.username.localeCompare(b.username));
}

function registerPresence(hiveId, user) {
  const bucket = getOrCreatePresenceBucket(hiveId);
  bucket.set(user.id, {
    userId: user.id,
    username: user.username || user.email || "unknown",
    lastSeenAt: Date.now(),
  });
}

function removePresence(hiveId, userId) {
  const bucket = hivePresence.get(hiveId);
  if (!bucket) return;

  bucket.delete(userId);
  if (bucket.size === 0) {
    hivePresence.delete(hiveId);
  }
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
      kind: hive.kind,
      owner: hive.owner,
      createdAt: hive.createdAt,
      updatedAt: hive.updatedAt,
      collaboratorRole: hive.collaborators[0]?.role || null,
      isOwner: hive.ownerId === req.user.id,
    })),
  );
});

hivesRouter.get("/invitations/count", async (req, res) => {
  try {
    await ensureInvitationsTable();

    const rows = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM "HiveInvitation"
      WHERE "inviteeId" = ${req.user.id}
        AND "status" = 'PENDING'
    `;

    return res.json({ count: Number(rows[0]?.count || 0) });
  } catch (error) {
    console.error("Failed to fetch invitations count", error);
    return res.json({ count: 0 });
  }
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
    return res.status(404).json({ error: "Invitation not found" });
  }

  if (invitation.status !== "PENDING") {
    return res.status(400).json({ error: "Invitation already processed" });
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

  return res.json({ message: "Invitation accepted" });
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
    return res.status(404).json({ error: "Invitation not found" });
  }

  if (invitation.status !== "PENDING") {
    return res.status(400).json({ error: "Invitation already processed" });
  }

  await prisma.$executeRaw`
    UPDATE "HiveInvitation"
    SET "status" = 'DECLINED',
        "updatedAt" = CURRENT_TIMESTAMP,
        "respondedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${invitation.id}
  `;

  return res.json({ message: "Invitation declined" });
});

hivesRouter.post("/", async (req, res) => {
  const parsed = hiveInputSchema.safeParse(req.body);
  if (!parsed.success) {
    const validation = getHiveInputValidationResponse(parsed.error);
    return res.status(validation.status).json(validation.body);
  }

  const isDcoUser = req.user.roleLabel === "Délégué au Contrat d'Objectifs";
  const requestedKind = normalizeHiveKind(parsed.data.kind);
  const isTryingToDcoHive = requestedKind === HIVE_KINDS.DCO;

  // Only DCO delegates can create DCO hives
  if (isTryingToDcoHive && !isDcoUser) {
    return res.status(403).json({
      error: "Only objective contract delegates can create DCO hives",
    });
  }

  const finalKind = isTryingToDcoHive
    ? HIVE_KINDS.DCO
    : HIVE_KINDS.STANDARD;

  const hive = await prisma.hive.create({
    data: {
      title: parsed.data.title,
      kind: finalKind,
      boardData: parsed.data.boardData,
      boardSnapshot: buildBoardSnapshot(parsed.data.boardData),
      boardPreviewImage: sanitizePreviewImage(parsed.data.boardPreviewImage),
      ownerId: req.user.id,
    },
  });

  return res.status(201).json(hive);
});

hivesRouter.get("/:id", async (req, res) => {
  const hive = await getHiveOr404(req.params.id);
  if (!hive) {
    return res.status(404).json({ error: "Hive not found", code: "HIVE_NOT_FOUND" });
  }

  if (!canReadHive(hive, req.user)) {
    return res.status(403).json({ error: "Access denied", code: "HIVE_ACCESS_DENIED" });
  }

  const commentsPage = await fetchHiveCommentsPage(hive.id, {
    limit: req.query.commentsLimit,
    cursor: req.query.commentsCursor,
  });

  return res.json({
    id: hive.id,
    title: hive.title,
    kind: hive.kind,
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
    comments: commentsPage.comments,
    commentsPagination: commentsPage.pagination,
  });
});

hivesRouter.get("/:id/comments", async (req, res) => {
  const hive = await getHiveOr404(req.params.id);
  if (!hive) {
    return res.status(404).json({ error: "Hive not found", code: "HIVE_NOT_FOUND" });
  }

  if (!canReadHive(hive, req.user)) {
    return res.status(403).json({ error: "Access denied", code: "HIVE_ACCESS_DENIED" });
  }

  const page = await fetchHiveCommentsPage(hive.id, {
    limit: req.query.limit,
    cursor: req.query.cursor,
  });

  return res.json(page);
});

hivesRouter.get("/:id/invitations", async (req, res) => {
  await ensureInvitationsTable();

  const hive = await getHiveOr404(req.params.id);
  if (!hive) {
    return res.status(404).json({ error: "Hive not found" });
  }

  if (!canManageHive(hive, req.user)) {
    return res.status(403).json({ error: "You are not allowed to view invitations" });
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

hivesRouter.get("/:id/presence", async (req, res) => {
  const hive = await getHiveOr404(req.params.id);
  if (!hive) {
    return res.status(404).json({ error: "Hive not found" });
  }

  if (!canReadHive(hive, req.user)) {
    return res.status(403).json({ error: "Access denied" });
  }

  return res.json({
    activeEditors: listPresence(hive.id),
  });
});

hivesRouter.post("/:id/presence", async (req, res) => {
  const hive = await getHiveOr404(req.params.id);
  if (!hive) {
    return res.status(404).json({ error: "Hive not found" });
  }

  if (!canReadHive(hive, req.user)) {
    return res.status(403).json({ error: "Access denied" });
  }

  registerPresence(hive.id, req.user);

  return res.json({
    activeEditors: listPresence(hive.id),
  });
});

hivesRouter.delete("/:id/presence", async (req, res) => {
  const hive = await getHiveOr404(req.params.id);
  if (!hive) {
    return res.status(404).json({ error: "Hive not found" });
  }

  if (!canReadHive(hive, req.user)) {
    return res.status(403).json({ error: "Access denied" });
  }

  removePresence(hive.id, req.user.id);
  return res.json({ ok: true });
});

hivesRouter.put("/:id", async (req, res) => {
  const parsed = hiveInputSchema.safeParse(req.body);
  if (!parsed.success) {
    const validation = getHiveInputValidationResponse(parsed.error);
    return res.status(validation.status).json(validation.body);
  }

  const hive = await getHiveOr404(req.params.id);
  if (!hive) {
    return res.status(404).json({ error: "Hive not found", code: "HIVE_NOT_FOUND" });
  }

  if (!canEditHive(hive, req.user)) {
    return res.status(403).json({
      error: "You are not allowed to edit this hive",
      code: "HIVE_EDIT_FORBIDDEN",
    });
  }

  const isRenamingHive = parsed.data.title.trim() !== hive.title.trim();
  if (isRenamingHive && !canManageHive(hive, req.user)) {
    return res.status(403).json({
      error: "You are not allowed to rename this hive",
      code: "HIVE_RENAME_FORBIDDEN",
    });
  }

  const expectedUpdatedAt = parsed.data.expectedUpdatedAt?.trim();
  if (!expectedUpdatedAt) {
    return res.status(409).json({
      error: "Missing hive version. Reload the hive before saving.",
      code: "HIVE_VERSION_REQUIRED",
      currentUpdatedAt: hive.updatedAt.toISOString(),
    });
  }

  const expectedTimestamp = Date.parse(expectedUpdatedAt);
  if (Number.isNaN(expectedTimestamp)) {
    return res.status(400).json({ error: "Invalid hive version", code: "HIVE_VERSION_INVALID" });
  }

  if (expectedTimestamp !== hive.updatedAt.getTime()) {
    return res.status(409).json({
      error: "This hive was modified by another collaborator. Reload it before saving.",
      code: "HIVE_VERSION_CONFLICT",
      currentUpdatedAt: hive.updatedAt.toISOString(),
    });
  }

  const updated = await prisma.hive.update({
    where: { id: hive.id },
    data: {
      title: parsed.data.title,
      kind: normalizeHiveKind(parsed.data.kind || hive.kind),
      boardData: parsed.data.boardData,
      boardSnapshot: buildBoardSnapshot(parsed.data.boardData),
      boardPreviewImage:
        sanitizePreviewImage(parsed.data.boardPreviewImage) ||
        hive.boardPreviewImage,
    },
  });

  return res.json(updated);
});

hivesRouter.delete("/:id", async (req, res) => {
  const hive = await getHiveOr404(req.params.id);
  if (!hive) {
    return res.status(404).json({ error: "Hive not found" });
  }

  if (!canManageHive(hive, req.user)) {
    return res.status(403).json({ error: "You are not allowed to delete this hive" });
  }

  await prisma.hive.delete({ where: { id: hive.id } });
  return res.json({ message: "Hive deleted" });
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: collaboratorRoleSchema,
});

hivesRouter.post("/:id/collaborators", async (req, res) => {
  await ensureInvitationsTable();

  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid invitation" });
  }

  const hive = await getHiveOr404(req.params.id);
  if (!hive) {
    return res.status(404).json({ error: "Hive not found" });
  }

  if (!canManageHive(hive, req.user)) {
    return res.status(403).json({ error: "You are not allowed to invite collaborators" });
  }

  const invitee = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!invitee) {
    return res.status(404).json({ error: "No account matches this email" });
  }

  if (invitee.id === hive.ownerId) {
    return res.status(400).json({ error: "The owner is already a member" });
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
    return res.status(400).json({ error: "This user is already a collaborator" });
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
    return res.status(400).json({ error: "Invalid role" });
  }

  const hive = await getHiveOr404(req.params.id);
  if (!hive) {
    return res.status(404).json({ error: "Hive not found" });
  }

  if (!canManageHive(hive, req.user)) {
    return res.status(403).json({ error: "You are not allowed to change permissions" });
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
    return res.status(404).json({ error: "Hive not found" });
  }

  const isOwnerOrAdmin = canManageHive(hive, req.user);
  const isSelfRemoval = req.user.id === req.params.userId;

  if (!(isOwnerOrAdmin || isSelfRemoval)) {
    return res.status(403).json({ error: "Unauthorized action" });
  }

  await prisma.hiveCollaborator.delete({
    where: {
      hiveId_userId: {
        hiveId: hive.id,
        userId: req.params.userId,
      },
    },
  });

  return res.json({ message: "Collaborator removed" });
});

const commentSchema = z.object({
  message: z.string().trim().min(1).max(500),
  parentId: z.string().optional(),
});

hivesRouter.put("/:id/cards/:cardId/note", async (req, res) => {
  const parsed = cardNoteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid card note",
      code: "HIVE_CARD_NOTE_INVALID",
    });
  }

  const hive = await getHiveOr404(req.params.id);
  if (!hive) {
    return res.status(404).json({ error: "Hive not found", code: "HIVE_NOT_FOUND" });
  }

  if (!canCommentOnHive(hive, req.user)) {
    return res.status(403).json({
      error: "You are not allowed to comment on this hive",
      code: "HIVE_CARD_NOTE_FORBIDDEN",
    });
  }

  const actor = buildUserActor(req.user);
  const now = new Date().toISOString();
  const nextBoardData = updateBoardCard(hive.boardData, req.params.cardId, (card) => {
    const existingComment =
      card.comment && typeof card.comment === "object" ? card.comment : null;
    const isNewComment = !existingComment?.message;

    return {
      ...card,
      comment: {
        message: parsed.data.message,
        createdAt: existingComment?.createdAt || now,
        createdBy: existingComment?.createdBy || actor,
        updatedAt: now,
        updatedBy: isNewComment ? existingComment?.createdBy || actor : actor,
      },
    };
  });

  if (!nextBoardData) {
    return res.status(404).json({
      error: "Card not found in this hive",
      code: "HIVE_CARD_NOTE_CARD_NOT_FOUND",
    });
  }

  const updated = await prisma.hive.update({
    where: { id: hive.id },
    data: {
      boardData: nextBoardData,
      boardSnapshot: buildBoardSnapshot(nextBoardData),
    },
  });

  return res.json({
    boardData: updated.boardData,
    updatedAt: updated.updatedAt,
  });
});

hivesRouter.delete("/:id/cards/:cardId/note", async (req, res) => {
  const hive = await getHiveOr404(req.params.id);
  if (!hive) {
    return res.status(404).json({ error: "Hive not found", code: "HIVE_NOT_FOUND" });
  }

  if (!canCommentOnHive(hive, req.user)) {
    return res.status(403).json({
      error: "You are not allowed to comment on this hive",
      code: "HIVE_CARD_NOTE_FORBIDDEN",
    });
  }

  const nextBoardData = updateBoardCard(hive.boardData, req.params.cardId, (card) => {
    if (!card.comment || typeof card.comment !== "object") {
      return card;
    }

    const nextCard = { ...card };
    delete nextCard.comment;
    return nextCard;
  });

  if (!nextBoardData) {
    return res.status(404).json({
      error: "Card not found in this hive",
      code: "HIVE_CARD_NOTE_CARD_NOT_FOUND",
    });
  }

  const updated = await prisma.hive.update({
    where: { id: hive.id },
    data: {
      boardData: nextBoardData,
      boardSnapshot: buildBoardSnapshot(nextBoardData),
    },
  });

  return res.json({
    boardData: updated.boardData,
    updatedAt: updated.updatedAt,
  });
});

hivesRouter.post("/:id/comments", async (req, res) => {
  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid comment", code: "HIVE_COMMENT_INVALID" });
  }

  const hive = await getHiveOr404(req.params.id);
  if (!hive) {
    return res.status(404).json({ error: "Hive not found", code: "HIVE_NOT_FOUND" });
  }

  if (!canCommentOnHive(hive, req.user)) {
    return res.status(403).json({
      error: "You are not allowed to comment on this hive",
      code: "HIVE_COMMENT_FORBIDDEN",
    });
  }

  if (isCommentRateLimited(hive.id, req.user.id)) {
    return res.status(429).json({
      error: "Too many comment actions. Please wait and try again.",
      code: "HIVE_COMMENT_RATE_LIMIT",
    });
  }

  const commentCount = await prisma.hiveComment.count({ where: { hiveId: hive.id } });
  if (commentCount >= MAX_COMMENTS_PER_HIVE) {
    return res.status(400).json({
      error: "Maximum number of comments reached for this hive",
      code: "HIVE_COMMENT_LIMIT_REACHED",
    });
  }

  let resolvedParentId = null;
  if (parsed.data.parentId) {
    const parent = await prisma.hiveComment.findUnique({ where: { id: parsed.data.parentId } });
    if (!parent || parent.hiveId !== hive.id) {
      return res.status(400).json({
        error: "Parent comment not found",
        code: "HIVE_COMMENT_PARENT_NOT_FOUND",
      });
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
    return res.status(400).json({ error: "Invalid comment", code: "HIVE_COMMENT_INVALID" });
  }

  const hive = await getHiveOr404(req.params.id);
  if (!hive || !canReadHive(hive, req.user)) {
    return res.status(404).json({ error: "Hive not found", code: "HIVE_NOT_FOUND" });
  }

  const comment = await prisma.hiveComment.findUnique({ where: { id: req.params.commentId } });
  if (!comment || comment.hiveId !== hive.id) {
    return res.status(404).json({ error: "Comment not found", code: "HIVE_COMMENT_NOT_FOUND" });
  }

  if (!(req.user.isAdmin || comment.authorId === req.user.id)) {
    return res.status(403).json({
      error: "You can only edit your own comments",
      code: "HIVE_COMMENT_EDIT_OWN_ONLY",
    });
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
    return res.status(404).json({ error: "Hive not found", code: "HIVE_NOT_FOUND" });
  }

  const comment = await prisma.hiveComment.findUnique({ where: { id: req.params.commentId } });
  if (!comment || comment.hiveId !== hive.id) {
    return res.status(404).json({ error: "Comment not found", code: "HIVE_COMMENT_NOT_FOUND" });
  }

  if (!(req.user.isAdmin || comment.authorId === req.user.id)) {
    return res.status(403).json({
      error: "You can only delete your own comments",
      code: "HIVE_COMMENT_DELETE_OWN_ONLY",
    });
  }

  await prisma.hiveComment.delete({ where: { id: comment.id } });
  return res.json({ message: "Comment deleted" });
});
