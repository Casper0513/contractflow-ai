import Link from "next/link";
import {
  BadgeDollarSign,
  BriefcaseBusiness,
  CalendarDays,
  FileText,
  ReceiptText,
  Search,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getInvoices,
  getInvoiceSummary,
  type Invoice,
  type InvoiceDirectoryStatus,
  type InvoiceSort,
} from "@/lib/invoices-api";

type InvoicesPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    sort?: string;
  }>;
};

const invoiceStatuses: Array<{
  value: InvoiceDirectoryStatus;
  label: string;
}> = [
  {
    value: "ALL",
    label: "All statuses",
  },
  {
    value: "OUTSTANDING",
    label: "Outstanding",
  },
  {
    value: "DRAFT",
    label: "Draft",
  },
  {
    value: "SENT",
    label: "Sent",
  },
  {
    value: "VIEWED",
    label: "Viewed",
  },
  {
    value: "PARTIALLY_PAID",
    label: "Partially paid",
  },
  {
    value: "PAID",
    label: "Paid",
  },
  {
    value: "OVERDUE",
    label: "Overdue",
  },
  {
    value: "VOIDED",
    label: "Voided",
  },
];

const invoiceSorts: Array<{
  value: InvoiceSort;
  label: string;
}> = [
  {
    value: "newest",
    label: "Newest first",
  },
  {
    value: "oldest",
    label: "Oldest first",
  },
  {
    value: "due-soonest",
    label: "Due soonest",
  },
  {
    value: "total-desc",
    label: "Highest total",
  },
  {
    value: "balance-desc",
    label: "Highest balance",
  },
];

