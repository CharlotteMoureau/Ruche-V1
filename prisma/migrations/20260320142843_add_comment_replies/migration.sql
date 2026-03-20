-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HiveComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hiveId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HiveComment_hiveId_fkey" FOREIGN KEY ("hiveId") REFERENCES "Hive" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HiveComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HiveComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "HiveComment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_HiveComment" ("authorId", "createdAt", "hiveId", "id", "message", "updatedAt") SELECT "authorId", "createdAt", "hiveId", "id", "message", "updatedAt" FROM "HiveComment";
DROP TABLE "HiveComment";
ALTER TABLE "new_HiveComment" RENAME TO "HiveComment";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
