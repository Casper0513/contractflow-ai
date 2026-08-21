-- CreateEnum
CREATE TYPE "JobCostCategory" AS ENUM ('MATERIAL', 'LABOR', 'SUBCONTRACTOR', 'EQUIPMENT', 'PERMIT', 'TRAVEL', 'OTHER');

-- CreateTable
CREATE TABLE "JobCost" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "category" "JobCostCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "incurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vendor" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobCost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobCost_organizationId_idx" ON "JobCost"("organizationId");

-- CreateIndex
CREATE INDEX "JobCost_jobId_idx" ON "JobCost"("jobId");

-- CreateIndex
CREATE INDEX "JobCost_createdByUserId_idx" ON "JobCost"("createdByUserId");

-- CreateIndex
CREATE INDEX "JobCost_organizationId_category_idx" ON "JobCost"("organizationId", "category");

-- CreateIndex
CREATE INDEX "JobCost_organizationId_incurredAt_idx" ON "JobCost"("organizationId", "incurredAt");

-- CreateIndex
CREATE INDEX "JobCost_jobId_incurredAt_idx" ON "JobCost"("jobId", "incurredAt");

-- AddForeignKey
ALTER TABLE "JobCost" ADD CONSTRAINT "JobCost_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobCost" ADD CONSTRAINT "JobCost_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobCost" ADD CONSTRAINT "JobCost_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
