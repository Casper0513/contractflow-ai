-- CreateEnum
CREATE TYPE "PaymentReceiptStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "PaymentReceiptDelivery" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "status" "PaymentReceiptStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentReceiptDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentReceiptDelivery_paymentId_key" ON "PaymentReceiptDelivery"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentReceiptDelivery_status_idx" ON "PaymentReceiptDelivery"("status");

-- CreateIndex
CREATE INDEX "PaymentReceiptDelivery_nextAttemptAt_idx" ON "PaymentReceiptDelivery"("nextAttemptAt");

-- CreateIndex
CREATE INDEX "PaymentReceiptDelivery_status_nextAttemptAt_idx" ON "PaymentReceiptDelivery"("status", "nextAttemptAt");

-- AddForeignKey
ALTER TABLE "PaymentReceiptDelivery" ADD CONSTRAINT "PaymentReceiptDelivery_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
