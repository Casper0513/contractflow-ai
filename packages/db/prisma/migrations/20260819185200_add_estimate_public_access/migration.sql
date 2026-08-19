/*
  Warnings:

  - A unique constraint covering the columns `[publicAccessToken]` on the table `Estimate` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Estimate" ADD COLUMN     "publicAccessCreatedAt" TIMESTAMP(3),
ADD COLUMN     "publicAccessToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Estimate_publicAccessToken_key" ON "Estimate"("publicAccessToken");
