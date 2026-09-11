-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_teamId_fkey";

-- DropIndex
DROP INDEX "User_teamId_idx";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role",
DROP COLUMN "teamId";

