-- AlterTable
ALTER TABLE "EstimateLineItem" ADD COLUMN     "sourceJobMaterialId" TEXT;

-- CreateIndex
CREATE INDEX "EstimateLineItem_sourceJobMaterialId_idx" ON "EstimateLineItem"("sourceJobMaterialId");
