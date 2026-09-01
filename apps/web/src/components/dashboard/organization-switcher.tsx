"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { setActiveOrganization } from "@/app/actions/active-organization";

export type OrganizationSwitcherMembership = {
  id: string;
  role: string;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
};

type OrganizationSwitcherProps = {
  memberships: OrganizationSwitcherMembership[];
  activeOrganizationId: string;
};

export function OrganizationSwitcher({
  memberships,
  activeOrganizationId,
}: OrganizationSwitcherProps) {
  const router = useRouter();
  const [selectedOrganizationId, setSelectedOrganizationId] =
    useState(activeOrganizationId);
  const [isPending, startTransition] = useTransition();

  if (memberships.length <= 1) {
    return null;
  }

  return (
    <label className="flex min-w-0 items-center gap-2">
      <span className="sr-only">Active organization</span>

      <select
        value={selectedOrganizationId}
        disabled={isPending}
        onChange={(event) => {
          const nextOrganizationId = event.target.value;

          setSelectedOrganizationId(nextOrganizationId);

          startTransition(async () => {
            try {
              await setActiveOrganization(nextOrganizationId);
              router.refresh();
            } catch (error) {
              setSelectedOrganizationId(activeOrganizationId);
              console.error("Failed to switch organization", error);
            }
          });
        }}
        className="h-9 max-w-56 truncate rounded-md border bg-background px-3 text-sm font-medium outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        {memberships.map((membership) => (
          <option key={membership.organization.id} value={membership.organization.id}>
            {membership.organization.name}
          </option>
        ))}
      </select>
    </label>
  );
}
