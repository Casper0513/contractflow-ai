import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { JobContact } from "@/lib/job-contacts-api";

import { JobContactWorkspace } from "./job-contact-workspace";

type JobContactsSectionProps = {
  jobId: string;
  archived: boolean;
  contacts: JobContact[];
};

export function JobContactsSection({
  jobId,
  archived,
  contacts,
}: JobContactsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <CardTitle>Job contacts</CardTitle>

            <CardDescription className="mt-1">
              Manage site contacts and the people your team may need to reach while
              completing this job.
            </CardDescription>
          </div>

          <div className="text-sm text-muted-foreground">
            {contacts.length} contact
            {contacts.length === 1 ? "" : "s"}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <JobContactWorkspace jobId={jobId} contacts={contacts} archived={archived} />
      </CardContent>
    </Card>
  );
}
