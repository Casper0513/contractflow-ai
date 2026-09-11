-- Persist pending ContractFlow team invitations while Clerk owns
-- authentication and invitation-link delivery.

CREATE TABLE "TeamInvitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invitedByUserId" TEXT,
    "email" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL,
    "clerkInvitationId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeamInvitation_clerkInvitationId_key"
ON "TeamInvitation"("clerkInvitationId");

CREATE INDEX "TeamInvitation_organizationId_idx"
ON "TeamInvitation"("organizationId");

CREATE INDEX "TeamInvitation_invitedByUserId_idx"
ON "TeamInvitation"("invitedByUserId");

CREATE INDEX "TeamInvitation_organizationId_email_idx"
ON "TeamInvitation"("organizationId", "email");

CREATE INDEX "TeamInvitation_organizationId_acceptedAt_idx"
ON "TeamInvitation"("organizationId", "acceptedAt");

CREATE INDEX "TeamInvitation_organizationId_revokedAt_idx"
ON "TeamInvitation"("organizationId", "revokedAt");

CREATE INDEX "TeamInvitation_expiresAt_idx"
ON "TeamInvitation"("expiresAt");

ALTER TABLE "TeamInvitation"
ADD CONSTRAINT "TeamInvitation_organizationId_fkey"
FOREIGN KEY ("organizationId")
REFERENCES "Organization"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "TeamInvitation"
ADD CONSTRAINT "TeamInvitation_invitedByUserId_fkey"
FOREIGN KEY ("invitedByUserId")
REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
