import {
  Activity,
  BriefcaseBusiness,
  CalendarDays,
  CircleDollarSign,
  FileText,
  Receipt,
  ShieldCheck,
} from "lucide-react";

import type { Customer, CustomerActivity } from "@/lib/customers-api";
import { formatRelativeTime } from "@/lib/activity-utils";

type CustomerHealthProps = {
  customer: Customer;
  activities: CustomerActivity[];
};

export function CustomerHealth({ customer, activities }: CustomerHealthProps) {
  const latestActivity = activities[0];

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-muted-foreground" />

            <h2 className="text-lg font-semibold">Customer health</h2>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            Key customer status and relationship signals.
          </p>
        </div>

        <StatusBadge archived={Boolean(customer.archivedAt)} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <HealthItem
          label="Customer since"
          value={new Date(customer.createdAt).toLocaleDateString()}
          icon={CalendarDays}
        />

        <HealthItem
          label="Last activity"
          value={
            latestActivity
              ? formatRelativeTime(latestActivity.createdAt)
              : "No activity yet"
          }
          icon={Activity}
        />

        <HealthItem
          label="Activity events"
          value={activities.length.toString()}
          icon={Activity}
        />

        <HealthItem label="Jobs" value="0" icon={BriefcaseBusiness} muted />

        <HealthItem label="Estimates" value="0" icon={FileText} muted />

        <HealthItem label="Invoices" value="0" icon={Receipt} muted />

        <HealthItem label="Outstanding" value="$0.00" icon={CircleDollarSign} muted />
      </div>
    </div>
  );
}

function HealthItem({
  label,
  value,
  icon: Icon,
  muted = false,
}: {
  label: string;
  value: string;
  icon: typeof Activity;
  muted?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${muted ? "bg-muted/20" : "bg-background"}`}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />

        <span className="text-sm">{label}</span>
      </div>

      <p className="mt-2 text-xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function StatusBadge({ archived }: { archived: boolean }) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-sm font-medium ${
        archived
          ? "border-orange-500/30 bg-orange-500/10 text-orange-700"
          : "border-green-500/30 bg-green-500/10 text-green-700"
      }`}
    >
      {archived ? "Archived" : "Active"}
    </span>
  );
}
