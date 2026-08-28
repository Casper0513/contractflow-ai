-- CreateTable
CREATE TABLE "JobScheduleCrewMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobScheduleId" TEXT NOT NULL,
    "crewMemberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobScheduleCrewMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobScheduleCrewMember_organizationId_idx" ON "JobScheduleCrewMember"("organizationId");

-- CreateIndex
CREATE INDEX "JobScheduleCrewMember_jobScheduleId_idx" ON "JobScheduleCrewMember"("jobScheduleId");

-- CreateIndex
CREATE INDEX "JobScheduleCrewMember_crewMemberId_idx" ON "JobScheduleCrewMember"("crewMemberId");

-- CreateIndex
CREATE INDEX "JobScheduleCrewMember_organizationId_crewMemberId_idx" ON "JobScheduleCrewMember"("organizationId", "crewMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "JobScheduleCrewMember_jobScheduleId_crewMemberId_key" ON "JobScheduleCrewMember"("jobScheduleId", "crewMemberId");

-- AddForeignKey
ALTER TABLE "JobScheduleCrewMember" ADD CONSTRAINT "JobScheduleCrewMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobScheduleCrewMember" ADD CONSTRAINT "JobScheduleCrewMember_jobScheduleId_fkey" FOREIGN KEY ("jobScheduleId") REFERENCES "JobSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobScheduleCrewMember" ADD CONSTRAINT "JobScheduleCrewMember_crewMemberId_fkey" FOREIGN KEY ("crewMemberId") REFERENCES "CrewMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
