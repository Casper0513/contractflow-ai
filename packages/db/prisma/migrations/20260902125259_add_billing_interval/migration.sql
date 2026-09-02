-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'ANNUAL');

-- AlterTable
ALTER TABLE "BillingSubscription" ADD COLUMN     "interval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY';
