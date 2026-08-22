/*
  Warnings:

  - A unique constraint covering the columns `[invoiceId,sourceJobMaterialId]` on the table `InvoiceLineItem` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "InvoiceLineItem" ADD COLUMN     "sourceJobMaterialId" TEXT;

-- CreateIndex
CREATE INDEX "InvoiceLineItem_sourceJobMaterialId_idx" ON "InvoiceLineItem"("sourceJobMaterialId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceLineItem_invoiceId_sourceJobMaterialId_key" ON "InvoiceLineItem"("invoiceId", "sourceJobMaterialId");

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_sourceJobMaterialId_fkey" FOREIGN KEY ("sourceJobMaterialId") REFERENCES "JobMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE;
