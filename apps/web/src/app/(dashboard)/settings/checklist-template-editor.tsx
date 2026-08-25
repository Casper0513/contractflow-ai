"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  ChecklistTemplate,
  ChecklistTemplateItemInput,
} from "@/lib/checklist-templates-api";

import {
  createChecklistTemplateAction,
  updateChecklistTemplateAction,
} from "./checklist-template-actions";

type EditorItem = {
  key: string;
  title: string;
  description: string;
  required: boolean;
};

type ChecklistTemplateEditorProps =
  | {
      mode: "create";
      template?: never;
      onCancel: () => void;
      onSaved: (template: ChecklistTemplate) => void;
    }
  | {
      mode: "edit";
      template: ChecklistTemplate;
      onCancel: () => void;
      onSaved: (template: ChecklistTemplate) => void;
    };

export function ChecklistTemplateEditor(props: ChecklistTemplateEditorProps) {
  const [name, setName] = useState(props.mode === "edit" ? props.template.name : "");
  const [description, setDescription] = useState(
    props.mode === "edit" ? (props.template.description ?? "") : "",
  );
  const [active, setActive] = useState(
    props.mode === "edit" ? props.template.active : true,
  );
  const [items, setItems] = useState<EditorItem[]>(() =>
    props.mode === "edit"
      ? props.template.items.map((item) => ({
          key: item.id,
          title: item.title,
          description: item.description ?? "",
          required: item.required,
        }))
      : [newEditorItem()],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function addItem() {
    setItems((current) => [...current, newEditorItem()]);
  }

  function updateItem(
    key: string,
    field: "title" | "description" | "required",
    value: string | boolean,
  ) {
    setItems((current) =>
      current.map((item) =>
        item.key === key
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    );
  }

  function removeItem(key: string) {
    setItems((current) => current.filter((item) => item.key !== key));
  }

  function moveItem(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;

    if (targetIndex < 0 || targetIndex >= items.length) {
      return;
    }

    setItems((current) => {
      const next = [...current];
      const currentItem = next[index];
      const targetItem = next[targetIndex];

      if (!currentItem || !targetItem) {
        return current;
      }

      next[index] = targetItem;
      next[targetIndex] = currentItem;

      return next;
    });
  }

  function save() {
    setError(null);

    const normalizedName = name.trim();

    if (!normalizedName) {
      setError("Template name is required.");
      return;
    }

    const normalizedItems = items
      .map((item, index): ChecklistTemplateItemInput | null => {
        const title = item.title.trim();

        if (!title) {
          return null;
        }

        return {
          title,
          description: item.description.trim() || undefined,
          position: index,
          required: item.required,
        };
      })
      .filter((item): item is ChecklistTemplateItemInput => item !== null);

    if (normalizedItems.length === 0) {
      setError("Add at least one checklist item.");
      return;
    }

    const input = {
      name: normalizedName,
      description: description.trim() || undefined,
      active,
      items: normalizedItems,
    };

    startTransition(async () => {
      const result =
        props.mode === "create"
          ? await createChecklistTemplateAction(input)
          : await updateChecklistTemplateAction(props.template.id, input);

      if (!result.success) {
        setError(result.error);
        return;
      }

      props.onSaved(result.data);
    });
  }

  return (
    <div className="space-y-6 rounded-xl border bg-muted/10 p-4 sm:p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="font-semibold">
            {props.mode === "create"
              ? "Create checklist template"
              : "Edit checklist template"}
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            Define the reusable workflow that can be copied onto jobs.
          </p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={props.onCancel}
          disabled={pending}
        >
          <X className="h-4 w-4" />
          Cancel
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="checklist-template-name" className="text-sm font-medium">
            Template name
          </label>

          <Input
            id="checklist-template-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={pending}
            maxLength={255}
            placeholder="Job completion checklist"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Status</label>

          <label className="flex h-9 items-center gap-3 rounded-md border px-3">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
              disabled={pending}
              className="h-4 w-4"
            />

            <span className="text-sm">Active and available for jobs</span>
          </label>
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="checklist-template-description" className="text-sm font-medium">
            Description
          </label>

          <textarea
            id="checklist-template-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={pending}
            maxLength={2000}
            rows={3}
            placeholder="Describe when this checklist should be used."
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">Checklist items</p>

            <p className="mt-1 text-sm text-muted-foreground">
              Items are copied to the job in this order.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addItem}
            disabled={pending}
          >
            <Plus className="h-4 w-4" />
            Add item
          </Button>
        </div>

        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No checklist items. Add at least one item before saving.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={item.key} className="rounded-xl border bg-background p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs text-muted-foreground">
                    {index + 1}
                  </div>

                  <div className="min-w-0 flex-1 space-y-3">
                    <Input
                      value={item.title}
                      onChange={(event) =>
                        updateItem(item.key, "title", event.target.value)
                      }
                      disabled={pending}
                      maxLength={255}
                      placeholder="Checklist item"
                    />

                    <textarea
                      value={item.description}
                      onChange={(event) =>
                        updateItem(item.key, "description", event.target.value)
                      }
                      disabled={pending}
                      maxLength={2000}
                      rows={2}
                      placeholder="Optional instructions or details"
                      className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />

                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={item.required}
                        onChange={(event) =>
                          updateItem(item.key, "required", event.target.checked)
                        }
                        disabled={pending}
                        className="h-4 w-4"
                      />
                      Required before job completion
                    </label>
                  </div>

                  <div className="flex shrink-0 flex-col gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Move item up"
                      disabled={pending || index === 0}
                      onClick={() => moveItem(index, -1)}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Move item down"
                      disabled={pending || index === items.length - 1}
                      onClick={() => moveItem(index, 1)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove item"
                      disabled={pending}
                      onClick={() => removeItem(item.key)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t pt-5">
        <Button
          type="button"
          variant="outline"
          onClick={props.onCancel}
          disabled={pending}
        >
          Cancel
        </Button>

        <Button type="button" onClick={save} disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              {props.mode === "create" ? "Create template" : "Save changes"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

let editorItemCounter = 0;

function newEditorItem(): EditorItem {
  editorItemCounter += 1;

  return {
    key: `new-${editorItemCounter}`,
    title: "",
    description: "",
    required: false,
  };
}
