-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CustomerActivityType" ADD VALUE 'JOB_CHECKLIST_CREATED';
ALTER TYPE "CustomerActivityType" ADD VALUE 'JOB_CHECKLIST_UPDATED';
ALTER TYPE "CustomerActivityType" ADD VALUE 'JOB_CHECKLIST_DELETED';
ALTER TYPE "CustomerActivityType" ADD VALUE 'JOB_CHECKLIST_ITEM_COMPLETED';
ALTER TYPE "CustomerActivityType" ADD VALUE 'JOB_CHECKLIST_ITEM_REOPENED';

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobChecklist" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "sourceTemplateId" TEXT,
    "createdByUserId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobChecklistItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "completedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChecklistTemplate_organizationId_idx" ON "ChecklistTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_organizationId_active_idx" ON "ChecklistTemplate"("organizationId", "active");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_organizationId_name_idx" ON "ChecklistTemplate"("organizationId", "name");

-- CreateIndex
CREATE INDEX "ChecklistTemplateItem_templateId_idx" ON "ChecklistTemplateItem"("templateId");

-- CreateIndex
CREATE INDEX "ChecklistTemplateItem_templateId_position_idx" ON "ChecklistTemplateItem"("templateId", "position");

-- CreateIndex
CREATE INDEX "JobChecklist_organizationId_idx" ON "JobChecklist"("organizationId");

-- CreateIndex
CREATE INDEX "JobChecklist_jobId_idx" ON "JobChecklist"("jobId");

-- CreateIndex
CREATE INDEX "JobChecklist_sourceTemplateId_idx" ON "JobChecklist"("sourceTemplateId");

-- CreateIndex
CREATE INDEX "JobChecklist_createdByUserId_idx" ON "JobChecklist"("createdByUserId");

-- CreateIndex
CREATE INDEX "JobChecklist_organizationId_jobId_idx" ON "JobChecklist"("organizationId", "jobId");

-- CreateIndex
CREATE INDEX "JobChecklistItem_organizationId_idx" ON "JobChecklistItem"("organizationId");

-- CreateIndex
CREATE INDEX "JobChecklistItem_checklistId_idx" ON "JobChecklistItem"("checklistId");

-- CreateIndex
CREATE INDEX "JobChecklistItem_completedByUserId_idx" ON "JobChecklistItem"("completedByUserId");

-- CreateIndex
CREATE INDEX "JobChecklistItem_checklistId_position_idx" ON "JobChecklistItem"("checklistId", "position");

-- CreateIndex
CREATE INDEX "JobChecklistItem_checklistId_completedAt_idx" ON "JobChecklistItem"("checklistId", "completedAt");

-- AddForeignKey
ALTER TABLE "ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplateItem" ADD CONSTRAINT "ChecklistTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobChecklist" ADD CONSTRAINT "JobChecklist_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobChecklist" ADD CONSTRAINT "JobChecklist_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobChecklist" ADD CONSTRAINT "JobChecklist_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobChecklistItem" ADD CONSTRAINT "JobChecklistItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobChecklistItem" ADD CONSTRAINT "JobChecklistItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "JobChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobChecklistItem" ADD CONSTRAINT "JobChecklistItem_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
