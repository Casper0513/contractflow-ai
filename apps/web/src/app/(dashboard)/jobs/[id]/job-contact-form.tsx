"use client";

import { FormEvent, useState } from "react";
import { Loader2, Save, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { JobContact } from "@/lib/job-contacts-api";

import { createJobContactAction, updateJobContactAction } from "./job-contact-actions";

type JobContactFormProps = {
  jobId: string;
  contact?: JobContact;
  onCancel?: () => void;
  onSaved?: () => void;
};

export function JobContactForm({
  jobId,
  contact,
  onCancel,
  onSaved,
}: JobContactFormProps) {
  const editing = Boolean(contact);

  const [firstName, setFirstName] = useState(contact?.firstName ?? "");
  const [lastName, setLastName] = useState(contact?.lastName ?? "");
  const [phone, setPhone] = useState(contact?.phone ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [role, setRole] = useState(contact?.role ?? "");
  const [notes, setNotes] = useState(contact?.notes ?? "");
  const [isPrimary, setIsPrimary] = useState(contact?.isPrimary ?? false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError(null);
    setSuccess(null);

    const normalizedFirstName = firstName.trim();

    if (!normalizedFirstName) {
      setError("First name is required.");
      return;
    }

    setSaving(true);

    try {
      const input = {
        firstName: normalizedFirstName,
        lastName: lastName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        role: role.trim(),
        notes: notes.trim(),
        isPrimary,
      };

      const result = contact
        ? await updateJobContactAction(jobId, contact.id, input)
        : await createJobContactAction(jobId, input);

      if (!result.success) {
        throw new Error(result.error);
      }

      if (contact) {
        setSuccess("Contact updated successfully.");
        onSaved?.();
        return;
      }

      setFirstName("");
      setLastName("");
      setPhone("");
      setEmail("");
      setRole("");
      setNotes("");
      setIsPrimary(false);
      setSuccess("Contact added successfully.");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unable to save the contact.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <div>
        <h3 className="font-semibold">{editing ? "Edit contact" : "Add job contact"}</h3>

        <p className="mt-1 text-sm text-muted-foreground">
          {editing
            ? "Update this contact's job-site information."
            : "Add someone the team may need to contact for this job."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" required>
          <input
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            maxLength={100}
            disabled={saving}
            autoComplete="given-name"
            className={inputClassName}
          />
        </Field>

        <Field label="Last name">
          <input
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            maxLength={100}
            disabled={saving}
            autoComplete="family-name"
            className={inputClassName}
          />
        </Field>

        <Field label="Phone">
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            maxLength={50}
            disabled={saving}
            autoComplete="tel"
            className={inputClassName}
          />
        </Field>

        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            maxLength={255}
            disabled={saving}
            autoComplete="email"
            className={inputClassName}
          />
        </Field>

        <Field label="Role">
          <input
            value={role}
            onChange={(event) => setRole(event.target.value)}
            maxLength={100}
            disabled={saving}
            placeholder="Site manager, homeowner, tenant..."
            className={inputClassName}
          />
        </Field>

        <div className="flex items-end">
          <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(event) => setIsPrimary(event.target.checked)}
              disabled={saving}
              className="h-4 w-4"
            />
            Primary contact
          </label>
        </div>
      </div>

      <Field label="Notes">
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          maxLength={2000}
          disabled={saving}
          placeholder="Access instructions, preferred contact method, site details..."
          className={inputClassName}
        />
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {notes.length.toLocaleString()} / 2,000
        </p>

        <div className="flex gap-2">
          {onCancel && (
            <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>
              Cancel
            </Button>
          )}

          <Button type="submit" disabled={saving || !firstName.trim()}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : editing ? (
              <>
                <Save className="h-4 w-4" />
                Save changes
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Add contact
              </>
            )}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {success && <p className="text-sm text-green-700">{success}</p>}
    </form>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-sm font-medium">
        {label}
        {required ? " *" : ""}
      </span>

      {children}
    </label>
  );
}

const inputClassName =
  "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50";
