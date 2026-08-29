"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  BriefcaseBusiness,
  Check,
  Eye,
  FileOutput,
  Pencil,
  Send,
  TimerOff,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { EstimateStatus } from "@/lib/estimates-api";

import {
  createInvoiceFromEstimateAction,
  createJobFromEstimateAction,
  runEstimateAction,
  type EstimateAction,
} from "./actions";

type EstimateActionsProps = {
  estimateId: string;
  status: EstimateStatus;

  job: {
    id: string;
    name: string;
  } | null;
};

export function EstimateActions({ estimateId, status, job }: EstimateActionsProps) {
  const router = useRouter();

  const [isPending, startTransition] = useTransition();

  const [error, setError] = useState<string | null>(null);

  const [success, setSuccess] = useState<string | null>(null);

  function execute(action: EstimateAction) {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await runEstimateAction(estimateId, action);

      if (result.error) {
        setError(result.error);

        return;
      }

      setSuccess(result.success);

      router.refresh();
    });
  }

  function createJob() {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await createJobFromEstimateAction(estimateId);

      if (result?.error) {
        setError(result.error);
      }
    });
  }

  function createInvoice() {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await createInvoiceFromEstimateAction(estimateId);

      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {status === "DRAFT" && (
          <>
            <Button
              variant="outline"
              nativeButton={false}
              render={
                <Link href={`/estimates/${estimateId}/edit`}>
                  <Pencil className="h-4 w-4" />
                  Edit estimate
                </Link>
              }
            />

            <ActionButton
              label="Mark expired"
              pendingLabel="Updating..."
              icon={TimerOff}
              variant="outline"
              isPending={isPending}
              onClick={() => execute("expire")}
            />
          </>
        )}

        {status === "SENT" && (
          <>
            <ActionButton
              label="Mark viewed"
              pendingLabel="Updating..."
              icon={Eye}
              variant="outline"
              isPending={isPending}
              onClick={() => execute("view")}
            />

            <ActionButton
              label="Approve"
              pendingLabel="Approving..."
              icon={Check}
              isPending={isPending}
              onClick={() => execute("approve")}
            />

            <ActionButton
              label="Decline"
              pendingLabel="Declining..."
              icon={X}
              variant="outline"
              isPending={isPending}
              onClick={() => execute("decline")}
            />

            <ActionButton
              label="Mark expired"
              pendingLabel="Updating..."
              icon={TimerOff}
              variant="outline"
              isPending={isPending}
              onClick={() => execute("expire")}
            />
          </>
        )}

        {status === "VIEWED" && (
          <>
            <ActionButton
              label="Approve"
              pendingLabel="Approving..."
              icon={Check}
              isPending={isPending}
              onClick={() => execute("approve")}
            />

            <ActionButton
              label="Decline"
              pendingLabel="Declining..."
              icon={X}
              variant="outline"
              isPending={isPending}
              onClick={() => execute("decline")}
            />

            <ActionButton
              label="Mark expired"
              pendingLabel="Updating..."
              icon={TimerOff}
              variant="outline"
              isPending={isPending}
              onClick={() => execute("expire")}
            />
          </>
        )}

        {status === "APPROVED" && (
          <>
            {job ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <Link href={`/jobs/${job.id}`}>
                    <BriefcaseBusiness className="h-4 w-4" />
                    View job
                  </Link>
                }
              />
            ) : (
              <ActionButton
                label="Create job"
                pendingLabel="Creating job..."
                icon={BriefcaseBusiness}
                variant="outline"
                isPending={isPending}
                onClick={createJob}
              />
            )}

            <ActionButton
              label="Create invoice"
              pendingLabel="Creating invoice..."
              icon={FileOutput}
              isPending={isPending}
              onClick={createInvoice}
            />
          </>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">{success}</div>
      )}
    </div>
  );
}

type ActionButtonProps = {
  label: string;
  pendingLabel: string;
  icon: typeof Send;
  isPending: boolean;
  onClick: () => void;
  variant?: React.ComponentProps<typeof Button>["variant"];
};

function ActionButton({
  label,
  pendingLabel,
  icon: Icon,
  isPending,
  onClick,
  variant,
}: ActionButtonProps) {
  return (
    <Button type="button" variant={variant} disabled={isPending} onClick={onClick}>
      <Icon className="h-4 w-4" />

      {isPending ? pendingLabel : label}
    </Button>
  );
}
