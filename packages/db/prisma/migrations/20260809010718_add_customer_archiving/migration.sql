-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Customer_organizationId_archivedAt_idx" ON "Customer"("organizationId", "archivedAt");
