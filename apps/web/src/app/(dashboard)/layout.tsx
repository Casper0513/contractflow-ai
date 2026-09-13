import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { BillingEntitlementsProvider } from "@/components/dashboard/billing-entitlements-provider";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { getRequestLocale } from "@/i18n/locale";
import { getStoredActiveOrganizationId } from "@/lib/active-organization";
import { getCurrentUser } from "@/lib/authenticated-api";
import { getBillingAccess, hasBillingEntitlement } from "@/lib/billing-api";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
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

  const billingAccess = await getBillingAccess();

  if (!billingAccess.hasAccess) {
    if (membership.role === "OWNER" || membership.role === "ADMIN") {
      redirect("/settings/billing");
    }

    redirect("/subscription-required");
  }

  const aiFeaturesEnabled = hasBillingEntitlement(billingAccess, "AI_FEATURES");

  return (
    <BillingEntitlementsProvider entitlements={billingAccess.entitlements}>
      <div className="flex min-h-screen bg-muted/20">
        <DashboardSidebar
          organizationName={organization.name}
          aiFeaturesEnabled={aiFeaturesEnabled}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <DashboardHeader
            organizationName={organization.name}
            memberships={user.memberships}
            activeOrganizationId={organization.id}
            locale={locale}
            aiFeaturesEnabled={aiFeaturesEnabled}
          />

          <main className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </BillingEntitlementsProvider>
  );
}
