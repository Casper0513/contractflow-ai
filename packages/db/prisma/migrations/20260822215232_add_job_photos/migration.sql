-- CreateEnum
CREATE TYPE "JobPhotoCategory" AS ENUM ('BEFORE', 'PROGRESS', 'AFTER', 'ISSUE', 'OTHER');

-- CreateTable
CREATE TABLE "JobPhoto" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "category" "JobPhotoCategory" NOT NULL DEFAULT 'PROGRESS',
    "caption" TEXT,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "takenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobPhoto_storageKey_key" ON "JobPhoto"("storageKey");

-- CreateIndex
CREATE INDEX "JobPhoto_organizationId_idx" ON "JobPhoto"("organizationId");

-- CreateIndex
CREATE INDEX "JobPhoto_jobId_idx" ON "JobPhoto"("jobId");

-- CreateIndex
CREATE INDEX "JobPhoto_uploadedByUserId_idx" ON "JobPhoto"("uploadedByUserId");

-- CreateIndex
CREATE INDEX "JobPhoto_jobId_category_idx" ON "JobPhoto"("jobId", "category");

-- CreateIndex
CREATE INDEX "JobPhoto_jobId_createdAt_idx" ON "JobPhoto"("jobId", "createdAt");

-- AddForeignKey
ALTER TABLE "JobPhoto" ADD CONSTRAINT "JobPhoto_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPhoto" ADD CONSTRAINT "JobPhoto_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPhoto" ADD CONSTRAINT "JobPhoto_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
