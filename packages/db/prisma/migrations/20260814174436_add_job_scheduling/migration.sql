-- CreateEnum
CREATE TYPE "JobScheduleType" AS ENUM ('WORK', 'SITE_VISIT', 'ESTIMATE', 'INSPECTION', 'DELIVERY', 'MEETING', 'OTHER');

-- CreateEnum
CREATE TYPE "JobScheduleStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CustomerActivityType" ADD VALUE 'SCHEDULE_CREATED';
ALTER TYPE "CustomerActivityType" ADD VALUE 'SCHEDULE_UPDATED';
ALTER TYPE "CustomerActivityType" ADD VALUE 'SCHEDULE_CANCELLED';
ALTER TYPE "CustomerActivityType" ADD VALUE 'SCHEDULE_RESTORED';

-- CreateTable
CREATE TABLE "JobSchedule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "type" "JobScheduleType" NOT NULL DEFAULT 'WORK',
    "status" "JobScheduleStatus" NOT NULL DEFAULT 'SCHEDULED',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "notes" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobSchedule_organizationId_idx" ON "JobSchedule"("organizationId");

-- CreateIndex
CREATE INDEX "JobSchedule_jobId_idx" ON "JobSchedule"("jobId");

-- CreateIndex
CREATE INDEX "JobSchedule_organizationId_startAt_idx" ON "JobSchedule"("organizationId", "startAt");

-- CreateIndex
CREATE INDEX "JobSchedule_jobId_startAt_idx" ON "JobSchedule"("jobId", "startAt");

-- CreateIndex
CREATE INDEX "JobSchedule_organizationId_status_idx" ON "JobSchedule"("organizationId", "status");

-- CreateIndex
CREATE INDEX "JobSchedule_createdByUserId_idx" ON "JobSchedule"("createdByUserId");

-- AddForeignKey
ALTER TABLE "JobSchedule" ADD CONSTRAINT "JobSchedule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSchedule" ADD CONSTRAINT "JobSchedule_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSchedule" ADD CONSTRAINT "JobSchedule_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
