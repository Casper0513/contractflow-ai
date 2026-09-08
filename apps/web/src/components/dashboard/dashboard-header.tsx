import { UserButton } from "@clerk/nextjs";

import type { SupportedLocale } from "@/i18n/config";

import { LanguageSwitcher } from "./language-switcher";
import { MobileSidebar } from "./mobile-sidebar";
import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "./theme-toggle";
import {
  OrganizationSwitcher,
  type OrganizationSwitcherMembership,
} from "./organization-switcher";

type DashboardHeaderProps = {
  organizationName: string;
  memberships: OrganizationSwitcherMembership[];
  activeOrganizationId: string;
  locale: SupportedLocale;
  aiFeaturesEnabled: boolean;
};

export function DashboardHeader({
  organizationName,
  memberships,
  activeOrganizationId,
  locale,
  aiFeaturesEnabled,
}: DashboardHeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <MobileSidebar
          organizationName={organizationName}
          aiFeaturesEnabled={aiFeaturesEnabled}
        />

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{organizationName}</p>

          <p className="hidden text-xs text-muted-foreground sm:block">
            Contractor operations
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <OrganizationSwitcher
          memberships={memberships}
          activeOrganizationId={activeOrganizationId}
        />

        <LanguageSwitcher locale={locale} />

        <ThemeToggle />

        <NotificationBell />

        <UserButton />
      </div>
    </header>
  );
}
