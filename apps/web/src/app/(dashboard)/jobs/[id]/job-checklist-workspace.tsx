"use client";

import { useMemo, useState, useTransition } from "react";
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
import type {
  JobChecklist,
  JobChecklistItem,
  JobChecklistUser,
} from "@/lib/job-checklists-api";

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
  /*
   * Only active templates may be applied to jobs.
   */
  const activeTemplates = useMemo(
    () => templates.filter((template) => template.active),
    [templates],
  );

  /*
   * Checklists created from templates retain sourceTemplateId.
   * This lets us remove templates that have already been applied
   * to this job from the selector.
   */
  const appliedTemplateIds = useMemo(
    () =>
      new Set(
        checklists
          .map((checklist) => checklist.sourceTemplateId)
          .filter((templateId): templateId is string => Boolean(templateId)),
      ),
    [checklists],
  );

  /*
   * Only active templates that have not already been applied
   * should be selectable.
   */
  const availableTemplates = useMemo(
    () => activeTemplates.filter((template) => !appliedTemplateIds.has(template.id)),
    [activeTemplates, appliedTemplateIds],
  );

  /*
   * Store the user's explicit selection.
   *
   * This value can temporarily become stale when the selected
   * template is applied and disappears from availableTemplates.
   */
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    availableTemplates[0]?.id ?? "",
  );

  /*
   * Never submit a stale template id.
   *
   * If the stored selection is no longer available, automatically
   * use the first available template instead.
   *
   * This avoids setState inside useEffect and satisfies the
   * react-hooks/set-state-in-effect lint rule.
   */
  const effectiveSelectedTemplateId = availableTemplates.some(
    (template) => template.id === selectedTemplateId,
  )
    ? selectedTemplateId
    : (availableTemplates[0]?.id ?? "");

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
    if (!effectiveSelectedTemplateId) {
      setMessage({
        success: false,
        text: "Select a checklist template first.",
      });

      return;
    }

    /*
     * Capture the current effective id so the async action cannot
     * accidentally use a different selection after rendering changes.
     */
    const templateIdBeingApplied = effectiveSelectedTemplateId;

    setMessage(null);
    setPendingKey("apply");

    startTransition(async () => {
      const result = await applyChecklistTemplateAction(jobId, {
        templateId: templateIdBeingApplied,
      });

      setPendingKey(null);

      if (!result.success) {
        setMessage({
          success: false,
          text: result.error,
        });

        return;
      }

      setExpandedIds((current) =>
        current.includes(result.data.id) ? current : [...current, result.data.id],
      );

      /*
       * Immediately advance the stored selection to the next template.
       *
       * The derived effectiveSelectedTemplateId also protects us while
       * refreshed server props are arriving.
       */
      const nextTemplate = availableTemplates.find(
        (template) => template.id !== templateIdBeingApplied,
      );

      setSelectedTemplateId(nextTemplate?.id ?? "");

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

      setExpandedIds((current) => current.filter((id) => id !== checklist.id));

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

              {availableTemplates.length > 0 ? (
                <select
                  id="job-checklist-template"
                  value={effectiveSelectedTemplateId}
                  onChange={(event) => setSelectedTemplateId(event.target.value)}
                  disabled={pending}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {availableTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} ({template.items.length} item
                      {template.items.length === 1 ? "" : "s"})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                  {activeTemplates.length === 0
                    ? "No active checklist templates are available. Create or activate one in Settings."
                    : "All active checklist templates have already been applied to this job."}
                </div>
              )}
            </div>

            <Button
              type="button"
              onClick={applyTemplate}
              disabled={
                pending || availableTemplates.length === 0 || !effectiveSelectedTemplateId
              }
            >
              {pending && pendingKey === "apply" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Apply template
            </Button>
          </div>

          {effectiveSelectedTemplateId && (
            <TemplateDescription
              template={availableTemplates.find(
                (template) => template.id === effectiveSelectedTemplateId,
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
        {requiredCount > 0 ? ` · ${requiredCount} required` : ""}
      </p>
    </div>
  );
}

function formatUserName(user: JobChecklistUser) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();

  return name || user.email;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
