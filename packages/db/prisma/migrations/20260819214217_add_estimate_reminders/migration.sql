-- CreateEnum
CREATE TYPE "EstimateReminderType" AS ENUM ('FIRST_FOLLOW_UP', 'SECOND_FOLLOW_UP');

-- CreateTable
CREATE TABLE "EstimateReminder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "type" "EstimateReminderType" NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstimateReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EstimateReminder_organizationId_idx" ON "EstimateReminder"("organizationId");

-- CreateIndex
CREATE INDEX "EstimateReminder_estimateId_idx" ON "EstimateReminder"("estimateId");

-- CreateIndex
CREATE INDEX "EstimateReminder_scheduledFor_idx" ON "EstimateReminder"("scheduledFor");

-- CreateIndex
CREATE INDEX "EstimateReminder_sentAt_idx" ON "EstimateReminder"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "EstimateReminder_estimateId_type_key" ON "EstimateReminder"("estimateId", "type");

-- AddForeignKey
ALTER TABLE "EstimateReminder" ADD CONSTRAINT "EstimateReminder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateReminder" ADD CONSTRAINT "EstimateReminder_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
