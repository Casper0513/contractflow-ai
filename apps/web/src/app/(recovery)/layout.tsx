import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

import { LanguageSwitcher } from "@/components/dashboard/language-switcher";
import {
  OrganizationSwitcher,
  type OrganizationSwitcherMembership,
} from "@/components/dashboard/organization-switcher";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { getRequestLocale } from "@/i18n/locale";
import { getStoredActiveOrganizationId } from "@/lib/active-organization";
import { getCurrentUser } from "@/lib/authenticated-api";

export default async function RecoveryLayout({ children }: { children: ReactNode }) {
  const authState = await auth();

  if (!authState.userId) {
    redirect("/");
  }

  const [user, storedOrganizationId, locale] = await Promise.all([
    getCurrentUser(),
    getStoredActiveOrganizationId(),
    getRequestLocale(),
  ]);

  if (user.memberships.length === 0) {
    redirect("/onboarding");
  }

  const membership =
    user.memberships.find(
      (candidate) => candidate.organization.id === storedOrganizationId,
    ) ?? user.memberships[0];

  const organization = membership.organization;

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="min-w-0">
            <p className="truncate font-semibold">ContractFlow AI</p>
            <p className="truncate text-xs text-muted-foreground">{organization.name}</p>
          </div>

          <div className="flex items-center gap-2">
            <OrganizationSwitcher
              memberships={user.memberships as OrganizationSwitcherMembership[]}
              activeOrganizationId={organization.id}
            />

            <LanguageSwitcher locale={locale} />

            <ThemeToggle />

            <UserButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
