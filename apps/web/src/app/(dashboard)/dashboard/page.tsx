import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  DollarSign,
  ListChecks,
  ListTodo,
  ReceiptText,
  UserRound,
  WalletCards,
} from "lucide-react";

import { completeFollowUpAction } from "@/app/(dashboard)/follow-ups/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/activity-utils";
import { formatCurrencyMinorAmounts, formatMinorAmount } from "@/lib/money";
import {
  getDashboard,
  type DashboardActivity,
  type DashboardCustomer,
  type DashboardFollowUp,
  type DashboardJobOnHold,
  type DashboardOverdueInvoice,
  type DashboardRecentPayment,
  type DashboardScheduleItem,
  type DashboardTaskAlert,
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
      value: formatCurrencyMinorAmounts(dashboard.summary.outstanding),
      description: "Open invoice balances",
      icon: WalletCards,
      href: "/invoices?status=OUTSTANDING",
    },
    {
      title: "Collected this month",
      value: formatCurrencyMinorAmounts(dashboard.summary.collectedThisMonth),
      description: "Recorded payments this month",
      icon: DollarSign,
      href: "#recent-payments",
    },
  ];

  const attentionCount =
    dashboard.summary.overdueInvoices +
    dashboard.summary.blockedTasks +
    dashboard.summary.overdueTasks +
    dashboard.summary.jobsOnHold +
    dashboard.summary.overdueFollowUps +
    dashboard.summary.dueTodayFollowUps;

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>

          <p className="mt-1 text-muted-foreground">
            Overview of your business operations and work requiring attention.
          </p>
        </div>

        {attentionCount > 0 && (
          <div className="flex w-fit items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-700">
            <AlertTriangle className="h-4 w-4" />
            {attentionCount} attention item
            {attentionCount === 1 ? "" : "s"}
          </div>
        )}
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ActionMetric
          label="Overdue invoices"
          value={dashboard.summary.overdueInvoices}
          icon={ReceiptText}
          href="#overdue-invoices"
          warning={dashboard.summary.overdueInvoices > 0}
        />

        <ActionMetric
          label="Overdue follow-ups"
          value={dashboard.summary.overdueFollowUps}
          icon={ListChecks}
          href="#follow-ups"
          warning={dashboard.summary.overdueFollowUps > 0}
        />

        <ActionMetric
          label="Follow-ups due today"
          value={dashboard.summary.dueTodayFollowUps}
          icon={CalendarClock}
          href="#follow-ups"
          warning={dashboard.summary.dueTodayFollowUps > 0}
        />

        <ActionMetric
          label="Open follow-ups"
          value={dashboard.summary.openFollowUps}
          icon={ListChecks}
          href="/follow-ups"
        />

        <ActionMetric
          label="Blocked tasks"
          value={dashboard.summary.blockedTasks}
          icon={Ban}
          href="#blocked-tasks"
          warning={dashboard.summary.blockedTasks > 0}
        />

        <ActionMetric
          label="Overdue tasks"
          value={dashboard.summary.overdueTasks}
          icon={ListTodo}
          href="#overdue-tasks"
          warning={dashboard.summary.overdueTasks > 0}
        />

        <ActionMetric
          label="Jobs on hold"
          value={dashboard.summary.jobsOnHold}
          icon={BriefcaseBusiness}
          href="#jobs-on-hold"
          warning={dashboard.summary.jobsOnHold > 0}
        />

        <ActionMetric
          label="Today's schedule"
          value={dashboard.summary.scheduleItemsToday}
          icon={CalendarClock}
          href="#todays-schedule"
        />
      </section>

      <section id="follow-ups" className="scroll-mt-24">
        <Card>
          <CardHeader>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <CardTitle>Follow-up action center</CardTitle>

                <CardDescription className="mt-1">
                  Customer follow-ups requiring attention across your workspace.
                </CardDescription>
              </div>

              <Link
                href="/follow-ups"
                className="text-sm font-medium text-primary hover:underline"
              >
                View all follow-ups
              </Link>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid gap-6 xl:grid-cols-2">
              <FollowUpGroup
                title="My follow-ups"
                description="Open follow-ups assigned to you."
                followUps={dashboard.myFollowUps}
                emptyTitle="Nothing assigned to you"
              />

              <FollowUpGroup
                title="Due today"
                description="Customer follow-ups due today."
                followUps={dashboard.dueTodayFollowUps}
                emptyTitle="Nothing due today"
              />

              <FollowUpGroup
                title="Overdue"
                description="Open customer follow-ups past their due date."
                followUps={dashboard.overdueFollowUps}
                emptyTitle="No overdue follow-ups"
                warning
              />

              <FollowUpGroup
                title="Upcoming"
                description="Next scheduled customer follow-ups."
                followUps={dashboard.upcomingFollowUps}
                emptyTitle="No upcoming follow-ups"
              />
            </div>
          </CardContent>
        </Card>
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
              <EmptyState
                icon={CheckCircle2}
                title="Nothing waiting for billing"
                description="Completed jobs without an active invoice will appear here."
              />
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

      <section id="overdue-invoices" className="scroll-mt-24">
        <Card>
          <CardHeader>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <CardTitle>Overdue invoices</CardTitle>

                <CardDescription className="mt-1">
                  Outstanding invoices already marked overdue.
                </CardDescription>
              </div>

              <Link
                href="/invoices?status=OVERDUE"
                className="text-sm font-medium text-primary hover:underline"
              >
                View all overdue
              </Link>
            </div>
          </CardHeader>

          <CardContent>
            {dashboard.overdueInvoices.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No overdue invoices"
                description="There are no overdue balances requiring attention."
              />
            ) : (
              <div className="space-y-3">
                {dashboard.overdueInvoices.map((invoice) => (
                  <OverdueInvoiceRow key={invoice.id} invoice={invoice} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card id="todays-schedule" className="scroll-mt-24">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>Today&apos;s schedule</CardTitle>

                <CardDescription className="mt-1">
                  Work, visits, inspections, deliveries, and meetings scheduled today.
                </CardDescription>
              </div>

              <Link
                href="/calendar"
                className="text-sm font-medium text-primary hover:underline"
              >
                Calendar
              </Link>
            </div>
          </CardHeader>

          <CardContent>
            {dashboard.todaysSchedule.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="Nothing scheduled today"
                description="Today's schedule events will appear here."
              />
            ) : (
              <div className="space-y-3">
                {dashboard.todaysSchedule.map((item) => (
                  <TodayScheduleRow key={item.id} item={item} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card id="recent-payments" className="scroll-mt-24">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>Recent payments</CardTitle>

                <CardDescription className="mt-1">
                  Latest recorded customer payments.
                </CardDescription>
              </div>

              <Link
                href="/invoices"
                className="text-sm font-medium text-primary hover:underline"
              >
                Invoices
              </Link>
            </div>
          </CardHeader>

          <CardContent>
            {dashboard.recentPayments.length === 0 ? (
              <EmptyState
                icon={CircleDollarSign}
                title="No payments recorded yet"
                description="Recorded and Stripe payments will appear here."
              />
            ) : (
              <div className="divide-y">
                {dashboard.recentPayments.map((payment) => (
                  <RecentPaymentRow key={payment.id} payment={payment} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card id="blocked-tasks" className="scroll-mt-24">
          <CardHeader>
            <CardTitle>Blocked tasks</CardTitle>

            <CardDescription>
              Tasks explicitly marked blocked on active jobs.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {dashboard.blockedTasks.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No blocked tasks"
                description="Blocked tasks will appear here when work is unable to proceed."
              />
            ) : (
              <div className="space-y-3">
                {dashboard.blockedTasks.map((task) => (
                  <TaskAlertRow key={task.id} task={task} kind="blocked" />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card id="overdue-tasks" className="scroll-mt-24">
          <CardHeader>
            <CardTitle>Overdue tasks</CardTitle>

            <CardDescription>Open tasks whose due dates have passed.</CardDescription>
          </CardHeader>

          <CardContent>
            {dashboard.overdueTasks.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No overdue tasks"
                description="Open work that passes its due date will appear here."
              />
            ) : (
              <div className="space-y-3">
                {dashboard.overdueTasks.map((task) => (
                  <TaskAlertRow key={task.id} task={task} kind="overdue" />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section id="jobs-on-hold" className="scroll-mt-24">
        <Card>
          <CardHeader>
            <CardTitle>Jobs on hold</CardTitle>

            <CardDescription>
              Jobs currently paused and waiting to resume.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {dashboard.jobsOnHold.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No jobs on hold"
                description="Paused jobs will appear here."
              />
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {dashboard.jobsOnHold.map((job) => (
                  <JobOnHoldRow key={job.id} job={job} />
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
                  Your next jobs by scheduled start date.
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
              <EmptyState
                icon={CalendarDays}
                title="No upcoming jobs"
                description="Jobs with future start dates will appear here."
              />
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
              <EmptyState
                icon={Clock3}
                title="No activity yet"
                description="Job, estimate, invoice, task, and payment activity will appear here."
              />
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

function FollowUpGroup({
  title,
  description,
  followUps,
  emptyTitle,
  warning = false,
}: {
  title: string;
  description: string;
  followUps: DashboardFollowUp[];
  emptyTitle: string;
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        warning && followUps.length > 0 ? "border-red-500/30 bg-red-500/5" : "bg-muted/10"
      }`}
    >
      <div>
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">{title}</h3>

          <span className="rounded-full border bg-background px-2 py-0.5 text-xs font-medium">
            {followUps.length}
          </span>
        </div>

        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>

      {followUps.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed bg-background px-4 py-6 text-center">
          <CheckCircle2 className="mx-auto h-5 w-5 text-muted-foreground" />

          <p className="mt-2 text-sm text-muted-foreground">{emptyTitle}</p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {followUps.slice(0, 4).map((followUp) => (
            <DashboardFollowUpRow
              key={followUp.id}
              followUp={followUp}
              warning={warning}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DashboardFollowUpRow({
  followUp,
  warning,
}: {
  followUp: DashboardFollowUp;
  warning: boolean;
}) {
  return (
    <div
      className={`rounded-lg border bg-background p-3 ${
        warning ? "border-red-500/20" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium">{followUp.content}</p>

          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <Link
              href={`/customers/${followUp.customer.id}`}
              className="hover:text-foreground hover:underline"
            >
              {formatCustomerName(followUp.customer)}
            </Link>

            {followUp.assignedTo && (
              <span className="flex items-center gap-1">
                <UserRound className="h-3 w-3" />

                {formatActorName(followUp.assignedTo)}
              </span>
            )}

            {followUp.dueAt && <span>Due {formatDate(followUp.dueAt)}</span>}
          </div>
        </div>

        <form
          action={completeFollowUpAction.bind(null, followUp.customer.id, followUp.id)}
        >
          <Button type="submit" size="sm" variant="outline" title="Complete follow-up">
            <Check className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

function ActionMetric({
  label,
  value,
  icon: Icon,
  href,
  warning = false,
}: {
  label: string;
  value: number;
  icon: typeof AlertTriangle;
  href: string;
  warning?: boolean;
}) {
  return (
    <Link href={href}>
      <Card
        className={`h-full transition-colors hover:bg-muted/20 ${
          warning ? "border-amber-500/30" : ""
        }`}
      >
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{label}</p>

              <p className="mt-2 text-2xl font-semibold">{value}</p>
            </div>

            <Icon
              className={`h-5 w-5 ${
                warning ? "text-amber-600" : "text-muted-foreground"
              }`}
            />
          </div>
        </CardContent>
      </Card>
    </Link>
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
            {job.budgetCents !== null
              ? formatMinorAmount(job.budgetCents, job.currency)
              : "Not set"}
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

function OverdueInvoiceRow({ invoice }: { invoice: DashboardOverdueInvoice }) {
  const daysOverdue = invoice.dueDate ? getDaysOverdue(invoice.dueDate) : null;

  return (
    <Link
      href={`/invoices/${invoice.id}`}
      className="group flex flex-col justify-between gap-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4 transition-colors hover:border-red-500/40 sm:flex-row sm:items-center"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <ReceiptText className="h-4 w-4 text-red-600" />

          <span className="font-semibold">{invoice.number}</span>

          {daysOverdue !== null && (
            <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-700">
              {daysOverdue} day
              {daysOverdue === 1 ? "" : "s"} overdue
            </span>
          )}
        </div>

        <p className="mt-2 text-sm text-muted-foreground">
          {formatCustomerName(invoice.customer)}
        </p>

        {invoice.job && (
          <p className="mt-1 text-xs text-muted-foreground">{invoice.job.name}</p>
        )}
      </div>

      <div className="shrink-0 text-left sm:text-right">
        <p className="text-xs text-muted-foreground">Balance due</p>

        <p className="text-lg font-semibold tabular-nums text-red-700">
          {formatMinorAmount(invoice.balanceDueCents, invoice.currency)}
        </p>

        {invoice.dueDate && (
          <p className="mt-1 text-xs text-muted-foreground">
            Due {formatDate(invoice.dueDate)}
          </p>
        )}
      </div>
    </Link>
  );
}

function RecentPaymentRow({ payment }: { payment: DashboardRecentPayment }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <Link
          href={`/invoices/${payment.invoice.id}`}
          className="font-medium hover:underline"
        >
          {payment.invoice.number}
        </Link>

        <p className="mt-1 truncate text-sm text-muted-foreground">
          {formatCustomerName(payment.customer)}
        </p>

        <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
          <span>{formatEnumLabel(payment.method)}</span>

          <span>•</span>

          <span>{formatRelativeTime(payment.receivedAt)}</span>

          {payment.reference && (
            <>
              <span>•</span>

              <span>{payment.reference}</span>
            </>
          )}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <p className="font-semibold tabular-nums text-green-700">
          +{formatMinorAmount(payment.amountCents, payment.currency)}
        </p>
      </div>
    </div>
  );
}

function TaskAlertRow({
  task,
  kind,
}: {
  task: DashboardTaskAlert;
  kind: "blocked" | "overdue";
}) {
  return (
    <Link
      href={`/jobs/${task.job.id}`}
      className={`block rounded-xl border p-4 transition-colors hover:bg-muted/20 ${
        kind === "blocked"
          ? "border-amber-500/30 bg-amber-500/5"
          : "border-red-500/20 bg-red-500/5"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {kind === "blocked" ? (
              <Ban className="h-4 w-4 text-amber-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-600" />
            )}

            <p className="font-medium">{task.title}</p>

            <span className="text-xs text-muted-foreground">
              {formatEnumLabel(task.priority)}
            </span>
          </div>

          <p className="mt-2 text-sm text-muted-foreground">{task.job.name}</p>

          <p className="mt-1 text-xs text-muted-foreground">
            {formatCustomerName(task.job.customer)}
          </p>
        </div>

        {task.dueDate && (
          <div className="shrink-0 text-right">
            <p className="text-xs text-muted-foreground">Due</p>

            <p className="text-sm font-medium">{formatDate(task.dueDate)}</p>
          </div>
        )}
      </div>
    </Link>
  );
}

function JobOnHoldRow({ job }: { job: DashboardJobOnHold }) {
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="block rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 transition-colors hover:border-orange-500/40"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-semibold">{job.name}</p>

          <p className="mt-2 text-sm text-muted-foreground">
            {formatCustomerName(job.customer)}
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            Priority: {formatEnumLabel(job.priority)}
          </p>
        </div>

        <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 text-xs font-medium text-orange-700">
          On hold
        </span>
      </div>
    </Link>
  );
}

function TodayScheduleRow({ item }: { item: DashboardScheduleItem }) {
  return (
    <Link
      href={`/jobs/${item.job.id}`}
      className="group flex items-start justify-between gap-4 rounded-xl border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-muted/20"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />

          <p className="font-semibold">{item.title}</p>

          <span className="text-xs text-muted-foreground">
            {formatEnumLabel(item.type)}
          </span>
        </div>

        <p className="mt-2 text-sm text-muted-foreground">{item.job.name}</p>

        <p className="mt-1 text-xs text-muted-foreground">
          {formatCustomerName(item.job.customer)}
        </p>

        {item.location && (
          <p className="mt-1 truncate text-xs text-muted-foreground">{item.location}</p>
        )}
      </div>

      <div className="shrink-0 text-right">
        <p className="text-sm font-medium">
          {item.allDay ? "All day" : formatTime(item.startAt)}
        </p>

        {item.endAt && !item.allDay && (
          <p className="mt-1 text-xs text-muted-foreground">
            to {formatTime(item.endAt)}
          </p>
        )}

        <p className="mt-1 text-xs text-muted-foreground">
          {formatEnumLabel(item.status)}
        </p>
      </div>
    </Link>
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
          {job.startDate ? formatDate(job.startDate) : "Not scheduled"}
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

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof CheckCircle2;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed">
      <div className="max-w-sm px-6 text-center">
        <Icon className="mx-auto h-8 w-8 text-muted-foreground" />

        <p className="mt-3 font-medium">{title}</p>

        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function formatCustomerName(customer: DashboardCustomer) {
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getDaysOverdue(value: string) {
  const dueDate = new Date(value);

  const now = new Date();

  const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const difference = today.getTime() - dueDay.getTime();

  return Math.max(0, Math.floor(difference / (1000 * 60 * 60 * 24)));
}
