/*
  Warnings:

  - Changed the type of `role` on the `HiveCollaborator` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "CollaboratorRole" AS ENUM ('ADMIN', 'EDITOR', 'COMMENT', 'READ');

-- AlterTable
ALTER TABLE "HiveCollaborator" DROP COLUMN "role",
ADD COLUMN     "role" "CollaboratorRole" NOT NULL;
