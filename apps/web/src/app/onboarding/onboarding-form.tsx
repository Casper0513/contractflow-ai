"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { createOrganizationAction, type OnboardingActionState } from "./actions";

const initialState: OnboardingActionState = {
  error: null,
};

export function OnboardingForm() {
  const [state, formAction] = useActionState(createOrganizationAction, initialState);

  return (
    <form action={formAction} className="mt-8 space-y-6">
      {state.error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {state.error}
        </div>
      )}

      <Field label="Company name" name="name" placeholder="Smith Plumbing" required />

      <Field label="Legal name" name="legalName" placeholder="Smith Plumbing Ltd." />

      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          label="Business email"
          name="email"
          type="email"
          placeholder="office@example.com"
        />

        <Field label="Phone" name="phone" type="tel" placeholder="780-555-0123" />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <label>
          <span className="mb-2 block text-sm font-medium">Timezone</span>

          <select
            name="timezone"
            defaultValue="America/Edmonton"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3"
          >
            <option value="America/Edmonton">Mountain Time</option>
            <option value="America/Vancouver">Pacific Time</option>
            <option value="America/Winnipeg">Central Time</option>
            <option value="America/Toronto">Eastern Time</option>
          </select>
        </label>

        <label>
          <span className="mb-2 block text-sm font-medium">Currency</span>

          <select
            name="currency"
            defaultValue="CAD"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3"
          >
            <option value="CAD">CAD</option>
            <option value="USD">USD</option>
          </select>
        </label>
      </div>

      <SubmitButton />
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium">{label}</span>

      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3"
      />
    </label>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-amber-400 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50"
    >
      {pending ? "Creating..." : "Create workspace"}
    </button>
  );
}
