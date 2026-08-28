-- CreateTable
CREATE TABLE "DispatchSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "defaultStartHour" INTEGER NOT NULL DEFAULT 9,
    "defaultStartMinute" INTEGER NOT NULL DEFAULT 0,
    "defaultDurationMinutes" INTEGER NOT NULL DEFAULT 60,
    "defaultScheduleType" "JobScheduleType" NOT NULL DEFAULT 'WORK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DispatchSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DispatchSettings_organizationId_key" ON "DispatchSettings"("organizationId");

-- AddForeignKey
ALTER TABLE "DispatchSettings" ADD CONSTRAINT "DispatchSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
