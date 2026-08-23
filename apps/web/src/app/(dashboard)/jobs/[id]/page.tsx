import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CircleDollarSign,
  FileText,
  MapPin,
  Plus,
  ReceiptText,
  UserRound,
  WalletCards,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCrewMembers } from "@/lib/crew-api";
import { getJobEstimates, type Estimate } from "@/lib/estimates-api";
import { getJobInvoices, type Invoice } from "@/lib/invoices-api";
import { getJobCosts, getJobCostSummary } from "@/lib/job-costs-api";
import { getJobMaterials } from "@/lib/job-materials-api";
import { getJobPhotos } from "@/lib/job-photos-api";
import { getJobSchedules } from "@/lib/job-schedules-api";
import { getJobTasks } from "@/lib/job-tasks-api";
import { getJobTimeEntries } from "@/lib/job-time-entries-api";
import { getJob, type Job } from "@/lib/jobs-api";
import { getJobDocuments } from "@/lib/job-documents-api";
import { JobDocumentWorkspace } from "./job-document-workspace";
import { JobCrewWorkspace } from "./job-crew-workspace";
import { JobFinancials } from "./job-financials";
import { JobMaterialEstimatePanel } from "./job-material-estimate-panel";
import { JobMaterialForm } from "./job-material-form";
import { JobMaterialInvoicePanel } from "./job-material-invoice-panel";
import { JobMaterialList } from "./job-material-list";
import { JobPhotoWorkspace } from "./job-photo-workspace";
import { calculateJobReadiness } from "./job-readiness";
import { JobReadinessCard } from "./job-readiness-card";
import { JobScheduleForm } from "./job-schedule-form";
import { JobScheduleList } from "./job-schedule-list";
import { JobStatusActions } from "./job-status-actions";
import { JobStatusControl } from "./job-status-control";
import { JobTaskForm } from "./job-task-form";
import { JobTaskList } from "./job-task-list";

type JobDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function JobDetailsPage({ params }: JobDetailsPageProps) {
  const { id } = await params;

  const [
    job,
    tasks,
    schedules,
    jobEstimates,
    jobInvoices,
    jobCosts,
    jobCostSummary,
    jobMaterials,
    crewMembers,
    jobTimeEntries,
    jobPhotos,
    jobDocuments,
  ] = await Promise.all([
    getJob(id),
    getJobTasks(id),
    getJobSchedules(id, true),
    getJobEstimates(id),
    getJobInvoices(id),
    getJobCosts(id),
    getJobCostSummary(id),
    getJobMaterials(id),
    getCrewMembers(),
    getJobTimeEntries(id),
    getJobPhotos(id),
    getJobDocuments(id),
  ]);

  const customerName = [job.customer.firstName, job.customer.lastName]
    .filter(Boolean)
    .join(" ");

  const fullAddress = [
    job.addressLine1,
    job.addressLine2,
    job.city,
    job.province,
    job.postalCode,
    job.country,
  ]
    .filter(Boolean)
    .join(", ");

  const completedTasks = tasks.filter((task) => task.status === "COMPLETED").length;

  const taskProgress =
    tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  const activeSchedules = schedules.filter(
    (schedule) => schedule.status === "SCHEDULED" || schedule.status === "IN_PROGRESS",
  );

  const completedSchedules = schedules.filter(
    (schedule) => schedule.status === "COMPLETED",
  );

  const cancelledSchedules = schedules.filter(
    (schedule) => schedule.status === "CANCELLED",
  );

  const nextSchedule =
    activeSchedules.length > 0
      ? [...activeSchedules].sort(
          (first, second) =>
            new Date(first.startAt).getTime() - new Date(second.startAt).getTime(),
        )[0]
      : null;

  const draftEstimates = jobEstimates.filter((estimate) => estimate.status === "DRAFT");

  const activeEstimates = jobEstimates.filter(
    (estimate) => estimate.status === "SENT" || estimate.status === "VIEWED",
  );

  const approvedEstimates = jobEstimates.filter(
    (estimate) => estimate.status === "APPROVED",
  );

  const approvedEstimateValue = approvedEstimates.reduce(
    (total, estimate) => total + estimate.totalCents,
    0,
  );

  const draftInvoices = jobInvoices.filter((invoice) => invoice.status === "DRAFT");

  const outstandingInvoices = jobInvoices.filter(
    (invoice) =>
      invoice.status === "SENT" ||
      invoice.status === "VIEWED" ||
      invoice.status === "PARTIALLY_PAID" ||
      invoice.status === "OVERDUE",
  );

  const paidInvoices = jobInvoices.filter((invoice) => invoice.status === "PAID");

  const totalInvoicedCents = jobInvoices
    .filter((invoice) => invoice.status !== "VOIDED")
    .reduce((total, invoice) => total + invoice.totalCents, 0);

  const totalPaidCents = jobInvoices
    .filter((invoice) => invoice.status !== "VOIDED")
    .reduce((total, invoice) => total + invoice.amountPaidCents, 0);

  const totalBalanceDueCents = jobInvoices
    .filter((invoice) => invoice.status !== "VOIDED")
    .reduce((total, invoice) => total + invoice.balanceDueCents, 0);

  const activeCrewCount = crewMembers.filter((crewMember) => crewMember.active).length;

  const readiness = calculateJobReadiness({
    status: job.status,
    tasks,
    schedules,
    invoices: jobInvoices,
  });

  return (
    <div className="space-y-8">
      <Button
        variant="ghost"
        nativeButton={false}
        render={
          <Link href="/jobs">
            <ArrowLeft className="h-4 w-4" />
            Back to jobs
          </Link>
        }
      />

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">{job.name}</h1>

            <StatusBadge status={job.status} />

            <PriorityBadge priority={job.priority} />

            {job.archivedAt && (
              <span className="rounded-full border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                Archived
              </span>
            )}
          </div>

          <p className="mt-2 text-muted-foreground">
            Job workspace and project overview.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/customers/${job.customer.id}`}>View customer</Link>}
          />

          {!job.archivedAt && (
            <Button
              nativeButton={false}
              render={<Link href={`/jobs/${job.id}/edit`}>Edit job</Link>}
            />
          )}

          <JobStatusActions
            jobId={job.id}
            customerId={job.customer.id}
            jobName={job.name}
            archived={Boolean(job.archivedAt)}
          />
        </div>
      </div>

      {job.archivedAt && (
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
          <p className="font-medium">Archived job</p>

          <p className="mt-1 text-sm text-muted-foreground">
            This job was archived on {new Date(job.archivedAt).toLocaleDateString()}.
          </p>
        </div>
      )}

      <JobStatusControl
        jobId={job.id}
        customerId={job.customer.id}
        status={job.status}
        archived={Boolean(job.archivedAt)}
        readiness={readiness}
      />

      <JobReadinessCard
        jobId={job.id}
        customerId={job.customer.id}
        status={job.status}
        archived={Boolean(job.archivedAt)}
        readiness={readiness}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryItem label="Customer" value={customerName} icon={UserRound} />

        <SummaryItem
          label="Start date"
          value={
            job.startDate ? new Date(job.startDate).toLocaleDateString() : "Not scheduled"
          }
          icon={CalendarDays}
        />

        <SummaryItem
          label="Budget"
          value={job.budgetCents !== null ? formatMoney(job.budgetCents) : "Not set"}
          icon={CircleDollarSign}
        />

        <SummaryItem label="Location" value={job.city ?? "Not set"} icon={MapPin} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Job overview</CardTitle>

            <CardDescription>Scope and project information.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <InfoRow label="Status" value={formatEnumLabel(job.status)} />

            <InfoRow label="Priority" value={formatEnumLabel(job.priority)} />

            <InfoRow
              label="Description"
              value={job.description ?? "No description yet."}
            />

            <InfoRow
              label="Created"
              value={new Date(job.createdAt).toLocaleDateString()}
            />

            <InfoRow
              label="Last updated"
              value={new Date(job.updatedAt).toLocaleDateString()}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer & location</CardTitle>

            <CardDescription>Customer and job-site information.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="flex items-start gap-3">
              <UserRound className="mt-0.5 h-4 w-4 text-muted-foreground" />

              <div>
                <p className="font-medium">{customerName}</p>

                {job.customer.companyName && (
                  <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4" />

                    {job.customer.companyName}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />

              <p className="text-sm">{fullAddress || "No job-site address yet."}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <CardTitle>Estimates</CardTitle>

              <CardDescription className="mt-1">
                Quotes and pricing prepared for this job.
              </CardDescription>
            </div>

            {!job.archivedAt && (
              <Button
                size="sm"
                nativeButton={false}
                render={
                  <Link
                    href={`/estimates/new?customerId=${job.customer.id}&jobId=${job.id}`}
                  >
                    <Plus className="h-4 w-4" />
                    New estimate
                  </Link>
                }
              />
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <WorkspaceSummaryItem label="Total estimates" value={jobEstimates.length} />

            <WorkspaceSummaryItem label="Draft" value={draftEstimates.length} />

            <WorkspaceSummaryItem label="Sent / viewed" value={activeEstimates.length} />

            <WorkspaceSummaryItem
              label="Approved value"
              value={formatMoney(approvedEstimateValue)}
            />
          </div>

          {jobEstimates.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed">
              <div className="max-w-sm px-6 text-center">
                <FileText className="mx-auto h-8 w-8 text-muted-foreground" />

                <p className="mt-3 font-medium">No estimates yet</p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Create an estimate for this job to start tracking quoted work and
                  pricing.
                </p>

                {!job.archivedAt && (
                  <Button
                    className="mt-4"
                    size="sm"
                    nativeButton={false}
                    render={
                      <Link
                        href={`/estimates/new?customerId=${job.customer.id}&jobId=${job.id}`}
                      >
                        <Plus className="h-4 w-4" />
                        Create estimate
                      </Link>
                    }
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {jobEstimates.map((estimate) => (
                <JobEstimateRow key={estimate.id} estimate={estimate} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <CardTitle>Invoices</CardTitle>

              <CardDescription className="mt-1">
                Billing, collections, and payment progress for this job.
              </CardDescription>
            </div>

            {!job.archivedAt && (
              <Button
                size="sm"
                nativeButton={false}
                render={
                  <Link
                    href={`/invoices/new?customerId=${job.customer.id}&jobId=${job.id}`}
                  >
                    <Plus className="h-4 w-4" />
                    New invoice
                  </Link>
                }
              />
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <WorkspaceSummaryItem
              label="Total invoiced"
              value={formatMoney(totalInvoicedCents)}
            />

            <WorkspaceSummaryItem label="Paid" value={formatMoney(totalPaidCents)} />

            <WorkspaceSummaryItem
              label="Balance due"
              value={formatMoney(totalBalanceDueCents)}
            />

            <WorkspaceSummaryItem label="Invoices" value={jobInvoices.length} />
          </div>

          {jobInvoices.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed">
              <div className="max-w-sm px-6 text-center">
                <ReceiptText className="mx-auto h-8 w-8 text-muted-foreground" />

                <p className="mt-3 font-medium">No invoices yet</p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Create an invoice for this job or convert an approved estimate into one.
                </p>

                {!job.archivedAt && (
                  <Button
                    className="mt-4"
                    size="sm"
                    nativeButton={false}
                    render={
                      <Link
                        href={`/invoices/new?customerId=${job.customer.id}&jobId=${job.id}`}
                      >
                        <Plus className="h-4 w-4" />
                        Create invoice
                      </Link>
                    }
                  />
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <InvoiceStatusSummary label="Draft" value={draftInvoices.length} />

                <InvoiceStatusSummary
                  label="Outstanding"
                  value={outstandingInvoices.length}
                />

                <InvoiceStatusSummary label="Paid" value={paidInvoices.length} />
              </div>

              <div className="space-y-3">
                {jobInvoices.map((invoice) => (
                  <JobInvoiceRow key={invoice.id} invoice={invoice} />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Financials</CardTitle>

          <CardDescription>
            Track actual job costs, budget performance, revenue, profit, and margin.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <JobFinancials
            jobId={job.id}
            costs={jobCosts}
            summary={jobCostSummary}
            currency="CAD"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <CardTitle>Schedule</CardTitle>

              <CardDescription className="mt-1">
                Plan work, site visits, inspections, deliveries, and meetings.
              </CardDescription>
            </div>

            <div className="text-sm text-muted-foreground">
              {activeSchedules.length} upcoming
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <ScheduleSummaryItem label="Upcoming" value={activeSchedules.length} />

            <ScheduleSummaryItem label="Completed" value={completedSchedules.length} />

            <ScheduleSummaryItem label="Cancelled" value={cancelledSchedules.length} />

            <ScheduleSummaryItem
              label="Next event"
              value={
                nextSchedule
                  ? formatScheduleSummary(nextSchedule.startAt, nextSchedule.allDay)
                  : "None scheduled"
              }
            />
          </div>

          {!job.archivedAt && (
            <JobScheduleForm jobId={job.id} customerId={job.customer.id} />
          )}

          <JobScheduleList
            jobId={job.id}
            customerId={job.customer.id}
            schedules={schedules}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <CardTitle>Tasks</CardTitle>

              <CardDescription className="mt-1">
                Track the work required to complete this job.
              </CardDescription>
            </div>

            <div className="text-sm text-muted-foreground">
              {completedTasks} of {tasks.length} complete
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>

              <span className="font-medium">{taskProgress}%</span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${taskProgress}%`,
                }}
              />
            </div>
          </div>

          {!job.archivedAt && <JobTaskForm jobId={job.id} customerId={job.customer.id} />}

          <JobTaskList jobId={job.id} customerId={job.customer.id} tasks={tasks} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <CardTitle>Materials</CardTitle>

              <CardDescription className="mt-1">
                Track required materials, purchasing, receiving, suppliers, and material
                costs.
              </CardDescription>
            </div>

            <div className="text-sm text-muted-foreground">
              {jobMaterials.length} material
              {jobMaterials.length === 1 ? "" : "s"}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {!job.archivedAt && <JobMaterialForm jobId={job.id} />}

          {!job.archivedAt && (
            <JobMaterialEstimatePanel
              jobId={job.id}
              materials={jobMaterials}
              estimates={jobEstimates}
              currency="CAD"
            />
          )}

          {!job.archivedAt && (
            <JobMaterialInvoicePanel
              jobId={job.id}
              materials={jobMaterials}
              invoices={jobInvoices}
              currency="CAD"
            />
          )}

          <JobMaterialList jobId={job.id} materials={jobMaterials} currency="CAD" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <CardTitle>Crew & labor</CardTitle>

              <CardDescription className="mt-1">
                Manage crew members, track job time, and automatically include labor in
                job profitability.
              </CardDescription>
            </div>

            <div className="text-sm text-muted-foreground">{activeCrewCount} active</div>
          </div>
        </CardHeader>

        <CardContent>
          <JobCrewWorkspace
            jobId={job.id}
            crewMembers={crewMembers}
            timeEntries={jobTimeEntries}
            currency="CAD"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <CardTitle>Photos</CardTitle>

              <CardDescription className="mt-1">
                Document job progress, before and after work, issues, and site conditions.
              </CardDescription>
            </div>

            <div className="text-sm text-muted-foreground">
              {jobPhotos.length} photo
              {jobPhotos.length === 1 ? "" : "s"}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <JobPhotoWorkspace
            jobId={job.id}
            photos={jobPhotos}
            archived={Boolean(job.archivedAt)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <CardTitle>Documents</CardTitle>

              <CardDescription className="mt-1">
                Store contracts, permits, receipts, warranties, plans, and other job
                files.
              </CardDescription>
            </div>

            <div className="text-sm text-muted-foreground">
              {jobDocuments.length} document
              {jobDocuments.length === 1 ? "" : "s"}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <JobDocumentWorkspace
            jobId={job.id}
            documents={jobDocuments}
            archived={Boolean(job.archivedAt)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function JobEstimateRow({ estimate }: { estimate: Estimate }) {
  return (
    <Link
      href={`/estimates/${estimate.id}`}
      className="group flex flex-col justify-between gap-4 rounded-xl border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-muted/20 sm:flex-row sm:items-center"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />

          <span className="font-semibold">{estimate.number}</span>

          <EstimateStatusBadge status={estimate.status} />
        </div>

        <p className="mt-2 truncate text-sm">{estimate.title || "Untitled estimate"}</p>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Created {new Date(estimate.createdAt).toLocaleDateString()}</span>

          <span>
            {estimate.lineItems.length} item
            {estimate.lineItems.length === 1 ? "" : "s"}
          </span>

          {estimate.validUntil && (
            <span>Valid until {new Date(estimate.validUntil).toLocaleDateString()}</span>
          )}
        </div>
      </div>

      <div className="shrink-0 text-left sm:text-right">
        <p className="text-lg font-semibold tabular-nums">
          {formatMoney(estimate.totalCents)}
        </p>

        <p className="mt-1 text-xs text-muted-foreground group-hover:text-foreground">
          View estimate
        </p>
      </div>
    </Link>
  );
}

function JobInvoiceRow({ invoice }: { invoice: Invoice }) {
  return (
    <Link
      href={`/invoices/${invoice.id}`}
      className="group flex flex-col justify-between gap-4 rounded-xl border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-muted/20 sm:flex-row sm:items-center"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <ReceiptText className="h-4 w-4 text-muted-foreground" />

          <span className="font-semibold">{invoice.number}</span>

          <InvoiceStatusBadge status={invoice.status} />
        </div>

        <p className="mt-2 truncate text-sm">{invoice.title || "Untitled invoice"}</p>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Issued {new Date(invoice.issueDate).toLocaleDateString()}</span>

          {invoice.dueDate && (
            <span>Due {new Date(invoice.dueDate).toLocaleDateString()}</span>
          )}

          {invoice.sourceEstimate && <span>From {invoice.sourceEstimate.number}</span>}
        </div>
      </div>

      <div className="grid shrink-0 gap-1 text-left sm:min-w-48 sm:text-right">
        <p className="text-lg font-semibold tabular-nums">
          {formatMoney(invoice.totalCents)}
        </p>

        {invoice.balanceDueCents > 0 ? (
          <p className="text-xs text-muted-foreground">
            Balance{" "}
            <span className="font-medium text-foreground">
              {formatMoney(invoice.balanceDueCents)}
            </span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Paid{" "}
            <span className="font-medium text-foreground">
              {formatMoney(invoice.amountPaidCents)}
            </span>
          </p>
        )}

        <p className="text-xs text-muted-foreground group-hover:text-foreground">
          View invoice
        </p>
      </div>
    </Link>
  );
}

function EstimateStatusBadge({ status }: { status: Estimate["status"] }) {
  const styles: Record<Estimate["status"], string> = {
    DRAFT: "border-slate-500/30 bg-slate-500/10 text-slate-600",
    SENT: "border-blue-500/30 bg-blue-500/10 text-blue-600",
    VIEWED: "border-indigo-500/30 bg-indigo-500/10 text-indigo-600",
    APPROVED: "border-green-500/30 bg-green-500/10 text-green-700",
    DECLINED: "border-red-500/30 bg-red-500/10 text-red-600",
    EXPIRED: "border-orange-500/30 bg-orange-500/10 text-orange-700",
  };

  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {formatEnumLabel(status)}
    </span>
  );
}

function InvoiceStatusBadge({ status }: { status: Invoice["status"] }) {
  const styles: Record<Invoice["status"], string> = {
    DRAFT: "border-slate-500/30 bg-slate-500/10 text-slate-600",
    SENT: "border-blue-500/30 bg-blue-500/10 text-blue-600",
    VIEWED: "border-indigo-500/30 bg-indigo-500/10 text-indigo-600",
    PARTIALLY_PAID: "border-amber-500/30 bg-amber-500/10 text-amber-700",
    PAID: "border-green-500/30 bg-green-500/10 text-green-700",
    OVERDUE: "border-red-500/30 bg-red-500/10 text-red-600",
    VOIDED: "border-zinc-500/30 bg-zinc-500/10 text-zinc-600",
  };

  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {formatEnumLabel(status)}
    </span>
  );
}

