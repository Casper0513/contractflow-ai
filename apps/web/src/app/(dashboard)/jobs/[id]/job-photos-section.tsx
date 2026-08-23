import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { JobPhoto } from "@/lib/job-photos-api";

import { JobPhotoWorkspace } from "./job-photo-workspace";

type JobPhotosSectionProps = {
  jobId: string;
  archived: boolean;
  photos: JobPhoto[];
};

export function JobPhotosSection({ jobId, archived, photos }: JobPhotosSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <CardTitle>Photos</CardTitle>

            <CardDescription className="mt-1">
              Capture before, progress, after, issue, and other job photos.
            </CardDescription>
          </div>

          <div className="text-sm text-muted-foreground">
            {photos.length} photo
            {photos.length === 1 ? "" : "s"}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <JobPhotoWorkspace jobId={jobId} photos={photos} archived={archived} />
      </CardContent>
    </Card>
  );
}
