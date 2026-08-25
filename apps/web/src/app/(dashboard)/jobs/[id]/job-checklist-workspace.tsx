"use client";

import { useState, useTransition } from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ChecklistTemplate } from "@/lib/checklist-templates-api";
import type { JobChecklist, JobChecklistItem } from "@/lib/job-checklists-api";

import {
  applyChecklistTemplateAction,
  completeJobChecklistItemAction,
  deleteJobChecklistAction,
  reopenJobChecklistItemAction,
} from "./job-checklist-actions";

type JobChecklistWorkspaceProps = {
  jobId: string;
  archived: boolean;
  checklists: JobChecklist[];
  templates: ChecklistTemplate[];
};

export function JobChecklistWorkspace({
  jobId,
  archived,
  checklists,
  templates,
}: JobChecklistWorkspaceProps) {
  const activeTemplates = templates.filter((template) => template.active);

  const [selectedTemplateId, setSelectedTemplateId] = useState(
    activeTemplates[0]?.id ?? "",
  );
  const [expandedIds, setExpandedIds] = useState<string[]>(
    checklists.map((checklist) => checklist.id),
  );
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    success: boolean;
    text: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleExpanded(checklistId: string) {
    setExpandedIds((current) =>
      current.includes(checklistId)
        ? current.filter((id) => id !== checklistId)
        : [...current, checklistId],
    );
  }

  function applyTemplate() {
    if (!selectedTemplateId) {
      setMessage({
        success: false,
        text: "Select a checklist template first.",
      });
      return;
    }

    setMessage(null);
    setPendingKey("apply");

    startTransition(async () => {
      const result = await applyChecklistTemplateAction(jobId, {
        templateId: selectedTemplateId,
      });

      setPendingKey(null);

      if (!result.success) {
        setMessage({
          success: false,
          text: result.error,
        });
        return;
      }

      setExpandedIds((current) => [...current, result.data.id]);

      setMessage({
        success: true,
        text: `"${result.data.name}" was added to this job.`,
      });
    });
  }

  function completeItem(checklistId: string, item: JobChecklistItem) {
    const key = `complete:${item.id}`;

    setMessage(null);
    setPendingKey(key);

    startTransition(async () => {
      const result = await completeJobChecklistItemAction(jobId, checklistId, item.id);

      setPendingKey(null);

      if (!result.success) {
        setMessage({
          success: false,
          text: result.error,
        });
      }
    });
  }

  function reopenItem(checklistId: string, item: JobChecklistItem) {
    const key = `reopen:${item.id}`;

    setMessage(null);
    setPendingKey(key);

    startTransition(async () => {
      const result = await reopenJobChecklistItemAction(jobId, checklistId, item.id);

      setPendingKey(null);

      if (!result.success) {
        setMessage({
          success: false,
          text: result.error,
        });
      }
    });
  }

  function deleteChecklist(checklist: JobChecklist) {
    const confirmed = window.confirm(
      `Delete "${checklist.name}" from this job?\n\nIts completion history will also be removed.`,
    );

    if (!confirmed) {
      return;
    }

    const key = `delete:${checklist.id}`;

    setMessage(null);
    setPendingKey(key);

    startTransition(async () => {
      const result = await deleteJobChecklistAction(jobId, checklist.id);

      setPendingKey(null);

      if (!result.success) {
        setMessage({
          success: false,
          text: result.error,
        });
        return;
      }

      setMessage({
        success: true,
        text: `"${checklist.name}" was removed from this job.`,
      });
    });
  }

  return (
    <div className="space-y-5">
      {!archived && (
        <div className="rounded-xl border bg-muted/10 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="min-w-0 flex-1 space-y-2">
              <label htmlFor="job-checklist-template" className="text-sm font-medium">
                Apply checklist template
              </label>

              {activeTemplates.length > 0 ? (
                <select
                  id="job-checklist-template"
                  value={selectedTemplateId}
                  onChange={(event) => setSelectedTemplateId(event.target.value)}
                  disabled={pending}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {activeTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} ({template.items.length} item
                      {template.items.length === 1 ? "" : "s"})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                  No active checklist templates are available. Create or activate one in
                  Settings.
                </div>
              )}
            </div>

            <Button
              type="button"
              onClick={applyTemplate}
              disabled={pending || activeTemplates.length === 0 || !selectedTemplateId}
            >
              {pending && pendingKey === "apply" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Apply template
            </Button>
          </div>

          {selectedTemplateId && (
            <TemplateDescription
              template={activeTemplates.find(
                (template) => template.id === selectedTemplateId,
              )}
            />
          )}
        </div>
      )}

      {message && (
        <div
          role={message.success ? "status" : "alert"}
          className={`rounded-xl border p-4 text-sm ${
            message.success
              ? "border-green-500/30 bg-green-500/10 text-green-700"
              : "border-destructive/30 bg-destructive/5 text-destructive"
          }`}
        >
          <div className="flex items-start gap-2">
            {message.success && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}

            <span>{message.text}</span>
          </div>
        </div>
      )}

      {checklists.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <ClipboardCheck className="mx-auto h-8 w-8 text-muted-foreground" />

          <p className="mt-3 font-medium">No checklists on this job</p>

          <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">
            Apply a reusable checklist template to track inspections, preparation,
            completion steps, or other repeatable workflows.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {checklists.map((checklist) => {
            const expanded = expandedIds.includes(checklist.id);
            const completedCount = checklist.items.filter(
              (item) => item.completedAt,
            ).length;
            const requiredItems = checklist.items.filter((item) => item.required);
            const completedRequired = requiredItems.filter(
              (item) => item.completedAt,
            ).length;

            const progress =
              checklist.items.length > 0
                ? Math.round((completedCount / checklist.items.length) * 100)
                : 0;

            return (
              <div key={checklist.id} className="overflow-hidden rounded-xl border">
                <div className="p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-start gap-3 text-left"
                      onClick={() => toggleExpanded(checklist.id)}
                    >
                      <div className="mt-0.5 rounded-lg border bg-muted/30 p-2">
                        <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{checklist.name}</p>

                          {progress === 100 && checklist.items.length > 0 && (
                            <Badge variant="default">Complete</Badge>
                          )}

                          {requiredItems.length > 0 && (
                            <Badge variant="secondary">
                              {completedRequired}/{requiredItems.length} required
                            </Badge>
                          )}
                        </div>

                        {checklist.description && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {checklist.description}
                          </p>
                        )}

                        <p className="mt-2 text-xs text-muted-foreground">
                          {completedCount} of {checklist.items.length} complete
                        </p>
                      </div>
                    </button>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => toggleExpanded(checklist.id)}
                      >
                        {expanded ? (
                          <>
                            <ChevronUp className="h-4 w-4" />
                            Collapse
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4" />
                            Open
                          </>
                        )}
                      </Button>

                      {!archived && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={pending}
                          onClick={() => deleteChecklist(checklist)}
                        >
                          {pending && pendingKey === `delete:${checklist.id}` ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
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
                </div>

                {expanded && (
                  <div className="border-t bg-muted/10 p-4">
                    {checklist.items.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        This checklist does not contain any items.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {checklist.items.map((item, index) => (
                          <ChecklistItemRow
                            key={item.id}
                            jobId={jobId}
                            checklistId={checklist.id}
                            item={item}
                            index={index}
                            archived={archived}
                            pending={pending}
                            pendingKey={pendingKey}
                            onComplete={completeItem}
                            onReopen={reopenItem}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChecklistItemRow({
  checklistId,
  item,
  index,
  archived,
  pending,
  pendingKey,
  onComplete,
  onReopen,
}: {
  jobId: string;
  checklistId: string;
  item: JobChecklistItem;
  index: number;
  archived: boolean;
  pending: boolean;
  pendingKey: string | null;
  onComplete: (checklistId: string, item: JobChecklistItem) => void;
  onReopen: (checklistId: string, item: JobChecklistItem) => void;
}) {
  const completed = Boolean(item.completedAt);

  const itemPending =
    pending &&
    (pendingKey === `complete:${item.id}` || pendingKey === `reopen:${item.id}`);

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border bg-background p-3 sm:flex-row sm:items-start ${
        completed ? "opacity-75" : ""
      }`}
    >
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs ${
          completed ? "bg-primary text-primary-foreground" : "text-muted-foreground"
        }`}
      >
        {completed ? <Check className="h-4 w-4" /> : index + 1}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={`text-sm font-medium ${completed ? "line-through" : ""}`}>
            {item.title}
          </p>

          {item.required && <Badge variant="secondary">Required</Badge>}
        </div>

        {item.description && (
          <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
        )}

        {completed && (
          <p className="mt-2 text-xs text-muted-foreground">
            Completed
            {item.completedBy ? ` by ${formatUserName(item.completedBy)}` : ""}
            {item.completedAt ? ` · ${formatDateTime(item.completedAt)}` : ""}
          </p>
        )}
      </div>

      {!archived && (
        <div className="shrink-0">
          {completed ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => onReopen(checklistId, item)}
            >
              {itemPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Reopen
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => onComplete(checklistId, item)}
            >
              {itemPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Complete
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function TemplateDescription({ template }: { template: ChecklistTemplate | undefined }) {
  if (!template) {
    return null;
  }

  const requiredCount = template.items.filter((item) => item.required).length;

  return (
    <div className="mt-3 text-sm text-muted-foreground">
      {template.description && <p>{template.description}</p>}

      <p className={template.description ? "mt-1" : ""}>
        {template.items.length} item
        {template.items.length === 1 ? "" : "s"}
        {requiredCount > 0 ? ` · ${requiredCount} required` : " · No required items"}
      </p>
    </div>
  );
}

function formatUserName(user: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");

  return name || user.email;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
