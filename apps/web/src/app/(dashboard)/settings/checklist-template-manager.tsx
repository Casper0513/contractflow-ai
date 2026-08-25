"use client";

import { useState, useTransition } from "react";
import {
  Archive,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Loader2,
  LockKeyhole,
  Pencil,
  Plus,
  Power,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ChecklistTemplate } from "@/lib/checklist-templates-api";

import {
  activateChecklistTemplateAction,
  deactivateChecklistTemplateAction,
  deleteChecklistTemplateAction,
} from "./checklist-template-actions";
import { ChecklistTemplateEditor } from "./checklist-template-editor";

type ChecklistTemplateManagerProps = {
  templates: ChecklistTemplate[];
  canEdit: boolean;
};

export function ChecklistTemplateManager({
  templates,
  canEdit,
}: ChecklistTemplateManagerProps) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [message, setMessage] = useState<{
    success: boolean;
    text: string;
  } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleExpanded(templateId: string) {
    setExpandedIds((current) =>
      current.includes(templateId)
        ? current.filter((id) => id !== templateId)
        : [...current, templateId],
    );
  }

  function handleActivate(template: ChecklistTemplate) {
    setPendingId(template.id);
    setMessage(null);

    startTransition(async () => {
      const result = await activateChecklistTemplateAction(template.id);

      setPendingId(null);

      if (!result.success) {
        setMessage({
          success: false,
          text: result.error,
        });
        return;
      }

      setMessage({
        success: true,
        text: `"${result.data.name}" is now active.`,
      });
    });
  }

  function handleDeactivate(template: ChecklistTemplate) {
    setPendingId(template.id);
    setMessage(null);

    startTransition(async () => {
      const result = await deactivateChecklistTemplateAction(template.id);

      setPendingId(null);

      if (!result.success) {
        setMessage({
          success: false,
          text: result.error,
        });
        return;
      }

      setMessage({
        success: true,
        text: `"${result.data.name}" is now inactive.`,
      });
    });
  }

  function handleDelete(template: ChecklistTemplate) {
    const confirmed = window.confirm(
      `Delete "${template.name}"?\n\nExisting job checklists created from this template will remain unchanged.`,
    );

    if (!confirmed) {
      return;
    }

    setPendingId(template.id);
    setMessage(null);

    startTransition(async () => {
      const result = await deleteChecklistTemplateAction(template.id);

      setPendingId(null);

      if (!result.success) {
        setMessage({
          success: false,
          text: result.error,
        });
        return;
      }

      if (editingId === template.id) {
        setEditingId(null);
      }

      setMessage({
        success: true,
        text: `"${template.name}" was deleted.`,
      });
    });
  }

  const activeCount = templates.filter((template) => template.active).length;
  const totalItems = templates.reduce(
    (total, template) => total + template.items.length,
    0,
  );

  return (
    <div className="space-y-6">
      {!canEdit && (
        <div className="flex gap-3 rounded-xl border bg-muted/30 p-4">
          <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />

          <div>
            <p className="font-medium">Checklist templates are read-only</p>

            <p className="mt-1 text-sm text-muted-foreground">
              Only organization owners and administrators can create or modify checklist
              templates.
            </p>
          </div>
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

      <div className="grid gap-3 sm:grid-cols-3">
        <TemplateStat label="Templates" value={templates.length} icon={ClipboardCheck} />

        <TemplateStat label="Active" value={activeCount} icon={Power} />

        <TemplateStat label="Total items" value={totalItems} icon={CheckCircle2} />
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => {
              setCreating(true);
              setEditingId(null);
              setMessage(null);
            }}
            disabled={creating || pending}
          >
            <Plus className="h-4 w-4" />
            New template
          </Button>
        </div>
      )}

      {creating && (
        <ChecklistTemplateEditor
          mode="create"
          onCancel={() => setCreating(false)}
          onSaved={(template) => {
            setCreating(false);
            setMessage({
              success: true,
              text: `"${template.name}" was created.`,
            });
          }}
        />
      )}

      {templates.length === 0 && !creating ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <ClipboardCheck className="mx-auto h-8 w-8 text-muted-foreground" />

          <p className="mt-3 font-medium">No checklist templates yet</p>

          <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">
            Create reusable checklists for common workflows such as job starts, site
            inspections, completion walkthroughs, or closeout procedures.
          </p>

          {canEdit && (
            <Button type="button" className="mt-5" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              Create first template
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => {
            const expanded = expandedIds.includes(template.id);
            const editing = editingId === template.id;
            const rowPending = pending && pendingId === template.id;

            return (
              <div key={template.id} className="rounded-xl border">
                <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    onClick={() => toggleExpanded(template.id)}
                  >
                    <div className="mt-0.5 rounded-lg border bg-muted/30 p-2">
                      <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{template.name}</p>

                        <Badge variant={template.active ? "default" : "secondary"}>
                          {template.active ? "Active" : "Inactive"}
                        </Badge>
                      </div>

                      <p className="mt-1 text-sm text-muted-foreground">
                        {template.description || "No description"}
                      </p>

                      <p className="mt-2 text-xs text-muted-foreground">
                        {template.items.length} item
                        {template.items.length === 1 ? "" : "s"} ·{" "}
                        {template.items.filter((item) => item.required).length} required
                      </p>
                    </div>
                  </button>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => toggleExpanded(template.id)}
                    >
                      {expanded ? (
                        <>
                          <ChevronUp className="h-4 w-4" />
                          Hide items
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" />
                          View items
                        </>
                      )}
                    </Button>

                    {canEdit && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={pending}
                          onClick={() => {
                            setCreating(false);
                            setEditingId(editing ? null : template.id);
                            setMessage(null);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>

                        {template.active ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={pending}
                            onClick={() => handleDeactivate(template)}
                          >
                            {rowPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Archive className="h-4 w-4" />
                            )}
                            Deactivate
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={pending}
                            onClick={() => handleActivate(template)}
                          >
                            {rowPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Power className="h-4 w-4" />
                            )}
                            Activate
                          </Button>
                        )}

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={pending}
                          onClick={() => handleDelete(template)}
                          className="text-destructive hover:text-destructive"
                        >
                          {rowPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {expanded && !editing && <TemplateItemPreview template={template} />}

                {editing && (
                  <div className="border-t p-4">
                    <ChecklistTemplateEditor
                      mode="edit"
                      template={template}
                      onCancel={() => setEditingId(null)}
                      onSaved={(updatedTemplate) => {
                        setEditingId(null);
                        setMessage({
                          success: true,
                          text: `"${updatedTemplate.name}" was updated.`,
                        });
                      }}
                    />
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

function TemplateItemPreview({ template }: { template: ChecklistTemplate }) {
  return (
    <div className="border-t bg-muted/10 p-4">
      {template.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          This template does not contain any checklist items.
        </p>
      ) : (
        <div className="space-y-2">
          {template.items.map((item, index) => (
            <div
              key={item.id}
              className="flex items-start gap-3 rounded-lg border bg-background p-3"
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs text-muted-foreground">
                {index + 1}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{item.title}</p>

                  {item.required && <Badge variant="secondary">Required</Badge>}
                </div>

                {item.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof ClipboardCheck;
}) {
  return (
    <div className="rounded-xl border bg-muted/10 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-sm">{label}</span>
      </div>

      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
