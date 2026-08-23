import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { JobActivity } from "@/lib/job-activity-api";

import { JobActivityTimeline } from "./job-activity-timeline";

type JobActivitySectionProps = {
  activities: JobActivity[];
};

export function JobActivitySection({ activities }: JobActivitySectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <CardTitle>Activity timeline</CardTitle>

            <CardDescription className="mt-1">
              A chronological history of job changes, tasks, schedules, materials, costs,
              estimates, invoices, payments, photos, documents, and notes.
            </CardDescription>
          </div>

          <div className="text-sm text-muted-foreground">
            {activities.length} event
            {activities.length === 1 ? "" : "s"}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <JobActivityTimeline activities={activities} />
      </CardContent>
    </Card>
  );
}
