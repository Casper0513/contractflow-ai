"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Customer } from "@/lib/customers-api";

import { type EditCustomerState, updateCustomerAction } from "./actions";

const initialState: EditCustomerState = {
  error: null,
};

type EditCustomerFormProps = {
  customer: Customer;
};

export function EditCustomerForm({ customer }: EditCustomerFormProps) {
  const action = updateCustomerAction.bind(null, customer.id);

  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {state.error}
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="First name"
          name="firstName"
          defaultValue={customer.firstName}
          required
          error={state.fieldErrors?.firstName}
        />

        <Field
          label="Last name"
          name="lastName"
          defaultValue={customer.lastName ?? ""}
          error={state.fieldErrors?.lastName}
        />
      </div>

      <Field
        label="Company name"
        name="companyName"
        defaultValue={customer.companyName ?? ""}
        error={state.fieldErrors?.companyName}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Email"
          name="email"
          type="email"
          defaultValue={customer.email ?? ""}
          error={state.fieldErrors?.email}
        />

        <Field
          label="Phone"
          name="phone"
          type="tel"
          defaultValue={customer.phone ?? ""}
          error={state.fieldErrors?.phone}
        />
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-medium">Notes</span>

        <textarea
          name="notes"
          defaultValue={customer.notes ?? ""}
          rows={6}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </label>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={`/customers/${customer.id}`}>Cancel</Link>}
        />

        <SubmitButton />
      </div>
    </form>
  );
}

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  error?: string;
};

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  error,
}: FieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium">{label}</span>

      <Input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
      />

      {error && (
        <span id={`${name}-error`} className="mt-2 block text-sm text-destructive">
          {error}
        </span>
      )}
    </label>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : "Save changes"}
    </Button>
  );
}
