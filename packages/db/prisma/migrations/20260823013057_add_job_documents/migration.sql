-- CreateEnum
CREATE TYPE "JobDocumentCategory" AS ENUM ('CONTRACT', 'PERMIT', 'RECEIPT', 'DRAWING', 'WARRANTY', 'OTHER');

-- CreateTable
CREATE TABLE "JobDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "category" "JobDocumentCategory" NOT NULL DEFAULT 'OTHER',
    "title" TEXT,
    "description" TEXT,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobDocument_storageKey_key" ON "JobDocument"("storageKey");

-- CreateIndex
CREATE INDEX "JobDocument_organizationId_idx" ON "JobDocument"("organizationId");

-- CreateIndex
CREATE INDEX "JobDocument_jobId_idx" ON "JobDocument"("jobId");

-- CreateIndex
CREATE INDEX "JobDocument_uploadedByUserId_idx" ON "JobDocument"("uploadedByUserId");

-- CreateIndex
CREATE INDEX "JobDocument_jobId_category_idx" ON "JobDocument"("jobId", "category");

-- CreateIndex
CREATE INDEX "JobDocument_jobId_createdAt_idx" ON "JobDocument"("jobId", "createdAt");

-- AddForeignKey
ALTER TABLE "JobDocument" ADD CONSTRAINT "JobDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobDocument" ADD CONSTRAINT "JobDocument_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobDocument" ADD CONSTRAINT "JobDocument_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
