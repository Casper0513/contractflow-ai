import { Archive, History, Pencil, RotateCcw, UserPlus } from "lucide-react";

import type { CustomerActivity } from "@/lib/customers-api";

type ActivitySummaryProps = {
  activities: CustomerActivity[];
};

export function ActivitySummary({ activities }: ActivitySummaryProps) {
  const created = countByType(activities, "CUSTOMER_CREATED");

  const updated = countByType(activities, "CUSTOMER_UPDATED");

  const archived = countByType(activities, "CUSTOMER_ARCHIVED");

  const restored = countByType(activities, "CUSTOMER_RESTORED");

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <SummaryItem label="Total" value={activities.length} icon={History} />

      <SummaryItem label="Created" value={created} icon={UserPlus} />

      <SummaryItem label="Updated" value={updated} icon={Pencil} />

      <SummaryItem label="Archived" value={archived} icon={Archive} />

      <SummaryItem label="Restored" value={restored} icon={RotateCcw} />
    </div>
  );
}

function SummaryItem({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof History;
}) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />

        <span className="text-sm">{label}</span>
      </div>

      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function countByType(activities: CustomerActivity[], type: string) {
  return activities.filter((activity) => activity.type === type).length;
}
