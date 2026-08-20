import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  DollarSign,
  ReceiptText,
  WalletCards,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/activity-utils";
import {
  getDashboard,
  type DashboardActivity,
  type ReadyToInvoiceJob,
  type UpcomingJob,
} from "@/lib/dashboard-api";

export default async function DashboardPage() {
  const dashboard = await getDashboard();

  const stats = [
    {
      title: "Active jobs",
      value: dashboard.summary.activeJobs.toString(),
      description: "Current non-completed jobs",
      icon: BriefcaseBusiness,
      href: "/jobs",
    },
    {
      title: "Ready to invoice",
      value: dashboard.summary.completedUnbilled.toString(),
      description: "Completed and unbilled",
      icon: ReceiptText,
      href: "#ready-to-invoice",
    },
    {
      title: "Outstanding",
      value: formatMoney(dashboard.summary.outstandingCents),
      description: "Open invoice balances",
      icon: WalletCards,
      href: "/invoices?status=OUTSTANDING",
    },
    {
      title: "Collected this month",
      value: formatMoney(dashboard.summary.collectedThisMonthCents),
      description: "Recorded payments this month",
      icon: DollarSign,
      href: "/invoices",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>

        <p className="mt-1 text-muted-foreground">
          Overview of your business operations.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <Link key={stat.title} href={stat.href} className="block">
              <Card className="h-full transition-colors hover:border-primary/40 hover:bg-muted/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>

                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>

                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>

                  <CardDescription className="mt-1">{stat.description}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </section>

      <section id="ready-to-invoice" className="scroll-mt-24">
        <Card>
          <CardHeader>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <CardTitle>Ready to invoice</CardTitle>

                <CardDescription className="mt-1">
                  Completed jobs with no active invoice.
                </CardDescription>
              </div>

              <div className="text-sm text-muted-foreground">
                {dashboard.readyToInvoice.length} ready
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {dashboard.readyToInvoice.length === 0 ? (
              <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed">
                <div className="max-w-sm px-6 text-center">
                  <ReceiptText className="mx-auto h-8 w-8 text-muted-foreground" />

                  <p className="mt-3 font-medium">Nothing waiting for billing</p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Completed jobs without an active invoice will appear here.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {dashboard.readyToInvoice.map((job) => (
                  <ReadyToInvoiceRow key={job.id} job={job} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>Upcoming jobs</CardTitle>

                <CardDescription className="mt-1">
                  Your next scheduled jobs.
                </CardDescription>
              </div>

              {dashboard.summary.jobsToday > 0 && (
                <span className="rounded-full border bg-muted px-2.5 py-1 text-xs font-medium">
                  {dashboard.summary.jobsToday} today
                </span>
              )}
            </div>
          </CardHeader>

          <CardContent>
            {dashboard.upcomingJobs.length === 0 ? (
              <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed">
                <div className="max-w-sm px-6 text-center">
                  <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground" />

                  <p className="mt-3 font-medium">No upcoming jobs</p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Jobs with future start dates will appear here.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {dashboard.upcomingJobs.map((job) => (
                  <UpcomingJobRow key={job.id} job={job} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>

            <CardDescription>Latest changes across your workspace.</CardDescription>
          </CardHeader>

          <CardContent>
            {dashboard.recentActivity.length === 0 ? (
              <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed">
                <div className="max-w-sm px-6 text-center">
                  <Clock3 className="mx-auto h-8 w-8 text-muted-foreground" />

                  <p className="mt-3 font-medium">No activity yet</p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Job, estimate, invoice, task, and payment activity will appear here.
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y">
                {dashboard.recentActivity.map((activity) => (
                  <RecentActivityRow key={activity.id} activity={activity} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function ReadyToInvoiceRow({ job }: { job: ReadyToInvoiceJob }) {
  const customerName = formatCustomerName(job.customer);

  return (
    <div className="flex flex-col justify-between gap-4 rounded-xl border bg-background p-4 sm:flex-row sm:items-center">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <CircleDollarSign className="h-4 w-4 shrink-0 text-muted-foreground" />

          <Link
            href={`/jobs/${job.id}`}
            className="truncate font-semibold hover:underline"
          >
            {job.name}
          </Link>
        </div>

        <p className="mt-2 truncate text-sm text-muted-foreground">{customerName}</p>

        <p className="mt-1 text-xs text-muted-foreground">
          Completed job awaiting billing
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Budget reference</p>

          <p className="font-semibold tabular-nums">
            {job.budgetCents !== null ? formatMoney(job.budgetCents) : "Not set"}
          </p>
        </div>

        <Link
          href={`/invoices/new?customerId=${job.customer.id}&jobId=${job.id}`}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
        >
          Create invoice
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function UpcomingJobRow({ job }: { job: UpcomingJob }) {
  const customerName = formatCustomerName(job.customer);

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="group flex items-center justify-between gap-4 rounded-xl border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-muted/20"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <BriefcaseBusiness className="h-4 w-4 shrink-0 text-muted-foreground" />

          <p className="truncate font-semibold">{job.name}</p>
        </div>

        <p className="mt-2 truncate text-sm text-muted-foreground">{customerName}</p>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-sm font-medium">
          {job.startDate ? formatJobDate(job.startDate) : "Not scheduled"}
        </p>

        <p className="mt-1 text-xs text-muted-foreground">
          {formatEnumLabel(job.status)}
        </p>
      </div>
    </Link>
  );
}

function RecentActivityRow({ activity }: { activity: DashboardActivity }) {
  const customerName = formatCustomerName(activity.customer);

  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium">{activity.title}</p>

          {activity.description && (
            <p className="mt-1 text-sm text-muted-foreground">{activity.description}</p>
          )}

          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <Link
              href={`/customers/${activity.customer.id}`}
              className="hover:text-foreground hover:underline"
            >
              {customerName}
            </Link>

            {activity.actor && <span>by {formatActorName(activity.actor)}</span>}
          </div>
        </div>

        <span className="shrink-0 text-xs text-muted-foreground">
          {formatRelativeTime(activity.createdAt)}
        </span>
      </div>
    </div>
  );
}

function formatCustomerName(customer: {
  firstName: string;
  lastName: string | null;
  companyName: string | null;
}) {
  const personalName = [customer.firstName, customer.lastName].filter(Boolean).join(" ");

  if (customer.companyName) {
    return personalName
      ? `${personalName} — ${customer.companyName}`
      : customer.companyName;
  }

  return personalName || "Customer";
}

function formatActorName(actor: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}) {
  const name = [actor.firstName, actor.lastName].filter(Boolean).join(" ");

  return name || actor.email;
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(cents / 100);
}

function formatJobDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
