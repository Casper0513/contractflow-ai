"use client";

import { useActionState, useEffect, useRef } from "react";
import { Mail, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { sendCustomerEmailAction, type SendCustomerEmailActionState } from "./actions";

type CustomerEmailComposerProps = {
  customerId: string;
  customerEmail: string | null;
  disabled?: boolean;
};

const initialState: SendCustomerEmailActionState = {
  success: false,
  message: "",
};

export function CustomerEmailComposer({
  customerId,
  customerEmail,
  disabled = false,
}: CustomerEmailComposerProps) {
  const formRef = useRef<HTMLFormElement>(null);

  const action = sendCustomerEmailAction.bind(null, customerId);

  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state]);

  const unavailable = disabled || !customerEmail;

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-4 rounded-xl border bg-muted/20 p-4"
    >
      <div>
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />

          <p className="font-medium">New email</p>
        </div>

        <p className="mt-1 text-sm text-muted-foreground">
          {customerEmail
            ? `Send directly to ${customerEmail}.`
            : "Add an email address to this customer before sending messages."}
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="customer-email-subject" className="text-sm font-medium">
          Subject
        </label>

        <Input
          id="customer-email-subject"
          name="subject"
          placeholder="Email subject"
          maxLength={200}
          disabled={unavailable || pending}
          required
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="customer-email-message" className="text-sm font-medium">
          Message
        </label>

        <textarea
          id="customer-email-message"
          name="message"
          rows={7}
          maxLength={10000}
          placeholder="Write your message..."
          disabled={unavailable || pending}
          required
          className="flex w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {state.message && (
        <div
          className={
            state.success
              ? "rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700"
              : "rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700"
          }
        >
          {state.message}
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={unavailable || pending}>
          <Send className="h-4 w-4" />

          {pending ? "Sending..." : "Send email"}
        </Button>
      </div>
    </form>
  );
}
