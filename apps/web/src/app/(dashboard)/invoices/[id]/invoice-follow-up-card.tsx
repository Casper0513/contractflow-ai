import {
  AlertTriangle,
  BellOff,
  BellRing,
  CheckCircle2,
  Clock3,
  ReceiptText,
  Send,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Invoice, InvoiceReminder, InvoiceReminderType } from "@/lib/invoices-api";
import type { InvoiceReminderSettings } from "@/lib/organizations-api";

import { RunReminderCheckButton } from "./run-reminder-check-button";

type InvoiceFollowUpCardProps = {
  invoice: Invoice;
  settings: InvoiceReminderSettings;
};

type ReminderStage = {
  type: InvoiceReminderType;
  label: string;
  scheduledFor: Date | null;
  enabled: boolean;
};

export function InvoiceFollowUpCard({ invoice, settings }: InvoiceFollowUpCardProps) {
  const stages = buildReminderStages(invoice, settings);

  const reminderByType = new Map(
    invoice.reminders.map((reminder) => [reminder.type, reminder]),
  );

  const sentStages = stages.filter((stage) => {
    const reminder = reminderByType.get(stage.type);

    return Boolean(reminder?.sentAt);
  });

  const nextStage = getNextReminderStage({
    invoice,
    stages,
    reminderByType,
  });

  const automationAvailable =
    settings.enabled &&
    Boolean(invoice.dueDate) &&
    Boolean(invoice.customer.email) &&
    invoice.balanceDueCents > 0 &&
    invoice.status !== "DRAFT" &&
    invoice.status !== "PAID" &&
    invoice.status !== "VOIDED";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <CardTitle>Invoice follow-up</CardTitle>

            <CardDescription className="mt-1">
              Automatic payment reminders and collection follow-ups for this invoice.
            </CardDescription>
          </div>

          <AutomationBadge
            enabled={settings.enabled}
            available={automationAvailable}
            invoiceStatus={invoice.status}
            balanceDueCents={invoice.balanceDueCents}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryMetric
            label="Balance due"
            value={formatMoney(invoice.balanceDueCents, invoice.currency)}
          />

          <SummaryMetric label="Reminders sent" value={String(sentStages.length)} />

          <SummaryMetric
            label="Next follow-up"
            value={
              invoice.status === "DRAFT"
                ? "Send invoice first"
                : nextStage
                  ? formatNextFollowUp(nextStage)
                  : getNoNextReminderLabel(invoice)
            }
          />
        </div>

        <FollowUpState
          invoice={invoice}
          settings={settings}
          nextStage={nextStage}
          automationAvailable={automationAvailable}
        />

        {canRunReminderCheck(invoice) && (
          <div className="flex flex-col justify-between gap-3 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center">
            <div>
              <p className="font-medium">Check follow-up now</p>

              <p className="mt-1 text-sm text-muted-foreground">
                Evaluate this invoice against the configured reminder schedule. A reminder
                is sent only when a stage is actually due.
              </p>
            </div>

            <RunReminderCheckButton invoiceId={invoice.id} />
          </div>
        )}

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">Reminder timeline</p>

              <p className="mt-1 text-sm text-muted-foreground">
                ContractFlow records each automatic reminder stage separately.
              </p>
            </div>

            <span className="text-xs text-muted-foreground">
              {sentStages.length} of {stages.filter((stage) => stage.enabled).length}{" "}
              enabled stages sent
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border">
            {stages.map((stage, index) => {
              const reminder = reminderByType.get(stage.type);

              return (
                <ReminderTimelineRow
                  key={stage.type}
                  stage={stage}
                  reminder={reminder}
                  last={index === stages.length - 1}
                  invoiceStatus={invoice.status}
                  balanceDueCents={invoice.balanceDueCents}
                />
              );
            })}
          </div>
        </div>

        {!invoice.dueDate && invoice.status !== "PAID" && invoice.status !== "VOIDED" && (
          <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

            <div>
              <p className="font-medium text-amber-700">Due date required</p>

              <p className="mt-1 text-sm text-muted-foreground">
                Automatic invoice reminders require a due date.
              </p>
            </div>
          </div>
        )}

        {!invoice.customer.email &&
          invoice.status !== "PAID" &&
          invoice.status !== "VOIDED" && (
            <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

              <div>
                <p className="font-medium text-amber-700">Customer email required</p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Add an email address to the customer before automatic reminders can be
                  delivered.
                </p>
              </div>
            </div>
          )}
      </CardContent>
    </Card>
  );
}

