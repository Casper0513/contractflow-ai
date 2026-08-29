import Link from "next/link";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  FileText,
  Mail,
  MapPin,
  Phone,
  Plus,
  ReceiptText,
  WalletCards,
} from "lucide-react";

import { CustomerCommunicationCenter } from "@/components/customers/customer-communication-center";
import { ActivitySummary } from "@/components/customers/activity-summary";
import { CustomerActivityTimeline } from "@/components/customers/customer-activity-timeline";
import { CustomerHealth } from "@/components/customers/customer-health";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getCustomer,
  getCustomerActivity,
  getCustomerCommunications,
} from "@/lib/customers-api";
import { getCustomerEstimates, type Estimate } from "@/lib/estimates-api";
import { getCustomerInvoices, type Invoice } from "@/lib/invoices-api";
import { getCustomerJobs, type Job } from "@/lib/jobs-api";
import { CustomerInternalNotesWorkspace } from "@/components/customers/customer-internal-notes-workspace";
import { getCustomerInternalNotes } from "@/lib/customer-internal-notes-api";
import { getTeamMembers } from "@/lib/team-members-api";

import { CustomerAiSummary } from "./customer-ai-summary";
import { CustomerEmailComposer } from "./customer-email-composer";
import { CustomerStatusActions } from "./customer-status-actions";

type CustomerDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CustomerDetailsPage({ params }: CustomerDetailsPageProps) {
  const { id } = await params;

  const [
    customer,
    activities,
    jobs,
    customerEstimates,
    customerInvoices,
    communications,
    internalNotes,
    teamMembers,
  ] = await Promise.all([
    getCustomer(id),
    getCustomerActivity(id),
    getCustomerJobs(id),
    getCustomerEstimates(id),
    getCustomerInvoices(id),
    getCustomerCommunications(id),
    getCustomerInternalNotes(id),
    getTeamMembers(),
  ]);

  const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ");

  const draftEstimates = customerEstimates.filter(
    (estimate) => estimate.status === "DRAFT",
  );

  const activeEstimates = customerEstimates.filter(
    (estimate) => estimate.status === "SENT" || estimate.status === "VIEWED",
  );

  const approvedEstimates = customerEstimates.filter(
    (estimate) => estimate.status === "APPROVED",
  );

  const approvedEstimateValue = approvedEstimates.reduce(
    (total, estimate) => total + estimate.totalCents,
    0,
  );

  const draftInvoices = customerInvoices.filter((invoice) => invoice.status === "DRAFT");

  const outstandingInvoices = customerInvoices.filter(
    (invoice) =>
      invoice.status === "SENT" ||
      invoice.status === "VIEWED" ||
      invoice.status === "PARTIALLY_PAID" ||
      invoice.status === "OVERDUE",
  );

  const paidInvoices = customerInvoices.filter((invoice) => invoice.status === "PAID");

  const totalInvoicedCents = customerInvoices
    .filter((invoice) => invoice.status !== "VOIDED")
    .reduce((total, invoice) => total + invoice.totalCents, 0);

  const totalPaidCents = customerInvoices
    .filter((invoice) => invoice.status !== "VOIDED")
    .reduce((total, invoice) => total + invoice.amountPaidCents, 0);

  const totalBalanceDueCents = customerInvoices
    .filter((invoice) => invoice.status !== "VOIDED")
    .reduce((total, invoice) => total + invoice.balanceDueCents, 0);

  return (
    <div className="space-y-8">
      <Button
        variant="ghost"
        nativeButton={false}
        render={
          <Link href="/customers">
            <ArrowLeft className="h-4 w-4" />
            Back to customers
          </Link>
        }
      />

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{name}</h1>

          {customer.companyName && (
            <p className="mt-1 text-muted-foreground">{customer.companyName}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {!customer.archivedAt && (
            <Button
              nativeButton={false}
              render={<Link href={`/customers/${customer.id}/edit`}>Edit customer</Link>}
            />
          )}

          <CustomerStatusActions
            customerId={customer.id}
            customerName={name}
            archived={Boolean(customer.archivedAt)}
          />
        </div>
      </div>

      {customer.archivedAt && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="font-medium">Archived customer</p>

          <p className="mt-1 text-sm text-muted-foreground">
            This customer was archived on{" "}
            {new Date(customer.archivedAt).toLocaleDateString()}.
          </p>
        </div>
      )}

      <CustomerHealth customer={customer} activities={activities} jobs={jobs} />

      <CustomerAiSummary customerId={customer.id} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact information</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {customer.email ? (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />

                <a href={`mailto:${customer.email}`} className="hover:underline">
                  {customer.email}
                </a>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No email address.</p>
            )}

            {customer.phone ? (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />

                <a href={`tel:${customer.phone}`} className="hover:underline">
                  {customer.phone}
                </a>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No phone number.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>

          <CardContent>
            <p className="whitespace-pre-wrap text-sm">
              {customer.notes || "No notes yet."}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <CardTitle>Jobs</CardTitle>

              <CardDescription className="mt-1">
                Jobs connected to this customer.
              </CardDescription>
            </div>

            {!customer.archivedAt && (
              <Button
                nativeButton={false}
                render={<Link href={`/jobs/new?customerId=${customer.id}`}>New job</Link>}
              />
            )}
          </div>
        </CardHeader>

        <CardContent>
          {jobs.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed">
              <div className="max-w-sm px-6 text-center">
                <BriefcaseBusiness className="mx-auto h-8 w-8 text-muted-foreground" />

                <p className="mt-3 font-medium">No jobs yet</p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Jobs created for this customer will appear here.
                </p>

                {!customer.archivedAt && (
                  <Button
                    className="mt-4"
                    nativeButton={false}
                    render={
                      <Link href={`/jobs/new?customerId=${customer.id}`}>Create job</Link>
                    }
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {jobs.map((job) => (
                <CustomerJobCard key={job.id} job={job} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <CardTitle>Estimates</CardTitle>

              <CardDescription className="mt-1">
                Quotes and pricing prepared for this customer across all jobs.
              </CardDescription>
            </div>

            {!customer.archivedAt && (
              <Button
                nativeButton={false}
                render={
                  <Link href={`/estimates/new?customerId=${customer.id}`}>
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
            <WorkspaceSummaryItem
              label="Total estimates"
              value={customerEstimates.length}
            />

            <WorkspaceSummaryItem label="Draft" value={draftEstimates.length} />

            <WorkspaceSummaryItem label="Sent / viewed" value={activeEstimates.length} />

            <WorkspaceSummaryItem
              label="Approved value"
              value={formatMoney(approvedEstimateValue)}
            />
          </div>

          {customerEstimates.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed">
              <div className="max-w-sm px-6 text-center">
                <FileText className="mx-auto h-8 w-8 text-muted-foreground" />

                <p className="mt-3 font-medium">No estimates yet</p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Estimates prepared for this customer will appear here.
                </p>

                {!customer.archivedAt && (
                  <Button
                    className="mt-4"
                    nativeButton={false}
                    render={
                      <Link href={`/estimates/new?customerId=${customer.id}`}>
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
              {customerEstimates.map((estimate) => (
                <CustomerEstimateRow key={estimate.id} estimate={estimate} />
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
                Billing, collections, and payment history for this customer.
              </CardDescription>
            </div>

            {!customer.archivedAt && (
              <Button
                nativeButton={false}
                render={
                  <Link href={`/invoices/new?customerId=${customer.id}`}>
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

            <WorkspaceSummaryItem label="Invoices" value={customerInvoices.length} />
          </div>

          {customerInvoices.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed">
              <div className="max-w-sm px-6 text-center">
                <ReceiptText className="mx-auto h-8 w-8 text-muted-foreground" />

                <p className="mt-3 font-medium">No invoices yet</p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Create an invoice for this customer or convert an approved estimate into
                  one.
                </p>

                {!customer.archivedAt && (
                  <Button
                    className="mt-4"
                    nativeButton={false}
                    render={
                      <Link href={`/invoices/new?customerId=${customer.id}`}>
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
                {customerInvoices.map((invoice) => (
                  <CustomerInvoiceRow key={invoice.id} invoice={invoice} />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <CardTitle>Internal notes & follow-ups</CardTitle>

              <CardDescription className="mt-1">
                Private team notes, assignments, and customer follow-up work.
              </CardDescription>
            </div>

            <p className="text-sm text-muted-foreground">
              {internalNotes.length} item
              {internalNotes.length === 1 ? "" : "s"}
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <CustomerInternalNotesWorkspace
            customerId={customer.id}
            notes={internalNotes}
            teamMembers={teamMembers}
            archived={Boolean(customer.archivedAt)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <CardTitle>Communication center</CardTitle>

              <CardDescription className="mt-1">
                Customer emails and automated delivery history in one place.
              </CardDescription>
            </div>

            <p className="text-sm text-muted-foreground">
              {communications.length} message
              {communications.length === 1 ? "" : "s"}
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {!customer.archivedAt && (
            <CustomerEmailComposer
              customerId={customer.id}
              customerEmail={customer.email}
            />
          )}

          <CustomerCommunicationCenter
            customerId={customer.id}
            communications={communications}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customer information</CardTitle>
        </CardHeader>

        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <InfoItem label="Status" value={customer.archivedAt ? "Archived" : "Active"} />

          <InfoItem
            label="Created"
            value={new Date(customer.createdAt).toLocaleDateString()}
          />

          <InfoItem
            label="Last updated"
            value={new Date(customer.updatedAt).toLocaleDateString()}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <CardTitle>Activity timeline</CardTitle>

              <p className="mt-1 text-sm text-muted-foreground">
                A complete history of customer activity.
              </p>
            </div>

            <p className="text-sm text-muted-foreground">
              {activities.length} event
              {activities.length === 1 ? "" : "s"}
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-8">
          <ActivitySummary activities={activities} />

          <CustomerActivityTimeline activities={activities} />
        </CardContent>
      </Card>
    </div>
  );
}

function CustomerEstimateRow({ estimate }: { estimate: Estimate }) {
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
          {estimate.job ? (
            <span className="flex items-center gap-1">
              <BriefcaseBusiness className="h-3.5 w-3.5" />

              {estimate.job.name}
            </span>
          ) : (
            <span>No job</span>
          )}

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

function CustomerInvoiceRow({ invoice }: { invoice: Invoice }) {
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
          {invoice.job ? (
            <span className="flex items-center gap-1">
              <BriefcaseBusiness className="h-3.5 w-3.5" />

              {invoice.job.name}
            </span>
          ) : (
            <span>No job</span>
          )}

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

function CustomerJobCard({ job }: { job: Job }) {
  const address = [job.addressLine1, job.city, job.province].filter(Boolean).join(", ");

  return (
    <Link
      href={`/jobs/${job.id}`}
      className={`group block rounded-xl border bg-card p-4 transition-all hover:border-primary/40 hover:bg-muted/30 hover:shadow-sm ${
        job.archivedAt ? "opacity-70" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold">{job.name}</p>

            <JobStatusBadge status={job.status} />

            {job.archivedAt && (
              <span className="rounded-full border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Archived
              </span>
            )}
          </div>

          {job.description && (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
              {job.description}
            </p>
          )}
        </div>

        <BriefcaseBusiness className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>

      <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
        {job.startDate && (
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0" />

            <span>{new Date(job.startDate).toLocaleDateString()}</span>
          </div>
        )}

        {address && (
          <div className="flex min-w-0 items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0" />

            <span className="truncate">{address}</span>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
        <span>{formatEnumLabel(job.priority)} priority</span>

        {job.budgetCents !== null && (
          <span className="font-medium text-foreground">
            {formatMoney(job.budgetCents)}
          </span>
        )}
      </div>
    </Link>
  );
}

function JobStatusBadge({ status }: { status: Job["status"] }) {
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
      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {formatEnumLabel(status)}
    </span>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>

      <p className="mt-1 font-medium">{value}</p>
    </div>
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
