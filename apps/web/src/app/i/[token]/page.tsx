import { notFound } from "next/navigation";
import {
  BadgeDollarSign,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleX,
  Download,
  Mail,
  Phone,
  ReceiptText,
} from "lucide-react";

import { getPublicInvoice, type PublicInvoice } from "@/lib/public-invoices-api";
import { PayInvoiceButton } from "./pay-invoice-button";

type PublicInvoicePageProps = {
  params: Promise<{
    token: string;
  }>;
  searchParams: Promise<{
    payment?: string;
  }>;
};

export default async function PublicInvoicePage({
  params,
  searchParams,
}: PublicInvoicePageProps) {
  const [{ token }, { payment }] = await Promise.all([params, searchParams]);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!apiUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }

  const publicPdfUrl = `${apiUrl}/public/invoices/${encodeURIComponent(token)}/pdf`;

  const invoice = await getPublicInvoice(token);

  if (!invoice) {
    notFound();
  }

  const organization = invoice.organization;

  const paymentSucceeded = payment === "success";
  const paymentCancelled = payment === "cancelled";
  const invoicePaid = invoice.status === "PAID" || invoice.balanceDueCents <= 0;

  const customerName = [invoice.customer.firstName, invoice.customer.lastName]
    .filter(Boolean)
    .join(" ");

  const businessAddress = [
    organization.addressLine1,
    organization.addressLine2,
    [organization.city, organization.province, organization.postalCode]
      .filter(Boolean)
      .join(", "),
    organization.country,
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950">
      <div className="mx-auto max-w-5xl">
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-8 sm:flex-row">
              <div>
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

                {organization.legalName &&
                  organization.legalName !== organization.name && (
                    <p className="mt-1 text-sm text-slate-500">
                      {organization.legalName}
                    </p>
                  )}

                {businessAddress.length > 0 && (
                  <div className="mt-4 space-y-1 text-sm text-slate-600">
                    {businessAddress.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                )}

                <div className="mt-4 space-y-1 text-sm text-slate-600">
                  {organization.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {organization.email}
                    </div>
                  )}

                  {organization.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {organization.phone}
                    </div>
                  )}

                  {organization.taxNumber && <p>Tax number: {organization.taxNumber}</p>}
                </div>
              </div>

              <div className="sm:text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Invoice
                </p>

                <p className="mt-2 text-3xl font-bold tracking-tight">{invoice.number}</p>

                <div className="mt-3">
                  <StatusBadge status={invoice.status} />
                </div>

                <div className="mt-5 flex sm:justify-end">
                  <a
                    href={publicPdfUrl}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                  >
                    <Download className="h-4 w-4" />
                    Download PDF
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            {paymentSucceeded && invoicePaid && (
              <div className="mb-8 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-green-800">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />

                <div>
                  <p className="font-semibold">Payment successful</p>

                  <p className="mt-1 text-sm">
                    Thank you. Your payment has been received and this invoice is paid in
                    full.
                  </p>
                </div>
              </div>
            )}

            {paymentSucceeded && !invoicePaid && (
              <div className="mb-8 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-800">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />

                <div>
                  <p className="font-semibold">Payment submitted</p>

                  <p className="mt-1 text-sm">
                    Stripe accepted the payment. ContractFlow is waiting for the verified
                    payment confirmation before updating this invoice.
                  </p>
                </div>
              </div>
            )}

            {paymentCancelled && !invoicePaid && (
              <div className="mb-8 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
                <CircleX className="mt-0.5 h-5 w-5 shrink-0" />

                <div>
                  <p className="font-semibold">Payment cancelled</p>

                  <p className="mt-1 text-sm">
                    No payment was recorded. You can return to checkout whenever you are
                    ready.
                  </p>
                </div>
              </div>
            )}

            <div className="grid gap-8 sm:grid-cols-2">
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
                    <p className="mt-2 text-sm text-slate-600">
                      {invoice.customer.email}
                    </p>
                  )}

                  {invoice.customer.phone && (
                    <p className="mt-1 text-sm text-slate-600">
                      {invoice.customer.phone}
                    </p>
                  )}
                </div>
              </section>

              <section className="sm:text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Invoice details
                </p>

                <dl className="mt-3 space-y-2 text-sm">
                  <DetailRow label="Issue date" value={formatDate(invoice.issueDate)} />

                  <DetailRow
                    label="Due date"
                    value={invoice.dueDate ? formatDate(invoice.dueDate) : "No due date"}
                  />

                  <DetailRow label="Currency" value={invoice.currency} />

                  {invoice.job && <DetailRow label="Job" value={invoice.job.name} />}
                </dl>
              </section>
            </div>

            {invoice.title && (
              <div className="mt-8 rounded-xl border bg-slate-50 px-4 py-3">
                <p className="text-sm font-medium">{invoice.title}</p>
              </div>
            )}

            <div className="mt-8 overflow-hidden rounded-xl border">
              <div className="grid grid-cols-[minmax(0,1fr)_70px_110px_120px] gap-3 bg-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <span>Description</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Rate</span>
                <span className="text-right">Amount</span>
              </div>

              <div className="divide-y">
                {invoice.lineItems.map((item, index) => (
                  <div
                    key={`${item.position}-${index}`}
                    className="grid grid-cols-[minmax(0,1fr)_70px_110px_120px] gap-3 px-4 py-4 text-sm"
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

                {invoice.balanceDueCents > 0 && invoice.status !== "VOIDED" && (
                  <div className="pt-2 sm:flex sm:justify-end">
                    <PayInvoiceButton
                      token={token}
                      balanceDueCents={invoice.balanceDueCents}
                      currency={invoice.currency}
                    />
                  </div>
                )}
              </div>
            </div>

            {invoice.payments.length > 0 && (
              <div className="mt-10 border-t pt-8">
                <div className="flex items-center gap-2">
                  <BadgeDollarSign className="h-4 w-4 text-slate-500" />

                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Payments received
                  </h2>
                </div>

                <div className="mt-4 divide-y rounded-xl border">
                  {invoice.payments.map((payment, index) => (
                    <div
                      key={`${payment.receivedAt}-${index}`}
                      className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                    >
                      <div>
                        <p className="font-medium">{formatEnumLabel(payment.method)}</p>

                        <p className="mt-1 text-xs text-slate-500">
                          {formatDate(payment.receivedAt)}
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
                {invoice.notes && <TextSection title="Notes" value={invoice.notes} />}

                {invoice.terms && <TextSection title="Terms" value={invoice.terms} />}
              </div>
            )}

            {invoice.status === "PAID" && (
              <div className="mt-10 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-green-800">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />

                <div>
                  <p className="font-semibold">Invoice paid</p>

                  <p className="mt-1 text-sm">This invoice has been paid in full.</p>
                </div>
              </div>
            )}

            {invoice.status === "OVERDUE" && (
              <div className="mt-10 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
                <CalendarDays className="mt-0.5 h-5 w-5 shrink-0" />

                <div>
                  <p className="font-semibold">Payment overdue</p>

                  <p className="mt-1 text-sm">
                    This invoice has an outstanding overdue balance.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-12 border-t pt-6 text-center text-xs text-slate-500">
              <div className="flex items-center justify-center gap-2">
                <ReceiptText className="h-4 w-4" />

                <span>{organization.name}</span>
              </div>

              {organization.website && <p className="mt-1">{organization.website}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6 sm:justify-end">
      <dt className="text-slate-500">{label}</dt>

      <dd className="min-w-28 font-medium">{value}</dd>
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

function TextSection({ title, value }: { title: string; value: string }) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{value}</p>
    </section>
  );
}

function StatusBadge({ status }: { status: PublicInvoice["status"] }) {
  const styles: Record<PublicInvoice["status"], string> = {
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