function FollowUpState({
  invoice,
  settings,
  nextStage,
  automationAvailable,
}: {
  invoice: Invoice;
  settings: InvoiceReminderSettings;
  nextStage: ReminderStage | undefined;
  automationAvailable: boolean;
}) {
  if (invoice.status === "DRAFT") {
    return (
      <StatePanel
        icon={ReceiptText}
        title="Invoice has not been sent"
        description="Automatic payment reminders begin after the invoice is sent to the customer."
        tone="muted"
      />
    );
  }

  if (invoice.status === "PAID" || invoice.balanceDueCents <= 0) {
    return (
      <StatePanel
        icon={CheckCircle2}
        title="Paid in full"
        description="No additional payment reminders are required."
        tone="green"
      />
    );
  }

  if (invoice.status === "VOIDED") {
    return (
      <StatePanel
        icon={BellOff}
        title="Follow-up stopped"
        description="This invoice is voided, so automatic reminders will not be sent."
        tone="muted"
      />
    );
  }

  if (!settings.enabled) {
    return (
      <StatePanel
        icon={BellOff}
        title="Automatic reminders are disabled"
        description="Invoice reminder automation is currently disabled in organization settings."
        tone="amber"
      />
    );
  }

  if (!automationAvailable) {
    return (
      <StatePanel
        icon={AlertTriangle}
        title="Automatic follow-up unavailable"
        description="This invoice is missing information required for automatic reminders."
        tone="amber"
      />
    );
  }

  if (invoice.status === "OVERDUE") {
    return (
      <StatePanel
        icon={AlertTriangle}
        title="Payment overdue"
        description={
          nextStage
            ? `${formatMoney(
                invoice.balanceDueCents,
                invoice.currency,
              )} remains outstanding. Next automatic stage: ${nextStage.label}.`
            : `${formatMoney(
                invoice.balanceDueCents,
                invoice.currency,
              )} remains outstanding. No additional configured reminder stage remains.`
        }
        tone="red"
      />
    );
  }

  if (invoice.status === "PARTIALLY_PAID") {
    return (
      <StatePanel
        icon={Clock3}
        title="Partial payment received"
        description={
          nextStage
            ? `${formatMoney(
                invoice.balanceDueCents,
                invoice.currency,
              )} remains due. Next automatic stage: ${nextStage.label}.`
            : `${formatMoney(
                invoice.balanceDueCents,
                invoice.currency,
              )} remains due. No additional configured reminder stage remains.`
        }
        tone="amber"
      />
    );
  }

  return (
    <StatePanel
      icon={BellRing}
      title="Automatic follow-up active"
      description={
        nextStage
          ? `${nextStage.label} is the next configured reminder stage.`
          : "All currently configured reminder stages have been completed."
      }
      tone="blue"
    />
  );
}

