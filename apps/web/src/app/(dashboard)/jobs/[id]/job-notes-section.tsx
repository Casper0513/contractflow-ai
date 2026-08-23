import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { JobNote } from "@/lib/job-notes-api";

import { JobNotesWorkspace } from "./job-notes-workspace";

type JobNotesSectionProps = {
  jobId: string;
  archived: boolean;
  notes: JobNote[];
};

export function JobNotesSection({ jobId, archived, notes }: JobNotesSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <CardTitle>Internal notes</CardTitle>

            <CardDescription className="mt-1">
              Keep job-specific measurements, site details, customer conversations,
              reminders, and crew notes.
            </CardDescription>
          </div>

          <div className="text-sm text-muted-foreground">
            {notes.length} note
            {notes.length === 1 ? "" : "s"}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <JobNotesWorkspace jobId={jobId} notes={notes} archived={archived} />
      </CardContent>
    </Card>
  );
}
