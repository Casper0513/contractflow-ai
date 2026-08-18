import Link from "next/link";
import {
  BadgeDollarSign,
  BriefcaseBusiness,
  CalendarDays,
  FileText,
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
import { getEstimates, type Estimate } from "@/lib/estimates-api";

export default async function EstimatesPage() {
  const estimates = await getEstimates();

  const drafts = estimates.filter((estimate) => estimate.status === "DRAFT");

  const active = estimates.filter(
    (estimate) => estimate.status === "SENT" || estimate.status === "VIEWED",
  );

  const approved = estimates.filter((estimate) => estimate.status === "APPROVED");

  const closed = estimates.filter(
    (estimate) => estimate.status === "DECLINED" || estimate.status === "EXPIRED",
  );

  const approvedValue = approved.reduce(
    (total, estimate) => total + estimate.totalCents,
    0,
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Estimates</h1>

          <p className="mt-1 text-muted-foreground">
            Create, send, track, and manage customer estimates.
          </p>
        </div>

        <Button
          nativeButton={false}
          render={<Link href="/estimates/new">New estimate</Link>}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Drafts" value={drafts.length.toString()} icon={FileText} />

        <SummaryCard
          label="Sent / viewed"
          value={active.length.toString()}
          icon={CalendarDays}
        />

        <SummaryCard
          label="Approved"
          value={approved.length.toString()}
          icon={BadgeDollarSign}
        />

        <SummaryCard label="Closed" value={closed.length.toString()} icon={FileText} />

        <SummaryCard
          label="Approved value"
          value={formatMoney(approvedValue)}
          icon={BadgeDollarSign}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estimate directory</CardTitle>

          <CardDescription>Browse estimates across customers and jobs.</CardDescription>
        </CardHeader>

        <CardContent>
          {estimates.length === 0 ? (
            <EmptyEstimates />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {estimates.map((estimate) => (
                <EstimateCard key={estimate.id} estimate={estimate} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EstimateCard({ estimate }: { estimate: Estimate }) {
  const customerName = [estimate.customer.firstName, estimate.customer.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <Link
      href={`/estimates/${estimate.id}`}
      className="group block rounded-xl border bg-card p-5 transition-all hover:border-primary/40 hover:bg-muted/30 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{estimate.number}</h2>

            <EstimateStatusBadge status={estimate.status} />
          </div>

          <p className="mt-1 truncate text-sm text-muted-foreground">
            {estimate.title || "Untitled estimate"}
          </p>
        </div>

        <FileText className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>

      <div className="mt-5 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
        <div className="flex min-w-0 items-center gap-2">
          <UserRound className="h-4 w-4 shrink-0" />

          <span className="truncate">{customerName}</span>
        </div>

        {estimate.job && (
          <div className="flex min-w-0 items-center gap-2">
            <BriefcaseBusiness className="h-4 w-4 shrink-0" />

            <span className="truncate">{estimate.job.name}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0" />

          <span>
            {estimate.validUntil
              ? `Valid until ${new Date(estimate.validUntil).toLocaleDateString()}`
              : "No expiry date"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <BadgeDollarSign className="h-4 w-4 shrink-0" />

          <span className="font-medium text-foreground">
            {formatMoney(estimate.totalCents)}
          </span>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-4 border-t pt-3 text-xs text-muted-foreground">
        <span>Created {new Date(estimate.createdAt).toLocaleDateString()}</span>

        <span>
          {estimate.lineItems.length} item
          {estimate.lineItems.length === 1 ? "" : "s"}
        </span>
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

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof FileText;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />

          <span className="text-sm">{label}</span>
        </div>

        <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

function EmptyEstimates() {
  return (
    <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed">
      <div className="max-w-sm px-6 text-center">
        <FileText className="mx-auto h-9 w-9 text-muted-foreground" />

        <p className="mt-3 font-medium">No estimates yet</p>

        <p className="mt-1 text-sm text-muted-foreground">
          Create your first estimate and connect it to a customer or job.
        </p>

        <Button
          className="mt-4"
          nativeButton={false}
          render={<Link href="/estimates/new">Create estimate</Link>}
        />
      </div>
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
