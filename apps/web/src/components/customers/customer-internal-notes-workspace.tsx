"use client";

import { useActionState, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Pencil,
  Plus,
  RotateCcw,
  StickyNote,
  Trash2,
  UserRound,
} from "lucide-react";

import {
  completeInternalFollowUpAction,
  createInternalNoteAction,
  deleteInternalNoteAction,
  reopenInternalFollowUpAction,
  updateInternalNoteAction,
  type InternalNoteActionState,
} from "@/app/(dashboard)/customers/[id]/internal-note-actions";
import { Button } from "@/components/ui/button";
import type { CustomerInternalNote } from "@/lib/customer-internal-notes-api";
import type { TeamMember } from "@/lib/team-members-api";

type Props = {
  customerId: string;
  notes: CustomerInternalNote[];
  teamMembers: TeamMember[];
  archived: boolean;
};

type Filter = "ALL" | "NOTES" | "OPEN" | "OVERDUE" | "COMPLETED";

const initialActionState: InternalNoteActionState = {
  success: false,
  message: "",
};

export function CustomerInternalNotesWorkspace({
  customerId,
  notes,
  teamMembers,
  archived,
}: Props) {
  const [filter, setFilter] = useState<Filter>("ALL");

  const counts = useMemo(
    () => ({
      ALL: notes.length,

      NOTES: notes.filter((note) => note.kind === "NOTE").length,

      OPEN: notes.filter((note) => note.kind === "FOLLOW_UP" && !note.completedAt).length,

      OVERDUE: notes.filter(isOverdue).length,

      COMPLETED: notes.filter(
        (note) => note.kind === "FOLLOW_UP" && Boolean(note.completedAt),
      ).length,
    }),
    [notes],
  );

  const visibleNotes = useMemo(() => {
    switch (filter) {
      case "NOTES":
        return notes.filter((note) => note.kind === "NOTE");

      case "OPEN":
        return notes.filter((note) => note.kind === "FOLLOW_UP" && !note.completedAt);

      case "OVERDUE":
        return notes.filter(isOverdue);

      case "COMPLETED":
        return notes.filter(
          (note) => note.kind === "FOLLOW_UP" && Boolean(note.completedAt),
        );

      default:
        return notes;
    }
  }, [filter, notes]);

  return (
    <div className="space-y-6">
      {!archived && (
        <InternalNoteComposer customerId={customerId} teamMembers={teamMembers} />
      )}

      {notes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <FilterButton
            active={filter === "ALL"}
            onClick={() => setFilter("ALL")}
            label="All"
            count={counts.ALL}
          />

          <FilterButton
            active={filter === "NOTES"}
            onClick={() => setFilter("NOTES")}
            label="Notes"
            count={counts.NOTES}
          />

          <FilterButton
            active={filter === "OPEN"}
            onClick={() => setFilter("OPEN")}
            label="Open"
            count={counts.OPEN}
          />

          <FilterButton
            active={filter === "OVERDUE"}
            onClick={() => setFilter("OVERDUE")}
            label="Overdue"
            count={counts.OVERDUE}
          />

          <FilterButton
            active={filter === "COMPLETED"}
            onClick={() => setFilter("COMPLETED")}
            label="Completed"
            count={counts.COMPLETED}
          />
        </div>
      )}

      {notes.length === 0 ? (
        <EmptyState archived={archived} />
      ) : visibleNotes.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-10 text-center">
          <p className="font-medium">Nothing in this view</p>

          <p className="mt-1 text-sm text-muted-foreground">
            Choose another filter to see other notes and follow-ups.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleNotes.map((note) => (
            <InternalNoteItem
              key={note.id}
              customerId={customerId}
              note={note}
              teamMembers={teamMembers}
              archived={archived}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InternalNoteComposer({
  customerId,
  teamMembers,
}: {
  customerId: string;
  teamMembers: TeamMember[];
}) {
  const [kind, setKind] = useState<"NOTE" | "FOLLOW_UP">("NOTE");

  const action = createInternalNoteAction.bind(null, customerId);

  const [state, formAction, pending] = useActionState(action, initialActionState);

  return (
    <form action={formAction} className="rounded-xl border bg-muted/20 p-4">
      <input type="hidden" name="kind" value={kind} />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={kind === "NOTE" ? "default" : "outline"}
          onClick={() => setKind("NOTE")}
        >
          <StickyNote className="h-4 w-4" />
          Internal note
        </Button>

        <Button
          type="button"
          size="sm"
          variant={kind === "FOLLOW_UP" ? "default" : "outline"}
          onClick={() => setKind("FOLLOW_UP")}
        >
          <Clock3 className="h-4 w-4" />
          Follow-up
        </Button>
      </div>

      <textarea
        name="content"
        required
        maxLength={10000}
        placeholder={
          kind === "NOTE"
            ? "Add a private note for your team..."
            : "What needs to be followed up on?"
        }
        className="mt-4 min-h-28 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
      />

      {kind === "FOLLOW_UP" && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="follow-up-assignee" className="text-sm font-medium">
              Assignee
            </label>

            <select
              id="follow-up-assignee"
              name="assignedToUserId"
              defaultValue=""
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Unassigned</option>

              {teamMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {teamMemberLabel(member)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="follow-up-due" className="text-sm font-medium">
              Due date
            </label>

            <input
              id="follow-up-due"
              name="dueDate"
              type="date"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          <Plus className="h-4 w-4" />

          {pending ? "Saving..." : kind === "NOTE" ? "Add note" : "Add follow-up"}
        </Button>

        {state.message && (
          <span
            className={state.success ? "text-sm text-green-700" : "text-sm text-red-700"}
          >
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}

function InternalNoteItem({
  customerId,
  note,
  teamMembers,
  archived,
}: {
  customerId: string;
  note: CustomerInternalNote;
  teamMembers: TeamMember[];
  archived: boolean;
}) {
  const [editing, setEditing] = useState(false);

  const overdue = isOverdue(note);

  const creator = userLabel(note.createdBy);

  return (
    <article
      className={`rounded-xl border p-4 ${
        overdue
          ? "border-red-500/30 bg-red-500/5"
          : note.completedAt
            ? "bg-muted/20"
            : "bg-background"
      }`}
    >
      {editing ? (
        <EditInternalNoteForm
          customerId={customerId}
          note={note}
          teamMembers={teamMembers}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <KindBadge note={note} />

                {overdue && (
                  <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-700">
                    Overdue
                  </span>
                )}

                {note.completedAt && (
                  <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700">
                    Completed
                  </span>
                )}
              </div>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{note.content}</p>
            </div>

            {note.kind === "FOLLOW_UP" &&
              (note.completedAt ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
              ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <UserRound className="h-3.5 w-3.5" />
              Added by {creator}
            </span>

            <span>{new Date(note.createdAt).toLocaleString()}</span>

            {note.kind === "FOLLOW_UP" && note.assignedTo && (
              <span className="flex items-center gap-1">
                <UserRound className="h-3.5 w-3.5" />
                Assigned to {userLabel(note.assignedTo)}
              </span>
            )}

            {note.kind === "FOLLOW_UP" && note.dueAt && (
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                Due {new Date(note.dueAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {note.completedAt && (
            <div className="mt-3 text-xs text-muted-foreground">
              Completed {new Date(note.completedAt).toLocaleString()}
              {note.completedBy ? ` by ${userLabel(note.completedBy)}` : ""}
            </div>
          )}

          {!archived && (
            <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
              {note.kind === "FOLLOW_UP" &&
                (note.completedAt ? (
                  <form
                    action={reopenInternalFollowUpAction.bind(null, customerId, note.id)}
                  >
                    <Button type="submit" size="sm" variant="outline">
                      <RotateCcw className="h-4 w-4" />
                      Reopen
                    </Button>
                  </form>
                ) : (
                  <form
                    action={completeInternalFollowUpAction.bind(
                      null,
                      customerId,
                      note.id,
                    )}
                  >
                    <Button type="submit" size="sm">
                      <Check className="h-4 w-4" />
                      Complete
                    </Button>
                  </form>
                ))}

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>

              <form action={deleteInternalNoteAction.bind(null, customerId, note.id)}>
                <Button type="submit" size="sm" variant="outline">
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </form>
            </div>
          )}
        </>
      )}
    </article>
  );
}

function EditInternalNoteForm({
  customerId,
  note,
  teamMembers,
  onCancel,
}: {
  customerId: string;
  note: CustomerInternalNote;
  teamMembers: TeamMember[];
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<"NOTE" | "FOLLOW_UP">(note.kind);

  const action = updateInternalNoteAction.bind(null, customerId, note.id);

  const [state, formAction, pending] = useActionState(action, initialActionState);

  return (
    <form action={formAction}>
      <input type="hidden" name="kind" value={kind} />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={kind === "NOTE" ? "default" : "outline"}
          onClick={() => setKind("NOTE")}
          disabled={Boolean(note.completedAt)}
        >
          Internal note
        </Button>

        <Button
          type="button"
          size="sm"
          variant={kind === "FOLLOW_UP" ? "default" : "outline"}
          onClick={() => setKind("FOLLOW_UP")}
        >
          Follow-up
        </Button>
      </div>

      <textarea
        name="content"
        required
        maxLength={10000}
        defaultValue={note.content}
        className="mt-4 min-h-28 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
      />

      {kind === "FOLLOW_UP" && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Assignee</label>

            <select
              name="assignedToUserId"
              defaultValue={note.assignedToUserId ?? ""}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Unassigned</option>

              {teamMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {teamMemberLabel(member)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Due date</label>

            <input
              name="dueDate"
              type="date"
              defaultValue={note.dueAt ? dateInputValue(note.dueAt) : ""}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving..." : "Save changes"}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </Button>

        {state.message && (
          <span
            className={state.success ? "text-sm text-green-700" : "text-sm text-red-700"}
          >
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}

function FilterButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      onClick={onClick}
    >
      {label}

      <span className={active ? "text-primary-foreground/70" : "text-muted-foreground"}>
        {count}
      </span>
    </Button>
  );
}

function KindBadge({ note }: { note: CustomerInternalNote }) {
  if (note.kind === "FOLLOW_UP") {
    return (
      <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-700">
        Follow-up
      </span>
    );
  }

  return (
    <span className="rounded-full border border-slate-500/30 bg-slate-500/10 px-2 py-0.5 text-xs font-medium text-slate-700">
      Internal note
    </span>
  );
}

function EmptyState({ archived }: { archived: boolean }) {
  return (
    <div className="flex min-h-44 items-center justify-center rounded-xl border border-dashed">
      <div className="max-w-sm px-6 text-center">
        <StickyNote className="mx-auto h-8 w-8 text-muted-foreground" />

        <p className="mt-3 font-medium">No internal notes yet</p>

        <p className="mt-1 text-sm text-muted-foreground">
          {archived
            ? "No internal notes or follow-ups were recorded for this customer."
            : "Add private notes or create follow-ups for your team."}
        </p>
      </div>
    </div>
  );
}

function isOverdue(note: CustomerInternalNote) {
  if (note.kind !== "FOLLOW_UP" || note.completedAt || !note.dueAt) {
    return false;
  }

  return dateKey(new Date(note.dueAt)) < dateKey(new Date());
}

function dateKey(date: Date) {
  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function dateInputValue(value: string) {
  return dateKey(new Date(value));
}

function userLabel(
  user: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null,
) {
  if (!user) {
    return "Unknown user";
  }

  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
}

function teamMemberLabel(member: TeamMember) {
  const name = [member.firstName, member.lastName].filter(Boolean).join(" ");

  return name ? `${name} — ${member.email}` : member.email;
}
