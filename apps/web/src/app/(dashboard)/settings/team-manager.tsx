"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  Clock3,
  Loader2,
  LockKeyhole,
  MailPlus,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TeamInvitation, TeamMember, TeamRole } from "@/lib/team-members-types";

import {
  inviteTeamMemberAction,
  removeTeamMemberAction,
  revokeTeamInvitationAction,
  updateTeamMemberRoleAction,
} from "./team-member-actions";

const ALL_ROLES: TeamRole[] = [
  "OWNER",
  "ADMIN",
  "MANAGER",
  "TECHNICIAN",
  "OFFICE",
  "VIEWER",
];

const INVITABLE_ROLES: TeamRole[] = [
  "ADMIN",
  "MANAGER",
  "TECHNICIAN",
  "OFFICE",
  "VIEWER",
];

const ROLE_LABELS: Record<TeamRole, string> = {
  OWNER: "Owner",
  ADMIN: "Administrator",
  MANAGER: "Manager",
  TECHNICIAN: "Technician",
  OFFICE: "Office",
  VIEWER: "Viewer",
};

type TeamManagerProps = {
  members: TeamMember[];
  invitations: TeamInvitation[];
  actorRole: TeamRole;
  canManage: boolean;
};

export function TeamManager({
  members,
  invitations,
  actorRole,
  canManage,
}: TeamManagerProps) {
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("VIEWER");
  const [message, setMessage] = useState<{
    success: boolean;
    text: string;
  } | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const activeInvitations = invitations;

  const ownerCount = members.filter((member) => member.role === "OWNER").length;
  const canManageOwnership = actorRole === "OWNER";

  function handleInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage(null);
    setPendingKey("invite");

    startTransition(async () => {
      const result = await inviteTeamMemberAction(email, inviteRole);

      setPendingKey(null);

      if (!result.success) {
        setMessage({
          success: false,
          text: result.error,
        });
        return;
      }

      setEmail("");
      setInviteRole("VIEWER");

      setMessage({
        success: true,
        text:
          result.data.kind === "MEMBERSHIP"
            ? `${result.data.email} was added to the organization.`
            : `Invitation sent to ${result.data.email}.`,
      });
    });
  }

  function handleRoleChange(member: TeamMember, role: TeamRole) {
    if (role === member.role) {
      return;
    }

    const ownershipChange = member.role === "OWNER" || role === "OWNER";

    if (ownershipChange && !canManageOwnership) {
      setMessage({
        success: false,
        text: "Only an organization owner can change ownership.",
      });
      return;
    }

    if (member.role === "OWNER" && role !== "OWNER" && ownerCount === 1) {
      setMessage({
        success: false,
        text: "The organization must always have at least one owner.",
      });
      return;
    }

    setMessage(null);
    setPendingKey(`role:${member.membershipId}`);

    startTransition(async () => {
      const result = await updateTeamMemberRoleAction(member.membershipId, role);

      setPendingKey(null);

      if (!result.success) {
        setMessage({
          success: false,
          text: result.error,
        });
        return;
      }

      setMessage({
        success: true,
        text: `${displayName(member)} is now ${ROLE_LABELS[result.data.role]}.`,
      });
    });
  }

  function handleRemove(member: TeamMember) {
    if (member.role === "OWNER" && !canManageOwnership) {
      setMessage({
        success: false,
        text: "Only an organization owner can remove another owner.",
      });
      return;
    }

    if (member.role === "OWNER" && ownerCount === 1) {
      setMessage({
        success: false,
        text: "The final organization owner cannot be removed.",
      });
      return;
    }

    const confirmed = window.confirm(
      `Remove ${displayName(member)} from this organization?\n\nThey will immediately lose access to this workspace.`,
    );

    if (!confirmed) {
      return;
    }

    setMessage(null);
    setPendingKey(`remove:${member.membershipId}`);

    startTransition(async () => {
      const result = await removeTeamMemberAction(member.membershipId);

      setPendingKey(null);

      if (!result.success) {
        setMessage({
          success: false,
          text: result.error,
        });
        return;
      }

      setMessage({
        success: true,
        text: `${displayName(member)} was removed from the organization.`,
      });
    });
  }

  function handleRevoke(invitation: TeamInvitation) {
    const confirmed = window.confirm(`Revoke the invitation for ${invitation.email}?`);

    if (!confirmed) {
      return;
    }

    setMessage(null);
    setPendingKey(`invite:${invitation.id}`);

    startTransition(async () => {
      const result = await revokeTeamInvitationAction(invitation.id);

      setPendingKey(null);

      if (!result.success) {
        setMessage({
          success: false,
          text: result.error,
        });
        return;
      }

      setMessage({
        success: true,
        text: `Invitation for ${invitation.email} was revoked.`,
      });
    });
  }

  return (
    <div className="space-y-8">
      {!canManage && (
        <div className="flex gap-3 rounded-xl border bg-muted/30 p-4">
          <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />

          <div>
            <p className="font-medium">Team management is read-only</p>

            <p className="mt-1 text-sm text-muted-foreground">
              Only organization owners and administrators can invite, edit, or remove team
              members.
            </p>
          </div>
        </div>
      )}

      {message && (
        <div
          role={message.success ? "status" : "alert"}
          className={`rounded-xl border p-4 text-sm ${
            message.success
              ? "border-green-500/30 bg-green-500/10 text-green-700"
              : "border-destructive/30 bg-destructive/5 text-destructive"
          }`}
        >
          <div className="flex items-start gap-2">
            {message.success ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}

            <span>{message.text}</span>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <TeamStat label="Members" value={members.length} icon={Users} />

        <TeamStat label="Owners" value={ownerCount} icon={ShieldCheck} />

        <TeamStat
          label="Pending invites"
          value={activeInvitations.length}
          icon={Clock3}
        />
      </div>

      {canManage && (
        <form onSubmit={handleInvite} className="rounded-xl border bg-muted/20 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg border bg-background p-2">
              <MailPlus className="h-4 w-4 text-muted-foreground" />
            </div>

            <div>
              <p className="font-medium">Invite a team member</p>

              <p className="mt-1 text-sm text-muted-foreground">
                Existing ContractFlow users are added immediately. New users receive a
                secure email invitation.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
            <div>
              <label
                htmlFor="team-invite-email"
                className="mb-1.5 block text-sm font-medium"
              >
                Email address
              </label>

              <Input
                id="team-invite-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="team@example.com"
                maxLength={320}
                required
                disabled={pending}
              />
            </div>

            <div>
              <label
                htmlFor="team-invite-role"
                className="mb-1.5 block text-sm font-medium"
              >
                Role
              </label>

              <select
                id="team-invite-role"
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value as TeamRole)}
                disabled={pending}
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {INVITABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <Button
                type="submit"
                disabled={pending || !email.trim()}
                className="w-full md:w-auto"
              >
                {pending && pendingKey === "invite" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MailPlus className="h-4 w-4" />
                )}
                Send invite
              </Button>
            </div>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Ownership is never assigned through an invitation. An existing owner must
            explicitly promote a team member to Owner.
          </p>
        </form>
      )}

      <section className="space-y-3">
        <div>
          <h3 className="font-semibold">Organization members</h3>

          <p className="mt-1 text-sm text-muted-foreground">
            Manage workspace access and operating roles for your team.
          </p>
        </div>

        {members.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <Users className="mx-auto h-8 w-8 text-muted-foreground" />

            <p className="mt-3 font-medium">No team members found</p>

            <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">
              Members will appear here after they join this organization.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((member) => {
              const ownershipLocked = member.role === "OWNER" && !canManageOwnership;
              const finalOwner = member.role === "OWNER" && ownerCount === 1;
              const rolePending = pending && pendingKey === `role:${member.membershipId}`;
              const removePending =
                pending && pendingKey === `remove:${member.membershipId}`;

              return (
                <div
                  key={member.membershipId}
                  className="flex flex-col gap-4 rounded-xl border p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="rounded-lg border bg-muted/30 p-2">
                      <UserRound className="h-4 w-4 text-muted-foreground" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{displayName(member)}</p>

                        <Badge
                          variant={
                            member.role === "OWNER"
                              ? "default"
                              : member.role === "ADMIN"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {ROLE_LABELS[member.role]}
                        </Badge>

                        {finalOwner && <Badge variant="outline">Final owner</Badge>}
                      </div>

                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {member.email}
                      </p>
                    </div>
                  </div>

                  {canManage ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="min-w-[180px]">
                        <label
                          htmlFor={`role-${member.membershipId}`}
                          className="sr-only"
                        >
                          Role for {displayName(member)}
                        </label>

                        <select
                          id={`role-${member.membershipId}`}
                          value={member.role}
                          disabled={pending || ownershipLocked || finalOwner}
                          onChange={(event) =>
                            handleRoleChange(member, event.target.value as TeamRole)
                          }
                          className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                        >
                          {ALL_ROLES.map((role) => (
                            <option
                              key={role}
                              value={role}
                              disabled={role === "OWNER" && !canManageOwnership}
                            >
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                      </div>

                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={pending || ownershipLocked || finalOwner}
                        onClick={() => handleRemove(member)}
                      >
                        {removePending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        Remove
                      </Button>

                      {rolePending && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="font-semibold">Pending invitations</h3>

          <p className="mt-1 text-sm text-muted-foreground">
            Invitations remain pending until accepted, revoked, or expired.
          </p>
        </div>

        {activeInvitations.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <MailPlus className="mx-auto h-7 w-7 text-muted-foreground" />

            <p className="mt-3 font-medium">No pending invitations</p>

            <p className="mt-1 text-sm text-muted-foreground">
              New invitations will appear here while you wait for team members to join.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeInvitations.map((invitation) => {
              const rowPending = pending && pendingKey === `invite:${invitation.id}`;

              return (
                <div
                  key={invitation.id}
                  className="flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{invitation.email}</p>

                      <Badge variant="outline">{ROLE_LABELS[invitation.role]}</Badge>
                    </div>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Expires {formatDate(invitation.expiresAt)}
                    </p>
                  </div>

                  {canManage && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => handleRevoke(invitation)}
                      className="text-destructive hover:text-destructive"
                    >
                      {rowPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      Revoke
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function TeamStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-sm">{label}</span>
      </div>

      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function displayName(member: TeamMember): string {
  const fullName = [member.firstName, member.lastName].filter(Boolean).join(" ").trim();

  return fullName || member.email;
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}
