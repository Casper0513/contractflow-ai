"use client";

import type { DragEvent } from "react";
import {
  CalendarClock,
  CircleAlert,
  GripVertical,
  Lightbulb,
  Loader2,
  MapPin,
  Sparkles,
  UserRound,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { Job, JobPriority, JobStatus } from "@/lib/jobs-api";

export type DispatchBacklogDragPayload = {
  kind: "backlog";
  jobId: string;
};

export type DispatchSuggestion = {
  rank: number;
  crewMemberId: string;
  crewMemberName: string;
  date: string;
  utilizationPercent: number;
  remainingMinutes: number;
  reason: string;
};

export type DispatchAiReview = {
  recommendedRank: number;
  reason: string;
  caution: string | null;
};

type DispatchBacklogProps = {
  jobs: Job[];
  disabled?: boolean;
  suggestions?: Record<string, DispatchSuggestion[]>;
  aiReviews?: Record<string, DispatchAiReview>;
  aiLoadingJobId?: string | null;
  aiErrors?: Record<string, string>;
  onReviewSuggestionsWithAi?: (jobId: string, suggestions: DispatchSuggestion[]) => void;
  onAcceptSuggestion?: (jobId: string, suggestion: DispatchSuggestion) => void;
  onDragStart: (payload: DispatchBacklogDragPayload) => void;
  onDragEnd: () => void;
};

const DRAG_TYPE = "application/x-contractflow-dispatch";

export function DispatchBacklog({
  jobs,
  disabled = false,
  suggestions = {},
  aiReviews = {},
  aiLoadingJobId = null,
  aiErrors = {},
  onReviewSuggestionsWithAi,
  onAcceptSuggestion,
  onDragStart,
  onDragEnd,
}: DispatchBacklogProps) {
  return (
    <div className="rounded-xl border bg-background">
      <div className="flex flex-col gap-2 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />

            <h2 className="font-semibold">Dispatch backlog</h2>

            <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
              {jobs.length}
            </span>
          </div>

          <p className="mt-1 text-xs text-muted-foreground">
            Drag a job onto a crew/date cell or use the recommended assignment.
          </p>
        </div>

        {jobs.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Smart assignment suggestions enabled
          </p>
        ) : null}
      </div>

      {jobs.length === 0 ? (
        <div className="flex min-h-32 flex-col items-center justify-center px-6 py-8 text-center">
          <CalendarClock className="h-8 w-8 text-muted-foreground/50" />

          <p className="mt-3 text-sm font-medium">No jobs waiting for dispatch</p>

          <p className="mt-1 max-w-md text-xs text-muted-foreground">
            Approved and active jobs without scheduled work will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {jobs.map((job) => (
            <BacklogJobCard
              key={job.id}
              job={job}
              suggestions={suggestions[job.id]}
              aiReview={aiReviews[job.id]}
              aiLoading={aiLoadingJobId === job.id}
              aiError={aiErrors[job.id]}
              disabled={disabled}
              onReviewSuggestionsWithAi={onReviewSuggestionsWithAi}
              onAcceptSuggestion={onAcceptSuggestion}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BacklogJobCard({
  job,
  suggestions = [],
  aiReview,
  aiLoading,
  aiError,
  disabled,
  onReviewSuggestionsWithAi,
  onAcceptSuggestion,
  onDragStart,
  onDragEnd,
}: {
  job: Job;
  suggestions?: DispatchSuggestion[];
  aiReview?: DispatchAiReview;
  aiLoading: boolean;
  aiError?: string;
  disabled: boolean;
  onReviewSuggestionsWithAi?: (jobId: string, suggestions: DispatchSuggestion[]) => void;
  onAcceptSuggestion?: (jobId: string, suggestion: DispatchSuggestion) => void;
  onDragStart: (payload: DispatchBacklogDragPayload) => void;
  onDragEnd: () => void;
}) {
  const address = formatJobAddress(job);
  const customer = customerName(job);

  const requestedDate = job.startDate
    ? parseJobCalendarDate(job.startDate).toLocaleDateString("en-CA", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  function startDrag(event: DragEvent<HTMLDivElement>) {
    if (disabled) {
      event.preventDefault();
      return;
    }

    const payload: DispatchBacklogDragPayload = {
      kind: "backlog",
      jobId: job.id,
    };

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload));
    event.dataTransfer.setData("text/plain", job.name);

    onDragStart(payload);
  }

  return (
    <div
      draggable={!disabled}
      onDragStart={startDrag}
      onDragEnd={onDragEnd}
      className={`group rounded-xl border bg-background p-4 shadow-sm transition-all ${
        disabled
          ? "cursor-default opacity-60"
          : "cursor-grab hover:bg-muted/20 active:cursor-grabbing"
      }`}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground opacity-50 transition-opacity group-hover:opacity-100" />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link
                href={`/jobs/${job.id}`}
                draggable={false}
                className="block truncate text-sm font-semibold hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                {job.name}
              </Link>

              <p className="mt-1 truncate text-xs text-muted-foreground">{customer}</p>
            </div>

            <PriorityBadge priority={job.priority} />
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <UserRound className="h-3.5 w-3.5 shrink-0" />
              <span>{formatStatus(job.status)}</span>
            </div>

            {requestedDate ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Requested start: {requestedDate}</span>
              </div>
            ) : null}

            {address ? (
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="line-clamp-2">{address}</span>
              </div>
            ) : null}
          </div>

          {suggestions.length > 0 ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  Deterministic dispatch candidates
                </div>

                {onReviewSuggestionsWithAi ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={disabled || aiLoading}
                    draggable={false}
                    className="h-7 text-xs"
                    onClick={(event) => {
                      event.stopPropagation();
                      onReviewSuggestionsWithAi(job.id, suggestions);
                    }}
                  >
                    {aiLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}

                    {aiLoading
                      ? "Reviewing..."
                      : aiReview
                        ? "Review again with AI"
                        : "Ask AI to review options"}
                  </Button>
                ) : null}
              </div>

              {aiError ? (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
                >
                  {aiError}
                </div>
              ) : null}

              {aiReview ? (
                <div className="rounded-lg border bg-background p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <Sparkles className="h-3.5 w-3.5" />
                    ContractFlow AI recommends option #{aiReview.recommendedRank}
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">{aiReview.reason}</p>

                  {aiReview.caution ? (
                    <p className="mt-2 text-xs text-amber-700">
                      Caution: {aiReview.caution}
                    </p>
                  ) : null}

                  <p className="mt-2 text-[11px] text-muted-foreground">
                    AI has not scheduled or assigned anyone. Review the option before
                    dispatching.
                  </p>
                </div>
              ) : null}

              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                <div className="flex items-start gap-2">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-blue-700">
                      Ranked assignment options
                    </p>

                    <div className="mt-2 space-y-2">
                      {suggestions.map((suggestion) => (
                        <div
                          key={`${suggestion.crewMemberId}-${suggestion.date}`}
                          className={`rounded-md border p-2 ${
                            aiReview?.recommendedRank === suggestion.rank
                              ? "border-primary/40 bg-primary/5"
                              : suggestion.rank === 1
                                ? "border-blue-500/30 bg-background"
                                : "bg-background/60"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-medium">
                                #{suggestion.rank} {suggestion.crewMemberName} ·{" "}
                                {formatSuggestionDate(suggestion.date)}
                              </p>

                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {suggestion.reason}
                              </p>

                              <p className="mt-1 text-[11px] text-muted-foreground">
                                Projected {suggestion.utilizationPercent}% utilized ·{" "}
                                {formatMinutes(suggestion.remainingMinutes)} capacity
                                remaining
                              </p>
                            </div>

                            {aiReview?.recommendedRank === suggestion.rank ? (
                              <span className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                AI pick
                              </span>
                            ) : suggestion.rank === 1 ? (
                              <span className="shrink-0 rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                                Deterministic best
                              </span>
                            ) : null}
                          </div>

                          {onAcceptSuggestion ? (
                            <Button
                              type="button"
                              size="sm"
                              variant={suggestion.rank === 1 ? "default" : "outline"}
                              disabled={disabled}
                              draggable={false}
                              className="mt-2 h-7 text-xs"
                              onClick={(event) => {
                                event.stopPropagation();
                                onAcceptSuggestion(job.id, suggestion);
                              }}
                            >
                              Schedule option #{suggestion.rank}
                            </Button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
              No conflict-free recommendation in this view.
            </div>
          )}

          {job.priority === "URGENT" ? (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-2.5 py-2 text-xs text-destructive">
              <CircleAlert className="h-3.5 w-3.5 shrink-0" />
              Urgent dispatch
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: JobPriority }) {
  const styles: Record<JobPriority, string> = {
    LOW: "border-slate-500/20 bg-slate-500/10 text-slate-600",
    NORMAL: "border-blue-500/20 bg-blue-500/10 text-blue-600",
    HIGH: "border-amber-500/20 bg-amber-500/10 text-amber-700",
    URGENT: "border-red-500/20 bg-red-500/10 text-red-600",
  };

  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${styles[priority]}`}
    >
      {formatStatus(priority)}
    </span>
  );
}

function customerName(job: Job) {
  if (job.customer.companyName) {
    return job.customer.companyName;
  }

  const name = [job.customer.firstName, job.customer.lastName].filter(Boolean).join(" ");

  return name || "Customer";
}

function formatJobAddress(job: Job) {
  const street = [job.addressLine1, job.addressLine2].filter(Boolean).join(", ");

  const locality = [job.city, job.province, job.postalCode].filter(Boolean).join(", ");

  return [street, locality].filter(Boolean).join(" · ");
}

function formatStatus(value: JobStatus | JobPriority) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseJobCalendarDate(value: string) {
  const datePart = value.slice(0, 10);

  const [year, month, day] = datePart.split("-").map(Number);

  return new Date(year, month - 1, day);
}

function formatSuggestionDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day).toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatMinutes(minutes: number) {
  if (minutes <= 0) {
    return "0m";
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (hours === 0) {
    return `${remainder}m`;
  }

  if (remainder === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainder}m`;
}
