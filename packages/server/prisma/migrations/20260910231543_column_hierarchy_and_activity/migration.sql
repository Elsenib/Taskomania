-- CreateEnum
CREATE TYPE "ColumnType" AS ENUM ('TODO', 'TAKE', 'IN_PROGRESS', 'TESTING', 'DONE', 'FAIL', 'CUSTOM');

-- AlterTable
ALTER TABLE "Column" ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "type" "ColumnType" NOT NULL DEFAULT 'CUSTOM';

-- CreateTable
CREATE TABLE "TaskActivity" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromColumnId" TEXT,
    "toColumnId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskActivity_taskId_idx" ON "TaskActivity"("taskId");

-- CreateIndex
CREATE INDEX "Column_parentId_idx" ON "Column"("parentId");

-- AddForeignKey
ALTER TABLE "Column" ADD CONSTRAINT "Column_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Column"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskActivity" ADD CONSTRAINT "TaskActivity_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
