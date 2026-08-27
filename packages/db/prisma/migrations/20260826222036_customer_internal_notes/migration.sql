-- CreateEnum
CREATE TYPE "CustomerInternalNoteKind" AS ENUM ('NOTE', 'FOLLOW_UP');

-- CreateTable
CREATE TABLE "CustomerInternalNote" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "kind" "CustomerInternalNoteKind" NOT NULL DEFAULT 'NOTE',
    "content" TEXT NOT NULL,
    "assignedToUserId" TEXT,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerInternalNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerInternalNote_organizationId_idx" ON "CustomerInternalNote"("organizationId");

-- CreateIndex
CREATE INDEX "CustomerInternalNote_customerId_createdAt_idx" ON "CustomerInternalNote"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerInternalNote_createdByUserId_idx" ON "CustomerInternalNote"("createdByUserId");

-- CreateIndex
CREATE INDEX "CustomerInternalNote_assignedToUserId_idx" ON "CustomerInternalNote"("assignedToUserId");

-- CreateIndex
CREATE INDEX "CustomerInternalNote_completedByUserId_idx" ON "CustomerInternalNote"("completedByUserId");

-- CreateIndex
CREATE INDEX "CustomerInternalNote_organizationId_kind_idx" ON "CustomerInternalNote"("organizationId", "kind");

-- CreateIndex
CREATE INDEX "CustomerInternalNote_organizationId_dueAt_idx" ON "CustomerInternalNote"("organizationId", "dueAt");

-- CreateIndex
CREATE INDEX "CustomerInternalNote_assignedToUserId_dueAt_idx" ON "CustomerInternalNote"("assignedToUserId", "dueAt");

-- CreateIndex
CREATE INDEX "CustomerInternalNote_customerId_completedAt_idx" ON "CustomerInternalNote"("customerId", "completedAt");

-- AddForeignKey
ALTER TABLE "CustomerInternalNote" ADD CONSTRAINT "CustomerInternalNote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInternalNote" ADD CONSTRAINT "CustomerInternalNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInternalNote" ADD CONSTRAINT "CustomerInternalNote_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInternalNote" ADD CONSTRAINT "CustomerInternalNote_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInternalNote" ADD CONSTRAINT "CustomerInternalNote_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
