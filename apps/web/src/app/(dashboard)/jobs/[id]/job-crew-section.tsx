import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CrewMember } from "@/lib/crew-api";
import type { JobTimeEntry } from "@/lib/job-time-entries-api";

import { JobCrewWorkspace } from "./job-crew-workspace";

type JobCrewSectionProps = {
  jobId: string;
  crewMembers: CrewMember[];
  timeEntries: JobTimeEntry[];
  currency?: string;
};

export function JobCrewSection({
  jobId,
  crewMembers,
  timeEntries,
  currency = "CAD",
}: JobCrewSectionProps) {
  const activeCrewCount = crewMembers.filter((crewMember) => crewMember.active).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <CardTitle>Crew & labor</CardTitle>

            <CardDescription className="mt-1">
              Manage crew members, track job time, and automatically include labor in job
              profitability.
            </CardDescription>
          </div>

          <div className="text-sm text-muted-foreground">{activeCrewCount} active</div>
        </div>
      </CardHeader>

      <CardContent>
        <JobCrewWorkspace
          jobId={jobId}
          crewMembers={crewMembers}
          timeEntries={timeEntries}
          currency={currency}
        />
      </CardContent>
    </Card>
  );
}
