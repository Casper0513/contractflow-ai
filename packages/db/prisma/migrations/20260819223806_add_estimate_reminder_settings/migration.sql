-- CreateTable
CREATE TABLE "EstimateReminderSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "firstFollowUpEnabled" BOOLEAN NOT NULL DEFAULT true,
    "firstFollowUpDays" INTEGER NOT NULL DEFAULT 3,
    "secondFollowUpEnabled" BOOLEAN NOT NULL DEFAULT true,
    "secondFollowUpDays" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstimateReminderSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EstimateReminderSettings_organizationId_key" ON "EstimateReminderSettings"("organizationId");

-- AddForeignKey
ALTER TABLE "EstimateReminderSettings" ADD CONSTRAINT "EstimateReminderSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
