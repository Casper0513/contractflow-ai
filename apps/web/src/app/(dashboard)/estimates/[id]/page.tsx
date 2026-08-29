import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getEstimate, type Estimate } from "@/lib/estimates-api";
import { ApiRequestError } from "@/lib/server-api";

import { EstimateAiIntelligence } from "./estimate-ai-intelligence";
import { EstimateActions } from "./estimate-actions";

type EstimatePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EstimatePage({ params }: EstimatePageProps) {
  const { id } = await params;

  let estimate: Estimate;

  try {
    estimate = await getEstimate(id);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) {
      notFound();
    }

    throw error;
  }

  const customerName = [estimate.customer.firstName, estimate.customer.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Button
        variant="ghost"
        nativeButton={false}
        render={
          <Link
            href={
              estimate.job
                ? `/jobs/${estimate.job.id}`
                : estimate.customer
                  ? `/customers/${estimate.customer.id}`
                  : "/estimates"
            }
          >
            <ArrowLeft className="h-4 w-4" />

            {estimate.job
              ? `Back to ${estimate.job.name}`
              : estimate.customer
                ? `Back to ${[estimate.customer.firstName, estimate.customer.lastName]
                    .filter(Boolean)
                    .join(" ")}`
                : "Back to estimates"}
          </Link>
        }
      />

      <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{estimate.number}</h1>

            <EstimateStatusBadge status={estimate.status} />
          </div>

          <p className="mt-2 text-lg text-muted-foreground">
            {estimate.title || "Untitled estimate"}
          </p>
        </div>

        <EstimateActions
          estimateId={estimate.id}
          status={estimate.status}
          job={
            estimate.job
              ? {
                  id: estimate.job.id,
                  name: estimate.job.name,
                }
              : null
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard
          icon={UserRound}
          label="Customer"
          value={
            estimate.customer.companyName
              ? `${customerName} — ${estimate.customer.companyName}`
              : customerName
          }
          href={`/customers/${estimate.customer.id}`}
        />

        <InfoCard
          icon={BriefcaseBusiness}
          label="Job"
          value={estimate.job?.name ?? "No job"}
          href={estimate.job ? `/jobs/${estimate.job.id}` : undefined}
        />

        <InfoCard
          icon={CalendarDays}
          label="Valid until"
          value={estimate.validUntil ? formatDate(estimate.validUntil) : "No expiry date"}
        />

        <InfoCard
          icon={CircleDollarSign}
          label="Estimate total"
          value={formatMoney(estimate.totalCents)}
        />
      </div>

      <EstimateAiIntelligence estimateId={estimate.id} status={estimate.status} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Line items</CardTitle>

              <CardDescription>
                Work, materials, and services included in this estimate.
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
                  {estimate.lineItems.map((item) => (
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
                          {formatMoney(item.unitPriceCents)}
                        </span>
                      </div>

                      <div className="md:text-right">
                        <span className="mb-1 block text-xs text-muted-foreground md:hidden">
                          Total
                        </span>

                        <span className="font-medium tabular-nums">
                          {formatMoney(item.lineTotalCents)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {(estimate.notes || estimate.terms) && (
            <div className="grid gap-6 lg:grid-cols-2">
              {estimate.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle>Notes</CardTitle>
                  </CardHeader>

                  <CardContent>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                      {estimate.notes}
                    </p>
                  </CardContent>
                </Card>
              )}

              {estimate.terms && (
                <Card>
                  <CardHeader>
                    <CardTitle>Terms</CardTitle>
                  </CardHeader>

                  <CardContent>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                      {estimate.terms}
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
              <MoneyRow label="Subtotal" cents={estimate.subtotalCents} />

              <MoneyRow label="Discount" cents={-estimate.discountCents} />

              <MoneyRow
                label={`Tax (${formatTaxRate(estimate.taxRate)})`}
                cents={estimate.taxCents}
              />

              <div className="border-t pt-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold">Total</span>

                  <span className="text-2xl font-bold tracking-tight tabular-nums">
                    {formatMoney(estimate.totalCents)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lifecycle</CardTitle>

              <CardDescription>Estimate status and important dates.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <TimelineRow label="Created" value={estimate.createdAt} />

              {estimate.sentAt && <TimelineRow label="Sent" value={estimate.sentAt} />}

              {estimate.viewedAt && (
                <TimelineRow label="Viewed" value={estimate.viewedAt} />
              )}

              {estimate.approvedAt && (
                <TimelineRow label="Approved" value={estimate.approvedAt} />
              )}

              {estimate.declinedAt && (
                <TimelineRow label="Declined" value={estimate.declinedAt} />
              )}

              {estimate.expiredAt && (
                <TimelineRow label="Expired" value={estimate.expiredAt} />
              )}

              <TimelineRow label="Last updated" value={estimate.updatedAt} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Estimate details</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4 text-sm">
              <DetailRow label="Estimate" value={estimate.number} />

              <DetailRow label="Status" value={formatEnumLabel(estimate.status)} />

              <DetailRow label="Items" value={estimate.lineItems.length.toString()} />

              {estimate.createdBy && (
                <DetailRow
                  label="Created by"
                  value={formatCreatedBy(estimate.createdBy)}
                />
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

function MoneyRow({ label, cents }: { label: string; cents: number }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>

      <span className="font-medium tabular-nums">{formatMoney(cents)}</span>
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
      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${styles[status]}`}
    >
      {formatEnumLabel(status)}
    </span>
  );
}

function formatCreatedBy(createdBy: Estimate["createdBy"]) {
  if (!createdBy) {
    return "Unknown";
  }

  const name = [createdBy.firstName, createdBy.lastName].filter(Boolean).join(" ");

  return name || createdBy.email;
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

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
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