function WorkspaceSummaryItem({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>

      <p className="mt-2 font-semibold">{value}</p>
    </div>
  );
}

function InvoiceStatusSummary({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-muted/10 px-4 py-3">
      <div className="flex items-center gap-2">
        <WalletCards className="h-4 w-4 text-muted-foreground" />

        <span className="text-sm text-muted-foreground">{label}</span>
      </div>

      <span className="font-semibold">{value}</span>
    </div>
  );
}

function SummaryItem({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof UserRound;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />

          <span className="text-sm">{label}</span>
        </div>

        <p className="mt-2 truncate font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function ScheduleSummaryItem({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>

      <p className="mt-2 font-semibold">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>

      <p className="mt-1 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: Job["status"] }) {
  const styles: Record<Job["status"], string> = {
    LEAD: "border-slate-500/30 bg-slate-500/10 text-slate-600",
    ESTIMATING: "border-indigo-500/30 bg-indigo-500/10 text-indigo-600",
    APPROVED: "border-violet-500/30 bg-violet-500/10 text-violet-600",
    SCHEDULED: "border-blue-500/30 bg-blue-500/10 text-blue-600",
    IN_PROGRESS: "border-amber-500/30 bg-amber-500/10 text-amber-700",
    ON_HOLD: "border-orange-500/30 bg-orange-500/10 text-orange-700",
    COMPLETED: "border-green-500/30 bg-green-500/10 text-green-700",
    CANCELLED: "border-red-500/30 bg-red-500/10 text-red-600",
  };

  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${styles[status]}`}
    >
      {formatEnumLabel(status)}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: Job["priority"] }) {
  const styles: Record<Job["priority"], string> = {
    LOW: "text-muted-foreground",
    NORMAL: "text-blue-600",
    HIGH: "text-orange-600",
    URGENT: "text-red-600",
  };

  return (
    <span className={`text-xs font-medium ${styles[priority]}`}>
      {formatEnumLabel(priority)}
    </span>
  );
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

function formatScheduleSummary(value: string, allDay: boolean) {
  const date = new Date(value);

  if (allDay) {
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
