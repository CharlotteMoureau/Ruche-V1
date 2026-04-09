import process from "node:process";
import { prisma } from "./prisma.js";

const MIN_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PENDING_INVITATION_RETENTION_DAYS = 60;

function parseCleanupIntervalMs() {
  const env = globalThis.process?.env || process.env || {};
  const rawMinutes = Number(env.DB_CLEANUP_INTERVAL_MINUTES || "1440");

  if (!Number.isFinite(rawMinutes) || rawMinutes <= 0) {
    return DEFAULT_CLEANUP_INTERVAL_MS;
  }

  return Math.max(MIN_CLEANUP_INTERVAL_MS, Math.trunc(rawMinutes * 60 * 1000));
}

function parsePendingInvitationRetentionDays() {
  const env = globalThis.process?.env || process.env || {};
  const rawDays = Number(
    env.DB_PENDING_INVITATION_RETENTION_DAYS ||
      String(DEFAULT_PENDING_INVITATION_RETENTION_DAYS),
  );

  if (!Number.isFinite(rawDays) || rawDays <= 0) {
    return DEFAULT_PENDING_INVITATION_RETENTION_DAYS;
  }

  return Math.max(1, Math.trunc(rawDays));
}

function isCleanupEnabled() {
  const env = globalThis.process?.env || process.env || {};
  const value = String(env.DB_CLEANUP_ENABLED || "true").toLowerCase();
  return value !== "false" && value !== "0" && value !== "off";
}

export async function runDatabaseCleanup() {
  const now = new Date();
  const pendingRetentionDays = parsePendingInvitationRetentionDays();
  const pendingInvitationCutoff = new Date(
    now.getTime() - pendingRetentionDays * 24 * 60 * 60 * 1000,
  );

  const expiredOrUsedResetTokens = await prisma.passwordResetToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: now } },
        { usedAt: { not: null } },
      ],
    },
  });

  const processedInvitations = await prisma.$executeRaw`
    DELETE FROM "HiveInvitation"
    WHERE "status" <> 'PENDING'
  `;

  const stalePendingInvitations = await prisma.$executeRaw`
    DELETE FROM "HiveInvitation"
    WHERE "status" = 'PENDING'
      AND "createdAt" < ${pendingInvitationCutoff}
  `;

  return {
    deletedResetTokens: expiredOrUsedResetTokens.count,
    deletedProcessedInvitations: Number(processedInvitations || 0),
    deletedStalePendingInvitations: Number(stalePendingInvitations || 0),
    pendingInvitationRetentionDays: pendingRetentionDays,
  };
}

export function startDatabaseCleanupScheduler() {
  if (!isCleanupEnabled()) {
    console.log("[db-cleanup] Disabled via DB_CLEANUP_ENABLED");
    return null;
  }

  const intervalMs = parseCleanupIntervalMs();

  const runAndLog = async () => {
    try {
      const result = await runDatabaseCleanup();
      if (
        result.deletedResetTokens ||
        result.deletedProcessedInvitations ||
        result.deletedStalePendingInvitations
      ) {
        console.log(
          `[db-cleanup] Deleted ${result.deletedResetTokens} reset tokens, ${result.deletedProcessedInvitations} processed invitations, and ${result.deletedStalePendingInvitations} pending invitations older than ${result.pendingInvitationRetentionDays} days`,
        );
      }
    } catch (error) {
      console.error("[db-cleanup] Failed", error);
    }
  };

  runAndLog();

  const timer = setInterval(runAndLog, intervalMs);
  if (typeof timer.unref === "function") {
    timer.unref();
  }

  console.log(
    `[db-cleanup] Scheduled every ${Math.round(intervalMs / 60000)} minutes`,
  );

  return timer;
}