import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  Check,
  CircleDollarSign,
  ExternalLink,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getBilling,
  type BillingInterval,
  type BillingPlan,
  type BillingSubscriptionStatus,
} from "@/lib/billing-api";
import { getCurrentOrganization } from "@/lib/organizations-api";

import { openBillingPortal, startBillingCheckout } from "./actions";

type BillingPageProps = {
  searchParams: Promise<{
    checkout?: string;
  }>;
};

type PlanDefinition = {
  plan: BillingPlan;
  nameKey: string;
  descriptionKey: string;
  icon: typeof Sparkles;
  featureKeys: string[];
};

const plans: PlanDefinition[] = [
  {
    plan: "STARTER",
    nameKey: "starterName",
    descriptionKey: "starterDescription",
    icon: Sparkles,
    featureKeys: [
      "starterFeature1",
      "starterFeature2",
      "starterFeature3",
      "starterFeature4",
      "starterFeature5",
    ],
  },
  {
    plan: "PRO",
    nameKey: "proName",
    descriptionKey: "proDescription",
    icon: BadgeCheck,
    featureKeys: [
      "proFeature1",
      "proFeature2",
      "proFeature3",
      "proFeature4",
      "proFeature5",
    ],
  },
  {
    plan: "BUSINESS",
    nameKey: "businessName",
    descriptionKey: "businessDescription",
    icon: Building2,
    featureKeys: [
      "businessFeature1",
      "businessFeature2",
      "businessFeature3",
      "businessFeature4",
      "businessFeature5",
    ],
  },
];

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const organization = await getCurrentOrganization();

  const canManageBilling = organization.role === "OWNER" || organization.role === "ADMIN";

  if (!canManageBilling) {
    redirect("/subscription-required");
  }

  const [{ checkout }, billing, t, locale] = await Promise.all([
    searchParams,
    getBilling(),
    getTranslations("Billing"),
    getLocale(),
  ]);

  const subscription = billing.subscription;

  const planLabels: Record<BillingPlan, string> = {
    STARTER: t("starterName"),
    PRO: t("proName"),
    BUSINESS: t("businessName"),
  };

  const statusLabels: Record<BillingSubscriptionStatus, string> = {
    INCOMPLETE: t("statusIncomplete"),
    INCOMPLETE_EXPIRED: t("statusIncompleteExpired"),
    TRIALING: t("statusTrialing"),
    ACTIVE: t("statusActive"),
    PAST_DUE: t("statusPastDue"),
    CANCELED: t("statusCanceled"),
    UNPAID: t("statusUnpaid"),
    PAUSED: t("statusPaused"),
  };

  const hasManagedSubscription =
    subscription?.status === "ACTIVE" ||
    subscription?.status === "TRIALING" ||
    subscription?.status === "PAST_DUE";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/dashboard"
            className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("backToSettings")}
          </Link>

          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>

          <p className="mt-1 max-w-2xl text-muted-foreground">
            Choose the ContractFlow plan that fits your business. Subscription checkout
            and payment information are handled securely by Stripe.
          </p>
        </div>

        {hasManagedSubscription ? (
          <form action={openBillingPortal}>
            <Button type="submit" variant="outline">
              {t("manageBilling")}
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </form>
        ) : null}
      </div>

      {checkout === "success" ? (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm">
          <p className="font-semibold">{t("checkoutSuccessTitle")}</p>
          <p className="mt-1 text-muted-foreground">
            Stripe is processing your subscription. Your billing status will update
            automatically.
          </p>
        </div>
      ) : null}

      {checkout === "cancelled" ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <p className="font-semibold">{t("checkoutCancelledTitle")}</p>
          <p className="mt-1 text-muted-foreground">
            {t("checkoutCancelledDescription")}
          </p>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-lg border bg-muted/30 p-2">
              <CircleDollarSign className="h-5 w-5 text-muted-foreground" />
            </div>

            <div>
              <CardTitle>{t("currentSubscription")}</CardTitle>
              <CardDescription className="mt-1">
                {t("currentSubscriptionDescription")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {subscription ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SubscriptionMetric
                label={t("plan")}
                value={planLabels[subscription.plan]}
              />

              <SubscriptionMetric
                label={t("billing")}
                value={subscription.interval === "ANNUAL" ? t("annual") : t("monthly")}
              />

              <SubscriptionMetric
                label={t("status")}
                value={statusLabels[subscription.status]}
              />

              <SubscriptionMetric
                label={t("currentPeriodEnds")}
                value={formatDate(subscription.currentPeriodEnd, locale)}
              />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-5">
              <p className="font-medium">{t("noSubscription")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("noSubscriptionDescription")}
              </p>
            </div>
          )}

          {subscription && (subscription.cancelAt || subscription.cancelAtPeriodEnd) ? (
            <p className="mt-4 text-sm text-amber-600">
              {t("scheduledCancellation", {
                date: formatDate(
                  subscription.cancelAt ?? subscription.currentPeriodEnd,
                  locale,
                ),
              })}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{t("choosePlan")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("choosePlanDescription")}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {plans.map((plan) => {
          const Icon = plan.icon;
          const isCurrentPlan =
            subscription?.plan === plan.plan && hasManagedSubscription;

          return (
            <Card
              key={plan.plan}
              className={isCurrentPlan ? "border-primary shadow-sm" : undefined}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-lg border bg-muted/30 p-2">
                    <Icon className="h-5 w-5" />
                  </div>

                  {isCurrentPlan ? (
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      {t("currentPlan")}
                    </span>
                  ) : null}
                </div>

                <CardTitle className="pt-2 text-xl">{t(plan.nameKey)}</CardTitle>

                <CardDescription>{t(plan.descriptionKey)}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                <ul className="space-y-3">
                  {plan.featureKeys.map((featureKey) => (
                    <li key={featureKey} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                      <span>{t(featureKey)}</span>
                    </li>
                  ))}
                </ul>

                {hasManagedSubscription ? (
                  <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                    Use{" "}
                    <span className="font-medium text-foreground">
                      {t("manageBilling")}
                    </span>{" "}
                    to change or manage your existing Stripe subscription.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <CheckoutButton plan={plan.plan} interval="MONTHLY">
                      {t("monthly")}
                    </CheckoutButton>

                    <CheckoutButton plan={plan.plan} interval="ANNUAL">
                      {t("annual")}
                    </CheckoutButton>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Subscription payment details are collected by Stripe. ContractFlow does not store
        your full card number.
      </p>
    </div>
  );
}

function CheckoutButton({
  plan,
  interval,
  children,
}: {
  plan: BillingPlan;
  interval: BillingInterval;
  children: React.ReactNode;
}) {
  return (
    <form action={startBillingCheckout}>
      <input type="hidden" name="plan" value={plan} />
      <input type="hidden" name="interval" value={interval} />

      <Button type="submit" className="w-full">
        {children}
      </Button>
    </form>
  );
}

function SubscriptionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function formatDate(value: string | null, locale: string): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}
