-- CreateEnum
CREATE TYPE "JobMaterialStatus" AS ENUM ('REQUIRED', 'ORDERED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobMaterialUnit" AS ENUM ('EACH', 'FOOT', 'METER', 'SQUARE_FOOT', 'SQUARE_METER', 'CUBIC_FOOT', 'CUBIC_METER', 'POUND', 'KILOGRAM', 'LITER', 'GALLON', 'BOX', 'BAG', 'BUNDLE', 'ROLL', 'SHEET', 'OTHER');

-- CreateTable
CREATE TABLE "JobMaterial" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "unit" "JobMaterialUnit" NOT NULL DEFAULT 'EACH',
    "supplier" TEXT,
    "sku" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "estimatedUnitCostCents" INTEGER,
    "actualUnitCostCents" INTEGER,
    "status" "JobMaterialStatus" NOT NULL DEFAULT 'REQUIRED',
    "orderedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobMaterial_organizationId_idx" ON "JobMaterial"("organizationId");

-- CreateIndex
CREATE INDEX "JobMaterial_jobId_idx" ON "JobMaterial"("jobId");

-- CreateIndex
CREATE INDEX "JobMaterial_createdByUserId_idx" ON "JobMaterial"("createdByUserId");

-- CreateIndex
CREATE INDEX "JobMaterial_organizationId_status_idx" ON "JobMaterial"("organizationId", "status");

-- CreateIndex
CREATE INDEX "JobMaterial_jobId_status_idx" ON "JobMaterial"("jobId", "status");

-- AddForeignKey
ALTER TABLE "JobMaterial" ADD CONSTRAINT "JobMaterial_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMaterial" ADD CONSTRAINT "JobMaterial_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMaterial" ADD CONSTRAINT "JobMaterial_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
