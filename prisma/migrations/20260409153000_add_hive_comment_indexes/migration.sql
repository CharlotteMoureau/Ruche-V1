CREATE INDEX IF NOT EXISTS "HiveComment_hiveId_parentId_createdAt_idx"
ON "HiveComment"("hiveId", "parentId", "createdAt");

CREATE INDEX IF NOT EXISTS "HiveComment_hiveId_createdAt_idx"
ON "HiveComment"("hiveId", "createdAt");
