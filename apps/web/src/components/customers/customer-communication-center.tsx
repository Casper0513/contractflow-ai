"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  AlertCircle,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  FileText,
  Mail,
  ReceiptText,
  RefreshCw,
  Search,
  UserRound,
  WalletCards,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CustomerCommunication } from "@/lib/customers-api";
import {
  retryCommunicationAction,
  type RetryCommunicationActionState,
} from "@/app/(dashboard)/customers/[id]/actions";

type CustomerCommunicationCenterProps = {
  customerId: string;
  communications: CustomerCommunication[];
};

type CommunicationFilter = "ALL" | CustomerCommunication["category"] | "FAILED";

const FILTERS: Array<{
  value: CommunicationFilter;
  label: string;
}> = [
  {
    value: "ALL",
    label: "All",
  },
  {
    value: "GENERAL",
    label: "Email",
  },
  {
    value: "ESTIMATE",
    label: "Estimate",
  },
  {
    value: "INVOICE",
    label: "Invoice",
  },
  {
    value: "PAYMENT",
    label: "Payment",
  },
  {
    value: "REMINDER",
    label: "Reminder",
  },
  {
    value: "FAILED",
    label: "Failed",
  },
];

export function CustomerCommunicationCenter({
  customerId,
  communications,
}: CustomerCommunicationCenterProps) {
  const [filter, setFilter] = useState<CommunicationFilter>("ALL");

  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    return {
      ALL: communications.length,

      GENERAL: communications.filter(
        (communication) => communication.category === "GENERAL",
      ).length,

      ESTIMATE: communications.filter(
        (communication) => communication.category === "ESTIMATE",
      ).length,

      INVOICE: communications.filter(
        (communication) => communication.category === "INVOICE",
      ).length,

      PAYMENT: communications.filter(
        (communication) => communication.category === "PAYMENT",
      ).length,

      REMINDER: communications.filter(
        (communication) => communication.category === "REMINDER",
      ).length,

      FAILED: communications.filter((communication) => communication.status === "FAILED")
        .length,
    } satisfies Record<CommunicationFilter, number>;
  }, [communications]);

  const filteredCommunications = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return communications.filter((communication) => {
      const matchesFilter =
        filter === "ALL"
          ? true
          : filter === "FAILED"
            ? communication.status === "FAILED"
            : communication.category === filter;

      if (!matchesFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [
        communication.subject,
        communication.recipientEmail,
        communication.textBody,
        communication.job?.name,
        communication.estimate?.number,
        communication.invoice?.number,
      ].some((value) => value?.toLowerCase().includes(normalizedQuery));
    });
  }, [communications, filter, query]);

  if (communications.length === 0) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed">
        <div className="max-w-sm px-6 text-center">
          <Mail className="mx-auto h-8 w-8 text-muted-foreground" />

          <p className="mt-3 font-medium">No communication yet</p>

          <p className="mt-1 text-sm text-muted-foreground">
            Emails, estimates, invoices, reminders, and payment confirmations sent to this
            customer will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search subject, recipient, message, invoice, estimate, or job..."
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => {
            const active = filter === item.value;

            return (
              <Button
                key={item.value}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
                <span
                  className={
                    active ? "text-primary-foreground/70" : "text-muted-foreground"
                  }
                >
                  {counts[item.value]}
                </span>
              </Button>
            );
          })}
        </div>
      </div>

      {filteredCommunications.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed">
          <div className="max-w-sm px-6 text-center">
            <Search className="mx-auto h-7 w-7 text-muted-foreground" />

            <p className="mt-3 font-medium">No matching communication</p>

            <p className="mt-1 text-sm text-muted-foreground">
              Try another search term or filter.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCommunications.map((communication) => (
            <CommunicationItem
              key={communication.id}
              customerId={customerId}
              communication={communication}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CommunicationItem({
  customerId,
  communication,
}: {
  customerId: string;
  communication: CustomerCommunication;
}) {
  const actorName = communication.actor
    ? [communication.actor.firstName, communication.actor.lastName]
        .filter(Boolean)
        .join(" ") || communication.actor.email
    : "ContractFlow automation";

  const date = communication.sentAt ?? communication.createdAt;

  return (
    <article className="rounded-xl border bg-background p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CommunicationCategoryBadge category={communication.category} />

            <CommunicationStatusBadge status={communication.status} />
          </div>

          <h3 className="mt-3 font-semibold">{communication.subject}</h3>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Mail className="h-3.5 w-3.5" />

              {communication.recipientEmail}
            </span>

            <span className="flex items-center gap-1">
              <UserRound className="h-3.5 w-3.5" />

              {actorName}
            </span>

            <span>{new Date(date).toLocaleString()}</span>
          </div>
        </div>

        <CommunicationStatusIcon status={communication.status} />
      </div>

      <div className="mt-4 whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-sm leading-6">
        {communication.textBody}
      </div>

      {(communication.job || communication.estimate || communication.invoice) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {communication.job && (
            <ContextLink
              href={`/jobs/${communication.job.id}`}
              icon={<BriefcaseBusiness className="h-3.5 w-3.5" />}
            >
              {communication.job.name}
            </ContextLink>
          )}

          {communication.estimate && (
            <ContextLink
              href={`/estimates/${communication.estimate.id}`}
              icon={<FileText className="h-3.5 w-3.5" />}
            >
              {communication.estimate.number}
            </ContextLink>
          )}

          {communication.invoice && (
            <ContextLink
              href={`/invoices/${communication.invoice.id}`}
              icon={<ReceiptText className="h-3.5 w-3.5" />}
            >
              {communication.invoice.number}
            </ContextLink>
          )}
        </div>
      )}

      {communication.paymentId && (
        <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
          <WalletCards className="h-3.5 w-3.5" />
          Payment confirmation
        </div>
      )}

      {communication.status === "FAILED" && (
        <div className="mt-4 space-y-3">
          {communication.errorMessage && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700">
              Delivery failed: {communication.errorMessage}
            </div>
          )}

          {communication.category === "GENERAL" ? (
            <RetryCommunicationButton
              customerId={customerId}
              communicationId={communication.id}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              Retry this delivery from its original{" "}
              {getSourceWorkflowLabel(communication.category)} workflow so its lifecycle
              and attachments remain synchronized.
            </p>
          )}
        </div>
      )}
    </article>
  );
}

const initialRetryState: RetryCommunicationActionState = {
  success: false,
  message: "",
};

function RetryCommunicationButton({
  customerId,
  communicationId,
}: {
  customerId: string;
  communicationId: string;
}) {
  const action = retryCommunicationAction.bind(null, customerId, communicationId);

  const [state, formAction, pending] = useActionState(action, initialRetryState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />

        {pending ? "Retrying..." : "Retry delivery"}
      </Button>

      {state.message && (
        <span
          className={state.success ? "text-xs text-green-700" : "text-xs text-red-700"}
        >
          {state.message}
        </span>
      )}
    </form>
  );
}

function ContextLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted"
    >
      {icon}

      {children}
    </Link>
  );
}

