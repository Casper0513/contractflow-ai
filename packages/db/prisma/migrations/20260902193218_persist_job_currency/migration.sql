-- Add Job.currency as nullable first so existing rows can be backfilled safely.
ALTER TABLE "Job"
ADD COLUMN "currency" TEXT;

-- Existing jobs predate persisted job currency.
-- The organization's current currency is the best available historical approximation.
UPDATE "Job"
SET "currency" = "Organization"."currency"
FROM "Organization"
WHERE "Job"."organizationId" = "Organization"."id";

-- Every job must have an authoritative financial currency from this point forward.
ALTER TABLE "Job"
ALTER COLUMN "currency" SET NOT NULL;
