import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
  FileText,
  Printer,
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
import { getInvoice, type Invoice } from "@/lib/invoices-api";
import { getInvoiceReminderSettings } from "@/lib/organizations-api";
import { ApiRequestError } from "@/lib/server-api";

import { InvoiceFollowUpCard } from "./invoice-follow-up-card";
import { InvoiceAiIntelligence } from "./invoice-ai-intelligence";
import { InvoiceActions } from "./invoice-actions";
import { RecordPaymentForm } from "./record-payment-form";
import { PaymentActions } from "./payment-actions";

type InvoicePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function InvoicePage({ params }: InvoicePageProps) {
  const { id } = await params;

  let invoice: Invoice;

  try {
    invoice = await getInvoice(id);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) {
      notFound();
    }

    throw error;
  }

  const invoiceReminderSettings = await getInvoiceReminderSettings();

  const customerName = [invoice.customer.firstName, invoice.customer.lastName]
    .filter(Boolean)
    .join(" ");

  const backHref = invoice.job
    ? `/jobs/${invoice.job.id}`
    : invoice.customer
      ? `/customers/${invoice.customer.id}`
      : "/invoices";

  const backLabel = invoice.job
    ? `Back to ${invoice.job.name}`
    : invoice.customer
      ? `Back to ${customerName}`
      : "Back to invoices";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Button
        variant="ghost"
        nativeButton={false}
        render={
          <Link href={backHref}>
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
        }
      />

      <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{invoice.number}</h1>

            <InvoiceStatusBadge status={invoice.status} />
          </div>

          <p className="mt-2 text-lg text-muted-foreground">
            {invoice.title || "Untitled invoice"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <Link href={`/invoices/${invoice.id}/print`} target="_blank">
                <Printer className="h-4 w-4" />
                Print / Preview
              </Link>
            }
          />

          <InvoiceActions
            invoiceId={invoice.id}
            status={invoice.status}
            amountPaidCents={invoice.amountPaidCents}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard
          icon={UserRound}
          label="Customer"
          value={
            invoice.customer.companyName
              ? `${customerName} — ${invoice.customer.companyName}`
              : customerName
          }
          href={`/customers/${invoice.customer.id}`}
        />

        <InfoCard
          icon={BriefcaseBusiness}
          label="Job"
          value={invoice.job?.name ?? "No job"}
          href={invoice.job ? `/jobs/${invoice.job.id}` : undefined}
        />

        <InfoCard
          icon={FileText}
          label="Source estimate"
          value={invoice.sourceEstimate?.number ?? "No source estimate"}
          href={
            invoice.sourceEstimate ? `/estimates/${invoice.sourceEstimate.id}` : undefined
          }
        />

        <InfoCard
          icon={CalendarDays}
          label="Due date"
          value={invoice.dueDate ? formatDate(invoice.dueDate) : "No due date"}
        />
      </div>

      <InvoiceFollowUpCard invoice={invoice} settings={invoiceReminderSettings} />

      <InvoiceAiIntelligence invoiceId={invoice.id} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Line items</CardTitle>

              <CardDescription>
                Work, materials, and services included in this invoice.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="overflow-hidden rounded-xl border">
                <div className="hidden grid-cols-[minmax(0,1fr)_110px_150px_150px] gap-4 border-b bg-muted/30 px-4 py-3 text-xs font-medium text-muted-foreground md:grid">
                  <span>Description</span>
                  <span>Quantity</span>

                  <span className="text-right">Unit price</span>

                  <span className="text-right">Total</span>
                </div>

                <div className="divide-y">
                  {invoice.lineItems.map((item) => (
                    <div
                      key={item.id}
                      className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_110px_150px_150px] md:items-center"
                    >
                      <div>
                        <span className="mb-1 block text-xs text-muted-foreground md:hidden">
                          Description
                        </span>

                        <p className="font-medium">{item.description}</p>
                      </div>

                      <div>
                        <span className="mb-1 block text-xs text-muted-foreground md:hidden">
                          Quantity
                        </span>

                        <span className="tabular-nums">
                          {formatQuantity(item.quantity)}
                        </span>
                      </div>

                      <div className="md:text-right">
                        <span className="mb-1 block text-xs text-muted-foreground md:hidden">
                          Unit price
                        </span>

                        <span className="tabular-nums">
                          {formatMoney(item.unitPriceCents, invoice.currency)}
                        </span>
                      </div>

                      <div className="md:text-right">
                        <span className="mb-1 block text-xs text-muted-foreground md:hidden">
                          Total
                        </span>

                        <span className="font-medium tabular-nums">
                          {formatMoney(item.lineTotalCents, invoice.currency)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment history</CardTitle>

              <CardDescription>Payments recorded against this invoice.</CardDescription>
            </CardHeader>

            <CardContent>
              {invoice.payments.length === 0 ? (
                <div className="flex min-h-36 items-center justify-center rounded-xl border border-dashed">
                  <div className="px-6 text-center">
                    <WalletCards className="mx-auto h-8 w-8 text-muted-foreground" />

                    <p className="mt-3 font-medium">No payments recorded</p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Payments will appear here once they are recorded.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y rounded-xl border">
                  {invoice.payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex flex-col justify-between gap-3 px-4 py-4 sm:flex-row sm:items-center"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">
                            {formatMoney(payment.amountCents, invoice.currency)}
                          </p>

                          <PaymentStatusBadge status={payment.status} />
                        </div>

                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatEnumLabel(payment.method)}
                          {" · "}
                          {formatDateTime(payment.receivedAt)}
                        </p>

                        {payment.reference && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Reference: {payment.reference}
                          </p>
                        )}

                        {payment.notes && (
                          <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                            {payment.notes}
                          </p>
                        )}
                      </div>

                      <div className="space-y-3 sm:text-right">
                        {payment.recordedBy && (
                          <div className="text-sm text-muted-foreground">
                            <p>Recorded by</p>

                            <p className="font-medium text-foreground">
                              {formatPerson(payment.recordedBy)}
                            </p>
                          </div>
                        )}

                        {payment.status === "RECORDED" && (
                          <PaymentActions invoiceId={invoice.id} paymentId={payment.id} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {(invoice.notes || invoice.terms) && (
            <div className="grid gap-6 lg:grid-cols-2">
              {invoice.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle>Notes</CardTitle>
                  </CardHeader>

                  <CardContent>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                      {invoice.notes}
                    </p>
                  </CardContent>
                </Card>
              )}

              {invoice.terms && (
                <Card>
                  <CardHeader>
                    <CardTitle>Terms</CardTitle>
                  </CardHeader>

                  <CardContent>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                      {invoice.terms}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Financial summary</CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              <MoneyRow
                label="Subtotal"
                cents={invoice.subtotalCents}
                currency={invoice.currency}
              />

              <MoneyRow
                label="Discount"
                cents={-invoice.discountCents}
                currency={invoice.currency}
              />

              <MoneyRow
                label={`Tax (${formatTaxRate(invoice.taxRate)})`}
                cents={invoice.taxCents}
                currency={invoice.currency}
              />

              <div className="border-t pt-3">
                <MoneyRow
                  label="Total"
                  cents={invoice.totalCents}
                  currency={invoice.currency}
                  strong
                />
              </div>

              <div className="mt-4 space-y-3 border-t pt-4">
                <MoneyRow
                  label="Paid"
                  cents={invoice.amountPaidCents}
                  currency={invoice.currency}
                />

                <div className="flex items-center justify-between gap-4 rounded-lg bg-muted/50 px-4 py-3">
                  <span className="font-semibold">Balance due</span>

                  <span className="text-xl font-bold tracking-tight tabular-nums">
                    {formatMoney(invoice.balanceDueCents, invoice.currency)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {invoice.balanceDueCents > 0 &&
            invoice.status !== "DRAFT" &&
            invoice.status !== "PAID" &&
            invoice.status !== "VOIDED" && (
              <Card>
                <CardHeader>
                  <CardTitle>Payment</CardTitle>

                  <CardDescription>
                    Record a payment received from the customer.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <RecordPaymentForm
                    key={`${invoice.id}-${invoice.balanceDueCents}`}
                    invoiceId={invoice.id}
                    status={invoice.status}
                    balanceDueCents={invoice.balanceDueCents}
                    currency={invoice.currency}
                  />
                </CardContent>
              </Card>
            )}

          <Card>
            <CardHeader>
              <CardTitle>Lifecycle</CardTitle>

              <CardDescription>Invoice status and important dates.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <TimelineRow label="Created" value={invoice.createdAt} />

              <TimelineRow label="Issued" value={invoice.issueDate} />

              {invoice.sentAt && <TimelineRow label="Sent" value={invoice.sentAt} />}

              {invoice.viewedAt && (
                <TimelineRow label="Viewed" value={invoice.viewedAt} />
              )}

              {invoice.overdueAt && (
                <TimelineRow label="Overdue" value={invoice.overdueAt} />
              )}

              {invoice.paidAt && <TimelineRow label="Paid" value={invoice.paidAt} />}

              {invoice.voidedAt && (
                <TimelineRow label="Voided" value={invoice.voidedAt} />
              )}

              <TimelineRow label="Last updated" value={invoice.updatedAt} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invoice details</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4 text-sm">
              <DetailRow label="Invoice" value={invoice.number} />

              <DetailRow label="Status" value={formatEnumLabel(invoice.status)} />

              <DetailRow label="Currency" value={invoice.currency} />

              <DetailRow label="Items" value={invoice.lineItems.length.toString()} />

              <DetailRow label="Payments" value={invoice.payments.length.toString()} />

              {invoice.sourceEstimate && (
                <DetailLink
                  label="Estimate"
                  value={invoice.sourceEstimate.number}
                  href={`/estimates/${invoice.sourceEstimate.id}`}
                />
              )}

              {invoice.createdBy && (
                <DetailRow label="Created by" value={formatPerson(invoice.createdBy)} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>

      <p className="mt-2 truncate font-semibold">{value}</p>
    </>
  );

  return (
    <Card>
      <CardContent className="p-5">
        {href ? (
          <Link
            href={href}
            className="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {content}
          </Link>
        ) : (
          content
        )}
      </CardContent>
    </Card>
  );
}

function MoneyRow({
  label,
  cents,
  currency,
  strong = false,
}: {
  label: string;
  cents: number;
  currency: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className={strong ? "font-semibold" : "text-muted-foreground"}>{label}</span>

      <span
        className={strong ? "text-lg font-bold tabular-nums" : "font-medium tabular-nums"}
      >
        {formatMoney(cents, currency)}
      </span>
    </div>
  );
}

function TimelineRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5">
        <Clock3 className="h-4 w-4 text-muted-foreground" />
      </div>

      <div>
        <p className="text-sm font-medium">{label}</p>

        <p className="text-xs text-muted-foreground">{formatDateTime(value)}</p>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>

      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function DetailLink({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>

      <Link
        href={href}
        className="text-right font-medium underline-offset-4 hover:underline"
      >
        {value}
      </Link>
    </div>
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
      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${styles[status]}`}
    >
      {formatEnumLabel(status)}
    </span>
  );
}

function PaymentStatusBadge({
  status,
}: {
  status: Invoice["payments"][number]["status"];
}) {
  const styles: Record<Invoice["payments"][number]["status"], string> = {
    RECORDED: "border-green-500/30 bg-green-500/10 text-green-700",

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

function formatPerson(person: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}) {
  const name = [person.firstName, person.lastName].filter(Boolean).join(" ");

  return name || person.email;
}

function formatQuantity(value: string) {
  const quantity = Number(value);

  if (!Number.isFinite(quantity)) {
    return value;
  }

  return new Intl.NumberFormat("en-CA", {
    maximumFractionDigits: 4,
  }).format(quantity);
}

function formatTaxRate(value: string) {
  const rate = Number(value);

  if (!Number.isFinite(rate)) {
    return value;
  }

  return new Intl.NumberFormat("en-CA", {
    style: "percent",
    maximumFractionDigits: 4,
  }).format(rate);
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
