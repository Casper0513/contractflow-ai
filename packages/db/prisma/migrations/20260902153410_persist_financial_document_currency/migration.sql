-- Persist the currency used by each estimate.
--
-- Historical estimates inherit the organization's currency that existed
-- before estimate-level currency persistence was introduced.
ALTER TABLE "Estimate"
ADD COLUMN "currency" TEXT;

UPDATE "Estimate" AS estimate
SET "currency" = organization."currency"
FROM "Organization" AS organization
WHERE estimate."organizationId" = organization."id";

-- Defensive fallback. Foreign keys should make this unnecessary, but the
-- column must be populated before applying NOT NULL.
UPDATE "Estimate"
SET "currency" = 'CAD'
WHERE "currency" IS NULL;

ALTER TABLE "Estimate"
ALTER COLUMN "currency" SET NOT NULL,
ALTER COLUMN "currency" SET DEFAULT 'CAD';


-- Persist the currency used by each payment.
--
-- Payments inherit the currency of their invoice. This preserves historical
-- invoice/payment agreement even if the organization's default later changes.
ALTER TABLE "Payment"
ADD COLUMN "currency" TEXT;

UPDATE "Payment" AS payment
SET "currency" = invoice."currency"
FROM "Invoice" AS invoice
WHERE payment."invoiceId" = invoice."id";

-- Defensive fallback for any unexpected legacy row.
UPDATE "Payment"
SET "currency" = 'CAD'
WHERE "currency" IS NULL;

ALTER TABLE "Payment"
ALTER COLUMN "currency" SET NOT NULL,
ALTER COLUMN "currency" SET DEFAULT 'CAD';