function ReminderTimelineRow({
  stage,
  reminder,
  last,
  invoiceStatus,
  balanceDueCents,
}: {
  stage: ReminderStage;
  reminder: InvoiceReminder | undefined;
  last: boolean;
  invoiceStatus: Invoice["status"];
  balanceDueCents: number;
}) {
  const sent = Boolean(reminder?.sentAt);

  const notNeeded =
    invoiceStatus === "PAID" || balanceDueCents <= 0 || invoiceStatus === "VOIDED";

  const missed = !notNeeded && !sent && stage.enabled && isPastStage(stage);

  return (
    <div className={`flex items-start gap-3 px-4 py-4 ${!last ? "border-b" : ""}`}>
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
          sent
            ? "border-green-500/30 bg-green-500/10 text-green-600"
            : notNeeded
              ? "bg-muted/20 text-muted-foreground"
              : missed
                ? "border-amber-500/30 bg-amber-500/10 text-amber-600"
                : stage.enabled
                  ? "bg-muted/30 text-muted-foreground"
                  : "bg-muted/20 text-muted-foreground/50"
        }`}
      >
        {sent ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : notNeeded ? (
          <BellOff className="h-4 w-4" />
        ) : missed ? (
          <AlertTriangle className="h-4 w-4" />
        ) : stage.enabled ? (
          <Clock3 className="h-4 w-4" />
        ) : (
          <BellOff className="h-4 w-4" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
          <p className={`font-medium ${!stage.enabled ? "text-muted-foreground" : ""}`}>
            {stage.label}
          </p>

          <ReminderStatusLabel
            stage={stage}
            reminder={reminder}
            invoiceStatus={invoiceStatus}
            balanceDueCents={balanceDueCents}
          />
        </div>

        <p className="mt-1 text-sm text-muted-foreground">
          {sent && reminder?.sentAt
            ? `Sent ${formatDateTime(reminder.sentAt)}`
            : invoiceStatus === "DRAFT"
              ? "Begins after invoice is sent"
              : stage.enabled
                ? stage.scheduledFor
                  ? `Configured for ${formatDate(stage.scheduledFor)}`
                  : "Waiting for invoice due date"
                : "Disabled in reminder settings"}
        </p>
      </div>
    </div>
  );
}

function ReminderStatusLabel({
  stage,
  reminder,
  invoiceStatus,
  balanceDueCents,
}: {
  stage: ReminderStage;
  reminder: InvoiceReminder | undefined;
  invoiceStatus: Invoice["status"];
  balanceDueCents: number;
}) {
  if (invoiceStatus === "DRAFT") {
    return <span className="text-xs text-muted-foreground">Waiting</span>;
  }

  if (invoiceStatus === "PAID" || balanceDueCents <= 0 || invoiceStatus === "VOIDED") {
    return <span className="text-xs text-muted-foreground">Not needed</span>;
  }

  if (!stage.enabled) {
    return <span className="text-xs text-muted-foreground">Disabled</span>;
  }

  if (reminder?.sentAt) {
    return <span className="text-xs font-medium text-green-700">Sent</span>;
  }

  if (isPastStage(stage)) {
    return <span className="text-xs font-medium text-amber-700">Missed</span>;
  }

  if (reminder) {
    return <span className="text-xs font-medium text-blue-700">Scheduled</span>;
  }

  return <span className="text-xs text-muted-foreground">Pending</span>;
}

function AutomationBadge({
  enabled,
  available,
  invoiceStatus,
  balanceDueCents,
}: {
  enabled: boolean;
  available: boolean;
  invoiceStatus: Invoice["status"];
  balanceDueCents: number;
}) {
  if (invoiceStatus === "DRAFT") {
    return (
      <span className="flex w-fit items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-700">
        <Send className="h-3.5 w-3.5" />
        Waiting to send
      </span>
    );
  }

  if (invoiceStatus === "PAID" || balanceDueCents <= 0) {
    return (
      <span className="flex w-fit items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Follow-up complete
      </span>
    );
  }

  if (invoiceStatus === "VOIDED") {
    return (
      <span className="flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground">
        <BellOff className="h-3.5 w-3.5" />
        Follow-up stopped
      </span>
    );
  }

  if (!enabled) {
    return (
      <span className="flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground">
        <BellOff className="h-3.5 w-3.5" />
        Automation off
      </span>
    );
  }

  if (!available) {
    return (
      <span className="flex w-fit items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700">
        <AlertTriangle className="h-3.5 w-3.5" />
        Automation unavailable
      </span>
    );
  }

  return (
    <span className="flex w-fit items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-700">
      <BellRing className="h-3.5 w-3.5" />
      Automation on
    </span>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>

      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function StatePanel({
  icon: Icon,
  title,
  description,
  tone,
}: {
  icon: typeof BellRing;
  title: string;
  description: string;
  tone: "muted" | "blue" | "amber" | "red" | "green";
}) {
  const styles = {
    muted: {
      container: "bg-muted/20",
      icon: "text-muted-foreground",
      title: "",
    },

    blue: {
      container: "border-blue-500/30 bg-blue-500/5",
      icon: "text-blue-600",
      title: "text-blue-700",
    },

    amber: {
      container: "border-amber-500/30 bg-amber-500/5",
      icon: "text-amber-600",
      title: "text-amber-700",
    },

    red: {
      container: "border-red-500/30 bg-red-500/5",
      icon: "text-red-600",
      title: "text-red-700",
    },

    green: {
      container: "border-green-500/30 bg-green-500/5",
      icon: "text-green-600",
      title: "text-green-700",
    },
  } as const;

  const style = styles[tone];

  return (
    <div className={`rounded-xl border p-4 ${style.container}`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.icon}`} />

        <div>
          <p className={`font-medium ${style.title}`}>{title}</p>

          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}

