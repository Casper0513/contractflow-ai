-- CreateEnum
CREATE TYPE "JobTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobTaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "JobTask" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "JobTaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "JobTaskPriority" NOT NULL DEFAULT 'NORMAL',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobTask_organizationId_idx" ON "JobTask"("organizationId");

-- CreateIndex
CREATE INDEX "JobTask_jobId_idx" ON "JobTask"("jobId");

-- CreateIndex
CREATE INDEX "JobTask_jobId_status_idx" ON "JobTask"("jobId", "status");

-- CreateIndex
CREATE INDEX "JobTask_createdByUserId_idx" ON "JobTask"("createdByUserId");

-- CreateIndex
CREATE INDEX "JobTask_dueDate_idx" ON "JobTask"("dueDate");

-- AddForeignKey
ALTER TABLE "JobTask" ADD CONSTRAINT "JobTask_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobTask" ADD CONSTRAINT "JobTask_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobTask" ADD CONSTRAINT "JobTask_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
