"use client";

import { FormEvent, useState } from "react";
import { Loader2, MessageSquareText, Pencil, Save, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { JobNote } from "@/lib/job-notes-api";

import {
  createJobNoteAction,
  deleteJobNoteAction,
  updateJobNoteAction,
} from "./job-note-actions";

export function JobNotesWorkspace({
  jobId,
  notes,
  archived,
}: {
  jobId: string;
  notes: JobNote[];
  archived: boolean;
}) {
  return (
    <div className="space-y-6">
      {!archived && <CreateNoteForm jobId={jobId} />}

      {notes.length === 0 ? (
        <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed">
          <div className="max-w-sm px-6 text-center">
            <MessageSquareText className="mx-auto h-9 w-9 text-muted-foreground" />

            <p className="mt-3 font-medium">No job notes yet</p>

            <p className="mt-1 text-sm text-muted-foreground">
              Add internal notes for measurements, site details, customer conversations,
              reminders, and crew information.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <JobNoteCard key={note.id} jobId={jobId} note={note} archived={archived} />
          ))}
        </div>
      )}
    </div>
  );
}

function CreateNoteForm({ jobId }: { jobId: string }) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError(null);
    setSuccess(null);

    const value = content.trim();

    if (!value) {
      setError("Enter a note first.");
      return;
    }

    setSaving(true);

    try {
      const result = await createJobNoteAction(jobId, {
        content: value,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      setContent("");
      setSuccess("Note added successfully.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to create note.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border bg-muted/20 p-4">
      <div>
        <h3 className="font-semibold">Add internal note</h3>

        <p className="mt-1 text-sm text-muted-foreground">
          Notes are visible inside this job workspace.
        </p>
      </div>

      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        rows={4}
        maxLength={10000}
        disabled={saving}
        placeholder="Add measurements, site details, customer conversations, reminders..."
        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {content.length.toLocaleString()} / 10,000
        </p>

        <Button type="submit" disabled={saving || content.trim().length === 0}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <MessageSquareText className="h-4 w-4" />
              Add note
            </>
          )}
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {success && <p className="text-sm text-green-700">{success}</p>}
    </form>
  );
}

function JobNoteCard({
  jobId,
  note,
  archived,
}: {
  jobId: string;
  note: JobNote;
  archived: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(note.content);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);

    const value = content.trim();

    if (!value) {
      setError("Note content cannot be empty.");
      return;
    }

    if (value === note.content) {
      setEditing(false);
      return;
    }

    setSaving(true);

    try {
      const result = await updateJobNoteAction(jobId, note.id, {
        content: value,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      setEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update note.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setError(null);
    setDeleting(true);

    try {
      const result = await deleteJobNoteAction(jobId, note.id);

      if (!result.success) {
        throw new Error(result.error);
      }
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Unable to delete note.",
      );
    } finally {
      setDeleting(false);
    }
  }

  function cancelEditing() {
    setContent(note.content);
    setEditing(false);
    setError(null);
  }

  return (
    <article className="rounded-xl border bg-background p-4">
      {editing ? (
        <div className="space-y-3">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={4}
            maxLength={10000}
            disabled={saving}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={cancelEditing}
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={saving || content.trim().length === 0}
              onClick={handleSave}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="whitespace-pre-wrap text-sm leading-6">{note.content}</p>

          <div className="mt-4 flex flex-col justify-between gap-3 border-t pt-3 sm:flex-row sm:items-center">
            <div className="text-xs text-muted-foreground">
              <span>{formatAuthor(note.createdBy)}</span>

              <span className="mx-2">•</span>

              <span>{formatDateTime(note.createdAt)}</span>

              {note.updatedAt !== note.createdAt && (
                <>
                  <span className="mx-2">•</span>
                  <span>Edited</span>
                </>
              )}
            </div>

            {!archived && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={deleting}
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={deleting}
                  onClick={handleDelete}
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Delete
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </article>
  );
}

function formatAuthor(author: JobNote["createdBy"]) {
  if (!author) {
    return "Unknown user";
  }

  const name = [author.firstName, author.lastName].filter(Boolean).join(" ");

  return name || author.email;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
