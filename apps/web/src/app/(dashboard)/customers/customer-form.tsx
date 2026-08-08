"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  createCustomerAction,
  type CustomerFormState,
} from "./actions";

const initialState: CustomerFormState = {
  error: null,
  success: false,
};

export function CustomerForm() {
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction] = useActionState(
    createCustomerAction,
    initialState,
  );

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-4"
    >
      {state.error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      {state.success && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm">
          Customer created successfully.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          name="firstName"
          placeholder="First name"
          required
        />

        <Input
          name="lastName"
          placeholder="Last name"
        />
      </div>

      <Input
        name="companyName"
        placeholder="Company name"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          name="email"
          type="email"
          placeholder="Email"
        />

        <Input
          name="phone"
          type="tel"
          placeholder="Phone"
        />
      </div>

      <textarea
        name="notes"
        placeholder="Customer notes"
        rows={4}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
      />

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating..." : "Add customer"}
    </Button>
  );
}
