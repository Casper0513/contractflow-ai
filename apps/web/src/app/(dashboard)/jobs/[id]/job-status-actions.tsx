"use client";

import { useState } from "react";
import { Archive, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

import { archiveJobAction, restoreJobAction } from "./actions";

type JobStatusActionsProps = {
  jobId: string;
  customerId: string;
  jobName: string;
  archived: boolean;
};

export function JobStatusActions({
  jobId,
  customerId,
  jobName,
  archived,
}: JobStatusActionsProps) {
  const [confirming, setConfirming] = useState(false);

  if (archived) {
    return (
      <form action={restoreJobAction.bind(null, jobId, customerId)}>
        <Button type="submit" variant="outline">
          <RotateCcw className="h-4 w-4" />
          Restore job
        </Button>
      </form>
    );
  }

  if (confirming) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <p className="font-medium">Archive {jobName}?</p>

        <p className="mt-1 text-sm text-muted-foreground">
          The job will be removed from the active job directory, but its history and
          customer activity will remain available.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
            Cancel
          </Button>

          <form action={archiveJobAction.bind(null, jobId, customerId)}>
            <Button type="submit" variant="destructive">
              <Archive className="h-4 w-4" />
              Archive job
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <Button type="button" variant="outline" onClick={() => setConfirming(true)}>
      <Archive className="h-4 w-4" />
      Archive
    </Button>
  );
}
