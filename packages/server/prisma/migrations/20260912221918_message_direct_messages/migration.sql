-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "toUserId" TEXT;

-- CreateIndex
CREATE INDEX "Message_teamId_authorId_toUserId_idx" ON "Message"("teamId", "authorId", "toUserId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
