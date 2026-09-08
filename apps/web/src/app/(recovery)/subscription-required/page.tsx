import Link from "next/link";
import { CreditCard, LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getStoredActiveOrganizationId } from "@/lib/active-organization";
import { getCurrentUser } from "@/lib/authenticated-api";
import { getBillingAccess } from "@/lib/billing-api";

export default async function SubscriptionRequiredPage() {
  const [user, storedOrganizationId, billingAccess] = await Promise.all([
    getCurrentUser(),
    getStoredActiveOrganizationId(),
    getBillingAccess(),
  ]);

  const membership =
    user.memberships.find(
      (candidate) => candidate.organization.id === storedOrganizationId,
    ) ?? user.memberships[0];

  const canManageBilling = membership?.role === "OWNER" || membership?.role === "ADMIN";

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-lg border bg-muted/30">
            <LockKeyhole className="h-5 w-5" />
          </div>

          <CardTitle>Subscription required</CardTitle>

          <CardDescription>
            This workspace does not currently have access to ContractFlow operational
            features.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="rounded-lg border bg-muted/20 p-4 text-sm">
            <p>
              <span className="font-medium">Plan:</span>{" "}
              {billingAccess.plan ?? "No subscription"}
            </p>

            <p className="mt-1">
              <span className="font-medium">Status:</span>{" "}
              {billingAccess.status ?? "No subscription"}
            </p>
          </div>

          {canManageBilling ? (
            <Button nativeButton={false} render={<Link href="/settings/billing" />}>
              <CreditCard className="h-4 w-4" />
              Manage subscription
            </Button>
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Ask an organization owner or administrator to restore the ContractFlow
              subscription. You can also switch to another workspace above.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
