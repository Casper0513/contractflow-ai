"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Customer } from "@/lib/customers-api";
import type { Job } from "@/lib/jobs-api";
import { getCurrencyInputStep, minorToMajorInputValue } from "@/lib/money";

import { type EditJobState, updateJobAction } from "./actions";

const initialState: EditJobState = {
  error: null,
};

type JobEditFormProps = {
  job: Job;
  customers: Customer[];
};

export function JobEditForm({ job, customers }: JobEditFormProps) {
  const action = updateJobAction.bind(null, job.id);

  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-8">
      {state.error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {state.error}
        </div>
      )}

      <section className="space-y-5">
        <div>
          <h2 className="font-semibold">Job details</h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Update the customer, scope, status, or priority.
          </p>
        </div>

        <FieldContainer label="Customer" error={state.fieldErrors?.customerId}>
          <select
            name="customerId"
            required
            defaultValue={job.customerId}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {customers.map((customer) => {
              const name = [customer.firstName, customer.lastName]
                .filter(Boolean)
                .join(" ");

              const label = customer.companyName
                ? `${name} — ${customer.companyName}`
                : name;

              return (
                <option key={customer.id} value={customer.id}>
                  {label}
                </option>
              );
            })}
          </select>
        </FieldContainer>

        <Field
          label="Job name"
          name="name"
          defaultValue={job.name}
          required
          error={state.fieldErrors?.name}
        />

        <FieldContainer label="Description">
          <textarea
            name="description"
            rows={5}
            defaultValue={job.description ?? ""}
            placeholder="Describe the job scope..."
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </FieldContainer>

        <div className="grid gap-5 sm:grid-cols-2">
          <FieldContainer label="Status">
            <select
              name="status"
              defaultValue={job.status}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="LEAD">Lead</option>

              <option value="ESTIMATING">Estimating</option>

              <option value="APPROVED">Approved</option>

              <option value="SCHEDULED">Scheduled</option>

              <option value="IN_PROGRESS">In progress</option>

              <option value="ON_HOLD">On hold</option>

              <option value="COMPLETED">Completed</option>

              <option value="CANCELLED">Cancelled</option>
            </select>
          </FieldContainer>

          <FieldContainer label="Priority">
            <select
              name="priority"
              defaultValue={job.priority}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="LOW">Low</option>

              <option value="NORMAL">Normal</option>

              <option value="HIGH">High</option>

              <option value="URGENT">Urgent</option>
            </select>
          </FieldContainer>
        </div>
      </section>

      <section className="space-y-5 border-t pt-8">
        <div>
          <h2 className="font-semibold">Job location</h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Update the work-site address.
          </p>
        </div>

        <Field
          label="Address line 1"
          name="addressLine1"
          defaultValue={job.addressLine1 ?? ""}
        />

        <Field
          label="Address line 2"
          name="addressLine2"
          defaultValue={job.addressLine2 ?? ""}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="City" name="city" defaultValue={job.city ?? ""} />

          <Field label="Province" name="province" defaultValue={job.province ?? ""} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Postal code"
            name="postalCode"
            defaultValue={job.postalCode ?? ""}
          />

          <Field label="Country" name="country" defaultValue={job.country} />
        </div>
      </section>

      <section className="space-y-5 border-t pt-8">
        <div>
          <h2 className="font-semibold">Schedule & budget</h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Adjust the planned dates and budget.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Start date"
            name="startDate"
            type="date"
            defaultValue={formatDateInput(job.startDate)}
            error={state.fieldErrors?.startDate}
          />

          <Field
            label="End date"
            name="endDate"
            type="date"
            defaultValue={formatDateInput(job.endDate)}
            error={state.fieldErrors?.endDate}
          />
        </div>

        <Field
          label="Budget"
          name="budget"
          type="number"
          defaultValue={
            job.budgetCents !== null
              ? minorToMajorInputValue(job.budgetCents, job.currency)
              : ""
          }
          min="0"
          step={getCurrencyInputStep(job.currency)}
          prefix={job.currency}
          error={state.fieldErrors?.budget}
        />
      </section>

      <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={`/jobs/${job.id}`}>Cancel</Link>}
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
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  min?: string;
  step?: string;
  error?: string;
  prefix?: string;
};

function Field({
  label,
  name,
  type = "text",
  placeholder,
  defaultValue,
  required,
  min,
  step,
  error,
  prefix,
}: FieldProps) {
  return (
    <FieldContainer label={label} error={error}>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {prefix}
          </span>
        )}

        <Input
          name={name}
          type={type}
          placeholder={placeholder}
          defaultValue={defaultValue}
          required={required}
          min={min}
          step={step}
          className={prefix ? "pl-14" : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${name}-error` : undefined}
        />
      </div>
    </FieldContainer>
  );
}

function FieldContainer({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium">{label}</span>

      {children}

      {error && (
        <span
          id={`${label}-error`}
          className="mt-2 block text-sm text-destructive"
          role="alert"
        >
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

function formatDateInput(value: string | null) {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}
