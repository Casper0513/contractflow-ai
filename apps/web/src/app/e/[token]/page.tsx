import {
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleX,
  ClipboardCheck,
  Mail,
  Phone,
  ReceiptText,
} from "lucide-react";
import { notFound } from "next/navigation";

import { getPublicEstimate, type PublicEstimate } from "@/lib/public-estimates-api";

import { EstimateDecisionButtons } from "./estimate-decision-buttons";

type PublicEstimatePageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function PublicEstimatePage({ params }: PublicEstimatePageProps) {
  const { token } = await params;

  const estimate = await getPublicEstimate(token);

  if (!estimate) {
    notFound();
  }

  const organization = estimate.organization;

  const currency = organization.currency;

  const customerName = [estimate.customer.firstName, estimate.customer.lastName]
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

  const canDecide = estimate.status === "SENT" || estimate.status === "VIEWED";

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
                  Estimate
                </p>

                <p className="mt-2 text-3xl font-bold tracking-tight">
                  {estimate.number}
                </p>

                <div className="mt-3">
                  <StatusBadge status={estimate.status} />
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            {estimate.status === "APPROVED" && (
              <div className="mb-8 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-green-800">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />

                <div>
                  <p className="font-semibold">Estimate approved</p>

                  <p className="mt-1 text-sm">
                    Thank you. This estimate has been approved.
                  </p>
                </div>
              </div>
            )}

            {estimate.status === "DECLINED" && (
              <div className="mb-8 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
                <CircleX className="mt-0.5 h-5 w-5 shrink-0" />

                <div>
                  <p className="font-semibold">Estimate declined</p>

                  <p className="mt-1 text-sm">This estimate has been declined.</p>
                </div>
              </div>
            )}

            {estimate.status === "EXPIRED" && (
              <div className="mb-8 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
                <CalendarDays className="mt-0.5 h-5 w-5 shrink-0" />

                <div>
                  <p className="font-semibold">Estimate expired</p>

                  <p className="mt-1 text-sm">
                    This estimate is no longer available for approval.
                  </p>
                </div>
              </div>
            )}

            <div className="grid gap-8 sm:grid-cols-2">
              <section>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Prepared for
                </p>

                <div className="mt-3">
                  {estimate.customer.companyName && (
                    <p className="font-semibold">{estimate.customer.companyName}</p>
                  )}

                  <p className={estimate.customer.companyName ? "mt-1" : "font-semibold"}>
                    {customerName}
                  </p>

                  {estimate.customer.email && (
                    <p className="mt-2 text-sm text-slate-600">
                      {estimate.customer.email}
                    </p>
                  )}

                  {estimate.customer.phone && (
                    <p className="mt-1 text-sm text-slate-600">
                      {estimate.customer.phone}
                    </p>
                  )}
                </div>
              </section>

              <section className="sm:text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Estimate details
                </p>

                <dl className="mt-3 space-y-2 text-sm">
                  <DetailRow
                    label="Valid until"
                    value={
                      estimate.validUntil
                        ? formatDate(estimate.validUntil)
                        : "No expiry date"
                    }
                  />

                  <DetailRow label="Currency" value={currency} />

                  {estimate.job && <DetailRow label="Job" value={estimate.job.name} />}
                </dl>
              </section>
            </div>

            {estimate.title && (
              <div className="mt-8 rounded-xl border bg-slate-50 px-4 py-3">
                <p className="text-sm font-medium">{estimate.title}</p>
              </div>
            )}

            <div className="mt-8 overflow-x-auto rounded-xl border">
              <div className="min-w-[640px]">
                <div className="grid grid-cols-[minmax(0,1fr)_70px_110px_120px] gap-3 bg-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <span>Description</span>

                  <span className="text-right">Qty</span>

                  <span className="text-right">Rate</span>

                  <span className="text-right">Amount</span>
                </div>

                <div className="divide-y">
                  {estimate.lineItems.map((item, index) => (
                    <div
                      key={`${item.position}-${index}`}
                      className="grid grid-cols-[minmax(0,1fr)_70px_110px_120px] gap-3 px-4 py-4 text-sm"
                    >
                      <span className="font-medium">{item.description}</span>

                      <span className="text-right tabular-nums">
                        {formatQuantity(item.quantity)}
                      </span>

                      <span className="text-right tabular-nums">
                        {formatMoney(item.unitPriceCents, currency)}
                      </span>

                      <span className="text-right font-medium tabular-nums">
                        {formatMoney(item.lineTotalCents, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-8 sm:grid-cols-[minmax(0,1fr)_320px]">
              <div />

              <div className="space-y-3 text-sm">
                <TotalRow
                  label="Subtotal"
                  value={formatMoney(estimate.subtotalCents, currency)}
                />

                {estimate.discountCents > 0 && (
                  <TotalRow
                    label="Discount"
                    value={`-${formatMoney(estimate.discountCents, currency)}`}
                  />
                )}

                <TotalRow
                  label={`Tax (${formatTaxRate(estimate.taxRate)})`}
                  value={formatMoney(estimate.taxCents, currency)}
                />

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between gap-8">
                    <span className="text-base font-bold">Estimate total</span>

                    <span className="text-2xl font-bold tracking-tight tabular-nums">
                      {formatMoney(estimate.totalCents, currency)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {canDecide && (
              <div className="mt-10 rounded-xl border bg-slate-50 p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />

                  <div className="flex-1">
                    <h2 className="font-semibold">Respond to this estimate</h2>

                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Review the estimate above, then approve or decline it below.
                    </p>

                    <div className="mt-5">
                      <EstimateDecisionButtons token={token} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {(estimate.notes || estimate.terms) && (
              <div className="mt-10 grid gap-8 border-t pt-8 sm:grid-cols-2">
                {estimate.notes && <TextSection title="Notes" value={estimate.notes} />}

                {estimate.terms && <TextSection title="Terms" value={estimate.terms} />}
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

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-8">
      <span className="text-slate-600">{label}</span>

      <span className="font-medium tabular-nums">{value}</span>
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

function StatusBadge({ status }: { status: PublicEstimate["status"] }) {
  const styles: Record<PublicEstimate["status"], string> = {
    SENT: "border-blue-300 bg-blue-50 text-blue-700",

    VIEWED: "border-indigo-300 bg-indigo-50 text-indigo-700",

    APPROVED: "border-green-300 bg-green-50 text-green-700",

    DECLINED: "border-red-300 bg-red-50 text-red-700",

    EXPIRED: "border-amber-300 bg-amber-50 text-amber-800",
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
