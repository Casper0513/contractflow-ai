import type { CustomerActivity } from "@/lib/customers-api";

import { ActivityItem } from "./activity-item";

type ActivityDayProps = {
  label: string;
  activities: CustomerActivity[];
};

export function ActivityDay({ label, activities }: ActivityDayProps) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <p className="text-sm font-semibold">{label}</p>

        <div className="h-px flex-1 bg-border" />
      </div>

      <div>
        {activities.map((activity, index) => (
          <ActivityItem
            key={activity.id}
            activity={activity}
            showConnector={index !== activities.length - 1}
          />
        ))}
      </div>
    </section>
  );
}
