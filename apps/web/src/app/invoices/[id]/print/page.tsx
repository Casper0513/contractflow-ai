import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BriefcaseBusiness, Building2, Mail, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getInvoice, type Invoice } from "@/lib/invoices-api";
import {
  getCurrentOrganization,
  type OrganizationProfile,
} from "@/lib/organizations-api";
import { ApiRequestError } from "@/lib/server-api";

import { PrintInvoiceButton } from "./print-invoice-button";

type InvoicePrintPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function InvoicePrintPage({ params }: InvoicePrintPageProps) {
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

  const organization = await getCurrentOrganization();

  const customerName = [invoice.customer.firstName, invoice.customer.lastName]
    .filter(Boolean)
    .join(" ");

  const recordedPayments = invoice.payments.filter(
    (payment) => payment.status === "RECORDED",
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 print:bg-white">
      <div className="mx-auto max-w-[8.5in] px-4 py-6 print:max-w-none print:p-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <Link href={`/invoices/${invoice.id}`}>
                <ArrowLeft className="h-4 w-4" />
                Back to invoice
              </Link>
            }
          />

          <PrintInvoiceButton invoiceId={invoice.id} status={invoice.status} />
        </div>

        <main className="overflow-hidden rounded-xl border bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
          <div className="p-8 sm:p-10 print:p-8">
            <InvoiceHeader organization={organization} invoice={invoice} />

            <div className="mt-10 grid gap-8 border-t pt-8 sm:grid-cols-2">
              <BillTo invoice={invoice} customerName={customerName} />

              <InvoiceDetails invoice={invoice} />
            </div>

            {invoice.job && (
              <div className="mt-8 rounded-lg border bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <BriefcaseBusiness className="h-4 w-4" />
                  Job
                </div>

                <p className="mt-1 font-medium">{invoice.job.name}</p>
              </div>
            )}

            <div className="mt-10 overflow-hidden rounded-lg border">
              <div className="grid grid-cols-[minmax(0,1fr)_90px_130px_130px] gap-4 bg-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <span>Description</span>

                <span className="text-right">Qty</span>

                <span className="text-right">Rate</span>

                <span className="text-right">Amount</span>
              </div>

              <div className="divide-y">
                {invoice.lineItems.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[minmax(0,1fr)_90px_130px_130px] gap-4 px-4 py-4 text-sm"
                  >
                    <span className="font-medium">{item.description}</span>

                    <span className="text-right tabular-nums">
                      {formatQuantity(item.quantity)}
                    </span>

                    <span className="text-right tabular-nums">
                      {formatMoney(item.unitPriceCents, invoice.currency)}
                    </span>

                    <span className="text-right font-medium tabular-nums">
                      {formatMoney(item.lineTotalCents, invoice.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 grid gap-8 sm:grid-cols-[minmax(0,1fr)_320px]">
              <div>
                {invoice.sourceEstimate && (
                  <div className="text-sm text-slate-600">
                    <p className="font-medium text-slate-950">Source estimate</p>

                    <p className="mt-1">{invoice.sourceEstimate.number}</p>
                  </div>
                )}
              </div>

              <InvoiceTotals invoice={invoice} />
            </div>

            {recordedPayments.length > 0 && (
              <div className="mt-10 border-t pt-8">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Payments received
                </h2>

                <div className="mt-4 divide-y rounded-lg border">
                  {recordedPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[1fr_auto]"
                    >
                      <div>
                        <p className="font-medium">{formatEnumLabel(payment.method)}</p>

                        <p className="mt-1 text-xs text-slate-500">
                          {formatDate(payment.receivedAt)}

                          {payment.reference ? ` · Ref: ${payment.reference}` : ""}
                        </p>
                      </div>

                      <p className="font-semibold tabular-nums">
                        {formatMoney(payment.amountCents, invoice.currency)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(invoice.notes || invoice.terms) && (
              <div className="mt-10 grid gap-8 border-t pt-8 sm:grid-cols-2">
                {invoice.notes && <DocumentSection title="Notes" value={invoice.notes} />}

                {invoice.terms && <DocumentSection title="Terms" value={invoice.terms} />}
              </div>
            )}

            <div className="mt-12 border-t pt-6 text-center text-xs text-slate-500">
              <p>{organization.name}</p>

              {organization.website && <p className="mt-1">{organization.website}</p>}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function InvoiceHeader({
  organization,
  invoice,
}: {
  organization: OrganizationProfile;
  invoice: Invoice;
}) {
  const businessAddress = [
    organization.addressLine1,
    organization.addressLine2,
    [organization.city, organization.province, organization.postalCode]
      .filter(Boolean)
      .join(", "),
    organization.country,
  ].filter(Boolean);

  return (
    <div className="flex flex-col justify-between gap-8 sm:flex-row">
      <div className="min-w-0">
        {organization.logoUrl && (
          <div
            aria-label={`${organization.name} logo`}
            className="mb-5 h-16 w-48 bg-contain bg-left bg-no-repeat"
            style={{
              backgroundImage: `url("${organization.logoUrl}")`,
            }}
          />
        )}

        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-slate-500" />

          <h1 className="text-xl font-bold">{organization.name}</h1>
        </div>

        {organization.legalName && organization.legalName !== organization.name && (
          <p className="mt-1 text-sm text-slate-500">{organization.legalName}</p>
        )}

        {businessAddress.length > 0 && (
          <div className="mt-3 space-y-1 text-sm text-slate-600">
            {businessAddress.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        )}

        <div className="mt-4 space-y-1 text-sm text-slate-600">
          {organization.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5" />
              {organization.email}
            </div>
          )}

          {organization.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5" />
              {organization.phone}
            </div>
          )}

          {organization.taxNumber && <p>Tax number: {organization.taxNumber}</p>}
        </div>
      </div>

      <div className="shrink-0 sm:text-right">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          Invoice
        </p>

        <p className="mt-2 text-3xl font-bold tracking-tight">{invoice.number}</p>

        <div className="mt-3">
          <InvoiceStatus status={invoice.status} />
        </div>
      </div>
    </div>
  );
}

function BillTo({ invoice, customerName }: { invoice: Invoice; customerName: string }) {
  return (
    <section>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Bill to
      </p>

      <div className="mt-3">
        {invoice.customer.companyName && (
          <p className="font-semibold">{invoice.customer.companyName}</p>
        )}

        <p className={invoice.customer.companyName ? "mt-1" : "font-semibold"}>
          {customerName}
        </p>

        {invoice.customer.email && (
          <p className="mt-2 text-sm text-slate-600">{invoice.customer.email}</p>
        )}

        {invoice.customer.phone && (
          <p className="mt-1 text-sm text-slate-600">{invoice.customer.phone}</p>
        )}
      </div>
    </section>
  );
}

function InvoiceDetails({ invoice }: { invoice: Invoice }) {
  return (
    <section className="sm:text-right">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Invoice details
      </p>

      <dl className="mt-3 space-y-2 text-sm">
        <DocumentDetail label="Invoice" value={invoice.number} />

        <DocumentDetail label="Issue date" value={formatDate(invoice.issueDate)} />

        <DocumentDetail
          label="Due date"
          value={invoice.dueDate ? formatDate(invoice.dueDate) : "No due date"}
        />

        <DocumentDetail label="Currency" value={invoice.currency} />
      </dl>
    </section>
  );
}

function DocumentDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6 sm:justify-end">
      <dt className="text-slate-500">{label}</dt>

      <dd className="min-w-28 font-medium">{value}</dd>
    </div>
  );
}

function InvoiceTotals({ invoice }: { invoice: Invoice }) {
  return (
    <div className="space-y-3 text-sm">
      <TotalRow
        label="Subtotal"
        value={formatMoney(invoice.subtotalCents, invoice.currency)}
      />

      {invoice.discountCents > 0 && (
        <TotalRow
          label="Discount"
          value={`-${formatMoney(invoice.discountCents, invoice.currency)}`}
        />
      )}

      <TotalRow
        label={`Tax (${formatTaxRate(invoice.taxRate)})`}
        value={formatMoney(invoice.taxCents, invoice.currency)}
      />

      <div className="border-t pt-3">
        <TotalRow
          label="Total"
          value={formatMoney(invoice.totalCents, invoice.currency)}
          strong
        />
      </div>

      {invoice.amountPaidCents > 0 && (
        <TotalRow
          label="Payments"
          value={`-${formatMoney(invoice.amountPaidCents, invoice.currency)}`}
        />
      )}

      <div className="border-t pt-4">
        <div className="flex items-center justify-between gap-8">
          <span className="text-base font-bold">Balance due</span>

          <span className="text-2xl font-bold tracking-tight tabular-nums">
            {formatMoney(invoice.balanceDueCents, invoice.currency)}
          </span>
        </div>
      </div>
    </div>
  );
}

function TotalRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-8">
      <span className={strong ? "font-semibold" : "text-slate-600"}>{label}</span>

      <span
        className={
          strong ? "text-base font-bold tabular-nums" : "font-medium tabular-nums"
        }
      >
        {value}
      </span>
    </div>
  );
}

function DocumentSection({ title, value }: { title: string; value: string }) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{value}</p>
    </section>
  );
}

function InvoiceStatus({ status }: { status: Invoice["status"] }) {
  const styles: Record<Invoice["status"], string> = {
    DRAFT: "border-slate-300 bg-slate-100 text-slate-700",

    SENT: "border-blue-300 bg-blue-50 text-blue-700",

    VIEWED: "border-indigo-300 bg-indigo-50 text-indigo-700",

    PARTIALLY_PAID: "border-amber-300 bg-amber-50 text-amber-800",

    PAID: "border-green-300 bg-green-50 text-green-700",

    OVERDUE: "border-red-300 bg-red-50 text-red-700",

    VOIDED: "border-zinc-300 bg-zinc-100 text-zinc-600",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {formatEnumLabel(status)}
    </span>
  );
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

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
