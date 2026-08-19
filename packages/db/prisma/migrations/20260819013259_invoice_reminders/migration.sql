-- CreateEnum
CREATE TYPE "InvoiceReminderType" AS ENUM ('BEFORE_DUE', 'DUE_TODAY', 'FIRST_OVERDUE', 'SECOND_OVERDUE');

-- CreateTable
CREATE TABLE "InvoiceReminderSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "beforeDueEnabled" BOOLEAN NOT NULL DEFAULT true,
    "beforeDueDays" INTEGER NOT NULL DEFAULT 3,
    "dueTodayEnabled" BOOLEAN NOT NULL DEFAULT true,
    "firstOverdueEnabled" BOOLEAN NOT NULL DEFAULT true,
    "firstOverdueDays" INTEGER NOT NULL DEFAULT 3,
    "secondOverdueEnabled" BOOLEAN NOT NULL DEFAULT true,
    "secondOverdueDays" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceReminderSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceReminder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "type" "InvoiceReminderType" NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceReminderSettings_organizationId_key" ON "InvoiceReminderSettings"("organizationId");

-- CreateIndex
CREATE INDEX "InvoiceReminder_organizationId_idx" ON "InvoiceReminder"("organizationId");

-- CreateIndex
CREATE INDEX "InvoiceReminder_invoiceId_idx" ON "InvoiceReminder"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceReminder_scheduledFor_idx" ON "InvoiceReminder"("scheduledFor");

-- CreateIndex
CREATE INDEX "InvoiceReminder_sentAt_idx" ON "InvoiceReminder"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceReminder_invoiceId_type_key" ON "InvoiceReminder"("invoiceId", "type");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE INDEX "Membership_organizationId_role_idx" ON "Membership"("organizationId", "role");

-- AddForeignKey
ALTER TABLE "InvoiceReminderSettings" ADD CONSTRAINT "InvoiceReminderSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceReminder" ADD CONSTRAINT "InvoiceReminder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceReminder" ADD CONSTRAINT "InvoiceReminder_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
