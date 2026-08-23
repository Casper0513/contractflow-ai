import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { JobDocument } from "@/lib/job-documents-api";

import { JobDocumentWorkspace } from "./job-document-workspace";

type JobDocumentsSectionProps = {
  jobId: string;
  archived: boolean;
  documents: JobDocument[];
};

export function JobDocumentsSection({
  jobId,
  archived,
  documents,
}: JobDocumentsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <CardTitle>Documents</CardTitle>

            <CardDescription className="mt-1">
              Store contracts, permits, receipts, warranties, plans, and other job files.
            </CardDescription>
          </div>

          <div className="text-sm text-muted-foreground">
            {documents.length} document
            {documents.length === 1 ? "" : "s"}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <JobDocumentWorkspace jobId={jobId} documents={documents} archived={archived} />
      </CardContent>
    </Card>
  );
}
