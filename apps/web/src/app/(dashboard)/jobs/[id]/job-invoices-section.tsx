import Link from "next/link";
import { Plus, ReceiptText, WalletCards } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Invoice } from "@/lib/invoices-api";

type JobInvoicesSectionProps = {
  jobId: string;
  customerId: string;
  archived: boolean;
  invoices: Invoice[];
};

export function JobInvoicesSection({
  jobId,
  customerId,
  archived,
  invoices,
}: JobInvoicesSectionProps) {
  const draftInvoices = invoices.filter((invoice) => invoice.status === "DRAFT");

  const outstandingInvoices = invoices.filter(
    (invoice) =>
      invoice.status === "SENT" ||
      invoice.status === "VIEWED" ||
      invoice.status === "PARTIALLY_PAID" ||
      invoice.status === "OVERDUE",
  );

  const paidInvoices = invoices.filter((invoice) => invoice.status === "PAID");

  const totalInvoicedCents = invoices
    .filter((invoice) => invoice.status !== "VOIDED")
    .reduce((total, invoice) => total + invoice.totalCents, 0);

  const totalPaidCents = invoices
    .filter((invoice) => invoice.status !== "VOIDED")
    .reduce((total, invoice) => total + invoice.amountPaidCents, 0);

  const totalBalanceDueCents = invoices
    .filter((invoice) => invoice.status !== "VOIDED")
    .reduce((total, invoice) => total + invoice.balanceDueCents, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <CardTitle>Invoices</CardTitle>

            <CardDescription className="mt-1">
              Billing, collections, and payment progress for this job.
            </CardDescription>
          </div>

          {!archived && (
            <Button
              size="sm"
              nativeButton={false}
              render={
                <Link href={`/invoices/new?customerId=${customerId}&jobId=${jobId}`}>
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

          <WorkspaceSummaryItem label="Invoices" value={invoices.length} />
        </div>

        {invoices.length === 0 ? (
          <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed">
            <div className="max-w-sm px-6 text-center">
              <ReceiptText className="mx-auto h-8 w-8 text-muted-foreground" />

              <p className="mt-3 font-medium">No invoices yet</p>

              <p className="mt-1 text-sm text-muted-foreground">
                Create an invoice for this job or convert an approved estimate into one.
              </p>

              {!archived && (
                <Button
                  className="mt-4"
                  size="sm"
                  nativeButton={false}
                  render={
                    <Link href={`/invoices/new?customerId=${customerId}&jobId=${jobId}`}>
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
              {invoices.map((invoice) => (
                <JobInvoiceRow key={invoice.id} invoice={invoice} />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
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