function CommunicationCategoryBadge({
  category,
}: {
  category: CustomerCommunication["category"];
}) {
  const styles: Record<CustomerCommunication["category"], string> = {
    GENERAL: "border-slate-500/30 bg-slate-500/10 text-slate-700",
    ESTIMATE: "border-indigo-500/30 bg-indigo-500/10 text-indigo-700",
    INVOICE: "border-blue-500/30 bg-blue-500/10 text-blue-700",
    PAYMENT: "border-green-500/30 bg-green-500/10 text-green-700",
    REMINDER: "border-amber-500/30 bg-amber-500/10 text-amber-700",
  };

  const labels: Record<CustomerCommunication["category"], string> = {
    GENERAL: "Email",
    ESTIMATE: "Estimate",
    INVOICE: "Invoice",
    PAYMENT: "Payment",
    REMINDER: "Reminder",
  };

  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${styles[category]}`}
    >
      {labels[category]}
    </span>
  );
}

function CommunicationStatusBadge({
  status,
}: {
  status: CustomerCommunication["status"];
}) {
  const styles: Record<CustomerCommunication["status"], string> = {
    PENDING: "border-amber-500/30 bg-amber-500/10 text-amber-700",
    SENT: "border-green-500/30 bg-green-500/10 text-green-700",
    FAILED: "border-red-500/30 bg-red-500/10 text-red-700",
  };

  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {status === "PENDING" ? "Pending" : status === "SENT" ? "Sent" : "Failed"}
    </span>
  );
}

function CommunicationStatusIcon({
  status,
}: {
  status: CustomerCommunication["status"];
}) {
  if (status === "SENT") {
    return <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />;
  }

  if (status === "FAILED") {
    return <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />;
  }

  return <Clock3 className="h-5 w-5 shrink-0 text-amber-600" />;
}

function getSourceWorkflowLabel(category: CustomerCommunication["category"]) {
  switch (category) {
    case "INVOICE":
      return "invoice";

    case "ESTIMATE":
      return "estimate";

    case "PAYMENT":
      return "payment";

    case "REMINDER":
      return "reminder";

    default:
      return "communication";
  }
}
