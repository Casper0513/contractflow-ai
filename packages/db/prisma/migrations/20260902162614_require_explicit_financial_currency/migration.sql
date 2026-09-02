-- AlterTable
ALTER TABLE "Estimate" ALTER COLUMN "currency" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Invoice" ALTER COLUMN "currency" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "currency" DROP DEFAULT;
