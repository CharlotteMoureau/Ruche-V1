ALTER TABLE "HiveComment"
ADD COLUMN "parentId" TEXT;

ALTER TABLE "HiveComment"
ADD CONSTRAINT "HiveComment_parentId_fkey"
FOREIGN KEY ("parentId") REFERENCES "HiveComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
