-- CreateTable
CREATE TABLE "CrewMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "hourlyCostCents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrewMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobTimeEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "crewMemberId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "hourlyCostCents" INTEGER NOT NULL,
    "laborCostCents" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobTimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrewMember_organizationId_idx" ON "CrewMember"("organizationId");

-- CreateIndex
CREATE INDEX "CrewMember_organizationId_active_idx" ON "CrewMember"("organizationId", "active");

-- CreateIndex
CREATE INDEX "JobTimeEntry_organizationId_idx" ON "JobTimeEntry"("organizationId");

-- CreateIndex
CREATE INDEX "JobTimeEntry_jobId_idx" ON "JobTimeEntry"("jobId");

-- CreateIndex
CREATE INDEX "JobTimeEntry_crewMemberId_idx" ON "JobTimeEntry"("crewMemberId");

-- CreateIndex
CREATE INDEX "JobTimeEntry_createdByUserId_idx" ON "JobTimeEntry"("createdByUserId");

-- CreateIndex
CREATE INDEX "JobTimeEntry_jobId_startedAt_idx" ON "JobTimeEntry"("jobId", "startedAt");

-- AddForeignKey
ALTER TABLE "CrewMember" ADD CONSTRAINT "CrewMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobTimeEntry" ADD CONSTRAINT "JobTimeEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobTimeEntry" ADD CONSTRAINT "JobTimeEntry_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobTimeEntry" ADD CONSTRAINT "JobTimeEntry_crewMemberId_fkey" FOREIGN KEY ("crewMemberId") REFERENCES "CrewMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobTimeEntry" ADD CONSTRAINT "JobTimeEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