function buildReminderStages(
  invoice: Invoice,
  settings: InvoiceReminderSettings,
): ReminderStage[] {
  const dueDate = invoice.dueDate ? parseDateOnly(invoice.dueDate) : null;

  return [
    {
      type: "BEFORE_DUE",
      label: "Before-due reminder",
      enabled: settings.beforeDueEnabled,
      scheduledFor: dueDate ? addDays(dueDate, -settings.beforeDueDays) : null,
    },
    {
      type: "DUE_TODAY",
      label: "Due-date reminder",
      enabled: settings.dueTodayEnabled,
      scheduledFor: dueDate,
    },
    {
      type: "FIRST_OVERDUE",
      label: "First overdue reminder",
      enabled: settings.firstOverdueEnabled,
      scheduledFor: dueDate ? addDays(dueDate, settings.firstOverdueDays) : null,
    },
    {
      type: "SECOND_OVERDUE",
      label: "Second overdue reminder",
      enabled: settings.secondOverdueEnabled,
      scheduledFor: dueDate ? addDays(dueDate, settings.secondOverdueDays) : null,
    },
  ];
}

function getNextReminderStage({
  invoice,
  stages,
  reminderByType,
}: {
  invoice: Invoice;
  stages: ReminderStage[];
  reminderByType: Map<InvoiceReminderType, InvoiceReminder>;
}) {
  if (
    invoice.status === "DRAFT" ||
    invoice.status === "PAID" ||
    invoice.status === "VOIDED" ||
    invoice.balanceDueCents <= 0
  ) {
    return undefined;
  }

  const today = startOfUtcDay(new Date());

  const eligibleTypes =
    invoice.status === "OVERDUE"
      ? ["FIRST_OVERDUE", "SECOND_OVERDUE"]
      : ["BEFORE_DUE", "DUE_TODAY", "FIRST_OVERDUE", "SECOND_OVERDUE"];

  return stages.find((stage) => {
    if (!eligibleTypes.includes(stage.type)) {
      return false;
    }

    if (!stage.enabled) {
      return false;
    }

    const reminder = reminderByType.get(stage.type);

    if (reminder?.sentAt) {
      return false;
    }

    if (!stage.scheduledFor) {
      return false;
    }

    return startOfUtcDay(stage.scheduledFor) >= today;
  });
}

function canRunReminderCheck(invoice: Invoice) {
  return (
    invoice.balanceDueCents > 0 &&
    (invoice.status === "SENT" ||
      invoice.status === "VIEWED" ||
      invoice.status === "PARTIALLY_PAID" ||
      invoice.status === "OVERDUE")
  );
}

function getNoNextReminderLabel(invoice: Invoice) {
  if (invoice.status === "DRAFT") {
    return "Send invoice first";
  }

  if (invoice.status === "PAID" || invoice.balanceDueCents <= 0) {
    return "None — paid";
  }

  if (invoice.status === "VOIDED") {
    return "None — voided";
  }

  return "No stage remaining";
}

function isPastStage(stage: ReminderStage) {
  if (!stage.scheduledFor) {
    return false;
  }

  return startOfUtcDay(stage.scheduledFor) < startOfUtcDay(new Date());
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function parseDateOnly(value: string) {
  const dateOnly = value.slice(0, 10);

  return new Date(`${dateOnly}T00:00:00.000Z`);
}

function addDays(date: Date, days: number) {
  const result = new Date(date);

  result.setUTCDate(result.getUTCDate() + days);

  return result;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(value);
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

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function formatNextFollowUp(stage: ReminderStage) {
  if (!stage.scheduledFor) {
    return stage.label;
  }

  return `${stage.label} · ${formatDate(stage.scheduledFor)}`;
}
