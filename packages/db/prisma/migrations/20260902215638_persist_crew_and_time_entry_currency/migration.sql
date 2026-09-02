-- Persist the denomination of organization-level crew rates.
ALTER TABLE "CrewMember"
ADD COLUMN "currency" TEXT;

UPDATE "CrewMember" AS crew
SET "currency" = organization."currency"
FROM "Organization" AS organization
WHERE organization."id" = crew."organizationId";

ALTER TABLE "CrewMember"
ALTER COLUMN "currency" SET NOT NULL;


-- Persist the denomination of job-scoped labor snapshots.
ALTER TABLE "JobTimeEntry"
ADD COLUMN "currency" TEXT;

UPDATE "JobTimeEntry" AS entry
SET "currency" = job."currency"
FROM "Job" AS job
WHERE job."id" = entry."jobId";

ALTER TABLE "JobTimeEntry"
ALTER COLUMN "currency" SET NOT NULL;
