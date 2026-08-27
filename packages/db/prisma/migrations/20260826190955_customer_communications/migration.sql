-- CreateEnum
CREATE TYPE "CommunicationChannel" AS ENUM ('EMAIL');

-- CreateEnum
CREATE TYPE "CommunicationDirection" AS ENUM ('OUTBOUND');

-- CreateEnum
CREATE TYPE "CommunicationCategory" AS ENUM ('GENERAL', 'ESTIMATE', 'INVOICE', 'PAYMENT', 'REMINDER');

-- CreateEnum
CREATE TYPE "CommunicationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "CustomerCommunication" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "jobId" TEXT,
    "estimateId" TEXT,
    "invoiceId" TEXT,
    "paymentId" TEXT,
    "channel" "CommunicationChannel" NOT NULL DEFAULT 'EMAIL',
    "direction" "CommunicationDirection" NOT NULL DEFAULT 'OUTBOUND',
    "category" "CommunicationCategory" NOT NULL,
    "status" "CommunicationStatus" NOT NULL DEFAULT 'PENDING',
    "recipientEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "textBody" TEXT NOT NULL,
    "htmlBody" TEXT NOT NULL,
    "provider" TEXT,
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerCommunication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerCommunication_providerMessageId_key" ON "CustomerCommunication"("providerMessageId");

-- CreateIndex
CREATE INDEX "CustomerCommunication_organizationId_idx" ON "CustomerCommunication"("organizationId");

-- CreateIndex
CREATE INDEX "CustomerCommunication_customerId_createdAt_idx" ON "CustomerCommunication"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerCommunication_actorUserId_idx" ON "CustomerCommunication"("actorUserId");

-- CreateIndex
CREATE INDEX "CustomerCommunication_jobId_idx" ON "CustomerCommunication"("jobId");

-- CreateIndex
CREATE INDEX "CustomerCommunication_estimateId_idx" ON "CustomerCommunication"("estimateId");

-- CreateIndex
CREATE INDEX "CustomerCommunication_invoiceId_idx" ON "CustomerCommunication"("invoiceId");

-- CreateIndex
CREATE INDEX "CustomerCommunication_paymentId_idx" ON "CustomerCommunication"("paymentId");

-- CreateIndex
CREATE INDEX "CustomerCommunication_organizationId_status_idx" ON "CustomerCommunication"("organizationId", "status");

-- CreateIndex
CREATE INDEX "CustomerCommunication_organizationId_category_idx" ON "CustomerCommunication"("organizationId", "category");

-- CreateIndex
CREATE INDEX "CustomerCommunication_organizationId_createdAt_idx" ON "CustomerCommunication"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "CustomerCommunication" ADD CONSTRAINT "CustomerCommunication_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCommunication" ADD CONSTRAINT "CustomerCommunication_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCommunication" ADD CONSTRAINT "CustomerCommunication_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCommunication" ADD CONSTRAINT "CustomerCommunication_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCommunication" ADD CONSTRAINT "CustomerCommunication_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCommunication" ADD CONSTRAINT "CustomerCommunication_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCommunication" ADD CONSTRAINT "CustomerCommunication_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
