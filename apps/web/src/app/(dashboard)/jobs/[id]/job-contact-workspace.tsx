"use client";

import { useState } from "react";
import {
  Loader2,
  Mail,
  MapPinCheck,
  Pencil,
  Phone,
  Star,
  Trash2,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { JobContact } from "@/lib/job-contacts-api";

import {
  deleteJobContactAction,
  setPrimaryJobContactAction,
} from "./job-contact-actions";
import { JobContactForm } from "./job-contact-form";

type JobContactWorkspaceProps = {
  jobId: string;
  contacts: JobContact[];
  archived: boolean;
};

export function JobContactWorkspace({
  jobId,
  contacts,
  archived,
}: JobContactWorkspaceProps) {
  return (
    <div className="space-y-6">
      {!archived && <JobContactForm jobId={jobId} />}

      {contacts.length === 0 ? (
        <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed">
          <div className="max-w-sm px-6 text-center">
            <UserRound className="mx-auto h-9 w-9 text-muted-foreground" />

            <p className="mt-3 font-medium">No job contacts yet</p>

            <p className="mt-1 text-sm text-muted-foreground">
              Add site contacts, property managers, homeowners, tenants, or anyone else
              the team may need to reach for this job.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {contacts.map((contact) => (
            <JobContactCard
              key={contact.id}
              jobId={jobId}
              contact={contact}
              archived={archived}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function JobContactCard({
  jobId,
  contact,
  archived,
}: {
  jobId: string;
  contact: JobContact;
  archived: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [settingPrimary, setSettingPrimary] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busy = settingPrimary || deleting;

  async function handleSetPrimary() {
    setError(null);
    setSettingPrimary(true);

    try {
      const result = await setPrimaryJobContactAction(jobId, contact.id);

      if (!result.success) {
        throw new Error(result.error);
      }
    } catch (primaryError) {
      setError(
        primaryError instanceof Error
          ? primaryError.message
          : "Unable to change the primary contact.",
      );
    } finally {
      setSettingPrimary(false);
    }
  }

  async function handleDelete() {
    setError(null);
    setDeleting(true);

    try {
      const result = await deleteJobContactAction(jobId, contact.id);

      if (!result.success) {
        throw new Error(result.error);
      }
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete the contact.",
      );
    } finally {
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <JobContactForm
        jobId={jobId}
        contact={contact}
        onCancel={() => setEditing(false)}
        onSaved={() => setEditing(false)}
      />
    );
  }

  const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ");

  return (
    <article className="rounded-xl border bg-background p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{name}</h3>

            {contact.isPrimary && (
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium">
                <Star className="h-3 w-3" />
                Primary
              </span>
            )}
          </div>

          {contact.role && (
            <p className="mt-1 text-sm text-muted-foreground">{contact.role}</p>
          )}
        </div>

        <UserRound className="h-5 w-5 shrink-0 text-muted-foreground" />
      </div>

      <div className="mt-4 space-y-2 text-sm">
        {contact.phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />

            <a className="hover:underline" href={`tel:${contact.phone}`}>
              {contact.phone}
            </a>
          </div>
        )}

        {contact.email && (
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />

            <a
              className="min-w-0 truncate hover:underline"
              href={`mailto:${contact.email}`}
            >
              {contact.email}
            </a>
          </div>
        )}

        {!contact.phone && !contact.email && (
          <p className="text-muted-foreground">No phone number or email provided.</p>
        )}
      </div>

      {contact.notes && (
        <div className="mt-4 rounded-lg bg-muted/40 p-3">
          <p className="whitespace-pre-wrap text-sm leading-6">{contact.notes}</p>
        </div>
      )}

      {!archived && (
        <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
          {!contact.isPrimary && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={handleSetPrimary}
            >
              {settingPrimary ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MapPinCheck className="h-4 w-4" />
              )}
              Make primary
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
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

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </article>
  );
}
