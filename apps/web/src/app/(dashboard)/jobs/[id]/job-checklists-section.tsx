import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ChecklistTemplate } from "@/lib/checklist-templates-api";
import type { JobChecklist } from "@/lib/job-checklists-api";

import { JobChecklistWorkspace } from "./job-checklist-workspace";

type JobChecklistsSectionProps = {
  jobId: string;
  archived: boolean;
  checklists: JobChecklist[];
  templates: ChecklistTemplate[];
};

export function JobChecklistsSection({
  jobId,
  archived,
  checklists,
  templates,
}: JobChecklistsSectionProps) {
  const allItems = checklists.flatMap((checklist) => checklist.items);
  const completedItems = allItems.filter((item) => item.completedAt).length;

  const progress =
    allItems.length > 0 ? Math.round((completedItems / allItems.length) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <CardTitle>Checklists</CardTitle>

            <CardDescription className="mt-1">
              Apply reusable workflows and track required job steps through completion.
            </CardDescription>
          </div>

          <div className="text-sm text-muted-foreground">
            {completedItems} of {allItems.length} complete
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {allItems.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Overall progress</span>

              <span className="font-medium">{progress}%</span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>
          </div>
        )}

        <JobChecklistWorkspace
          jobId={jobId}
          archived={archived}
          checklists={checklists}
          templates={templates}
        />
      </CardContent>
    </Card>
  );
}
