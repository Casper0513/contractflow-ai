/*
  Warnings:

  - A unique constraint covering the columns `[publicAccessToken]` on the table `Invoice` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "publicAccessCreatedAt" TIMESTAMP(3),
ADD COLUMN     "publicAccessToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_publicAccessToken_key" ON "Invoice"("publicAccessToken");
