-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CustomerActivityType" ADD VALUE 'JOB_CONTACT_CREATED';
ALTER TYPE "CustomerActivityType" ADD VALUE 'JOB_CONTACT_UPDATED';
ALTER TYPE "CustomerActivityType" ADD VALUE 'JOB_CONTACT_DELETED';

-- CreateTable
CREATE TABLE "JobContact" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "role" TEXT,
    "notes" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobContact_organizationId_idx" ON "JobContact"("organizationId");

-- CreateIndex
CREATE INDEX "JobContact_jobId_idx" ON "JobContact"("jobId");

-- CreateIndex
CREATE INDEX "JobContact_organizationId_jobId_idx" ON "JobContact"("organizationId", "jobId");

-- CreateIndex
CREATE INDEX "JobContact_jobId_isPrimary_idx" ON "JobContact"("jobId", "isPrimary");

-- AddForeignKey
ALTER TABLE "JobContact" ADD CONSTRAINT "JobContact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobContact" ADD CONSTRAINT "JobContact_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