export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
  const params = await searchParams;

  const query = params.q?.trim() ?? "";

  const status = parseInvoiceStatus(params.status);

  const sort = parseInvoiceSort(params.sort);

  const [invoices, summary] = await Promise.all([
    getInvoices({
      query,
      status,
      sort,
    }),
    getInvoiceSummary(),
  ]);

  const hasFilters = query.length > 0 || status !== "ALL" || sort !== "newest";

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>

          <p className="mt-1 text-muted-foreground">
            Create, send, track, and collect customer invoices.
          </p>
        </div>

        <Button
          nativeButton={false}
          render={<Link href="/invoices/new">New invoice</Link>}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          label="Drafts"
          value={summary.drafts.toString()}
          icon={FileText}
          href="/invoices?status=DRAFT"
          active={status === "DRAFT"}
        />

        <SummaryCard
          label="Outstanding"
          value={formatMoney(summary.outstandingCents)}
          icon={WalletCards}
          href="/invoices?status=OUTSTANDING"
          active={status === "OUTSTANDING"}
        />

        <SummaryCard
          label="Overdue"
          value={formatMoney(summary.overdueCents)}
          icon={CalendarDays}
          href="/invoices?status=OVERDUE"
          active={status === "OVERDUE"}
        />

        <SummaryCard
          label="Paid"
          value={summary.paid.toString()}
          icon={BadgeDollarSign}
          href="/invoices?status=PAID"
          active={status === "PAID"}
        />

        <SummaryCard
          label="Collected"
          value={formatMoney(summary.collectedCents)}
          icon={BadgeDollarSign}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div>
              <CardTitle>Invoice directory</CardTitle>

              <CardDescription className="mt-1">
                Search and filter invoices across customers and jobs.
              </CardDescription>
            </div>

            <p className="text-sm text-muted-foreground">
              {invoices.length} result
              {invoices.length === 1 ? "" : "s"}
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <InvoiceFilters
            query={query}
            status={status}
            sort={sort}
            hasFilters={hasFilters}
          />

          {invoices.length === 0 ? (
            hasFilters ? (
              <NoMatchingInvoices />
            ) : (
              <EmptyInvoices />
            )
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {invoices.map((invoice) => (
                <InvoiceCard key={invoice.id} invoice={invoice} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InvoiceFilters({
  query,
  status,
  sort,
  hasFilters,
}: {
  query: string;
  status: InvoiceDirectoryStatus;
  sort: InvoiceSort;
  hasFilters: boolean;
}) {
  return (
    <form action="/invoices" method="GET" className="rounded-xl border bg-muted/10 p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_220px_auto] lg:items-end">
        <label className="block">
          <span className="mb-2 block text-sm font-medium">Search</span>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <input
              name="q"
              defaultValue={query}
              placeholder="Invoice, customer, company, or job..."
              className="flex h-9 w-full rounded-md border border-input bg-transparent py-1 pl-9 pr-3 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Status</span>

          <select
            name="status"
            defaultValue={status}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {invoiceStatuses.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Sort</span>

          <select
            name="sort"
            defaultValue={sort}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {invoiceSorts.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap gap-2">
          <Button type="submit">Apply filters</Button>

          {hasFilters && (
            <Button
              variant="outline"
              nativeButton={false}
              render={
                <Link href="/invoices">
                  <X className="h-4 w-4" />
                  Clear
                </Link>
              }
            />
          )}
        </div>
      </div>

      {hasFilters && (
        <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
          {query && <FilterChip>Search: {query}</FilterChip>}

          {status !== "ALL" && (
            <FilterChip>
              {status === "OUTSTANDING" ? "Outstanding" : formatEnumLabel(status)}
            </FilterChip>
          )}

          {sort !== "newest" && (
            <FilterChip>
              {invoiceSorts.find((option) => option.value === sort)?.label ?? sort}
            </FilterChip>
          )}
        </div>
      )}
    </form>
  );
}

function FilterChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function InvoiceCard({ invoice }: { invoice: Invoice }) {
  const customerName = [invoice.customer.firstName, invoice.customer.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <Link
      href={`/invoices/${invoice.id}`}
      className="group block rounded-xl border bg-card p-5 transition-all hover:border-primary/40 hover:bg-muted/30 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{invoice.number}</h2>

            <InvoiceStatusBadge status={invoice.status} />
          </div>

          <p className="mt-1 truncate text-sm text-muted-foreground">
            {invoice.title || "Untitled invoice"}
          </p>
        </div>

        <ReceiptText className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>

      <div className="mt-5 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
        <div className="flex min-w-0 items-center gap-2">
          <UserRound className="h-4 w-4 shrink-0" />

          <span className="truncate">{customerName}</span>
        </div>

        {invoice.job && (
          <div className="flex min-w-0 items-center gap-2">
            <BriefcaseBusiness className="h-4 w-4 shrink-0" />

            <span className="truncate">{invoice.job.name}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0" />

          <span>
            {invoice.dueDate
              ? `Due ${new Date(invoice.dueDate).toLocaleDateString()}`
              : "No due date"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <BadgeDollarSign className="h-4 w-4 shrink-0" />

          <span className="font-medium text-foreground">
            {formatMoney(invoice.totalCents)}
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 border-t pt-4 sm:grid-cols-3">
        <InvoiceAmount label="Paid" value={formatMoney(invoice.amountPaidCents)} />

        <InvoiceAmount
          label="Balance"
          value={formatMoney(invoice.balanceDueCents)}
          emphasize={invoice.balanceDueCents > 0}
        />

        <InvoiceAmount
          label="Issued"
          value={new Date(invoice.issueDate).toLocaleDateString()}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          {invoice.lineItems.length} item
          {invoice.lineItems.length === 1 ? "" : "s"}
        </span>

        {invoice.sourceEstimate && <span>From {invoice.sourceEstimate.number}</span>}
      </div>
    </Link>
  );
}

function InvoiceAmount({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>

      <p
        className={`mt-1 text-sm font-medium tabular-nums ${
          emphasize ? "text-foreground" : ""
        }`}
      >
        {value}
      </p>
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
  href,
  active = false,
}: {
  label: string;
  value: string;
  icon: typeof FileText;
  href?: string;
  active?: boolean;
}) {
  const content = (
    <Card
      className={
        active
          ? "border-primary/50 bg-primary/5"
          : href
            ? "transition-colors hover:border-primary/40 hover:bg-muted/20"
            : undefined
      }
    >
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />

          <span className="text-sm">{label}</span>
        </div>

        <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="block">
      {content}
    </Link>
  );
}

function EmptyInvoices() {
  return (
    <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed">
      <div className="max-w-sm px-6 text-center">
        <ReceiptText className="mx-auto h-9 w-9 text-muted-foreground" />

        <p className="mt-3 font-medium">No invoices yet</p>

        <p className="mt-1 text-sm text-muted-foreground">
          Create your first invoice or convert an approved estimate into one.
        </p>

        <Button
          className="mt-4"
          nativeButton={false}
          render={<Link href="/invoices/new">Create invoice</Link>}
        />
      </div>
    </div>
  );
}

function NoMatchingInvoices() {
  return (
    <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed">
      <div className="max-w-md px-6 text-center">
        <Search className="mx-auto h-9 w-9 text-muted-foreground" />

        <p className="mt-3 font-medium">No matching invoices</p>

        <p className="mt-1 text-sm text-muted-foreground">
          Try changing your search, status, or sort options.
        </p>

        <Button
          className="mt-4"
          variant="outline"
          nativeButton={false}
          render={
            <Link href="/invoices">
              <X className="h-4 w-4" />
              Clear filters
            </Link>
          }
        />
      </div>
    </div>
  );
}

function parseInvoiceStatus(value: string | undefined): InvoiceDirectoryStatus {
  const normalized = value?.toUpperCase();

  const match = invoiceStatuses.find((option) => option.value === normalized);

  return match?.value ?? "ALL";
}

function parseInvoiceSort(value: string | undefined): InvoiceSort {
  const match = invoiceSorts.find((option) => option.value === value);

  return match?.value ?? "newest";
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
