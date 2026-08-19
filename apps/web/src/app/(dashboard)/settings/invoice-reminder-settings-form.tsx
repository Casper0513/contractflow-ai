"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { BellRing, CheckCircle2, Clock3, Loader2, LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { InvoiceReminderSettings } from "@/lib/organizations-api";

import {
  updateInvoiceReminderSettingsAction,
  type InvoiceReminderSettingsActionState,
} from "./invoice-reminder-settings-actions";

const initialState: InvoiceReminderSettingsActionState = {
  success: false,
  message: null,
};

type InvoiceReminderSettingsFormProps = {
  settings: InvoiceReminderSettings;
  canEdit: boolean;
};

export function InvoiceReminderSettingsForm({
  settings,
  canEdit,
}: InvoiceReminderSettingsFormProps) {
  const [state, formAction, pending] = useActionState(
    updateInvoiceReminderSettingsAction,
    initialState,
  );

  const [form, setForm] = useState(() => ({
    enabled: settings.enabled,

    beforeDueEnabled: settings.beforeDueEnabled,
    beforeDueDays: String(settings.beforeDueDays),

    dueTodayEnabled: settings.dueTodayEnabled,

    firstOverdueEnabled: settings.firstOverdueEnabled,
    firstOverdueDays: String(settings.firstOverdueDays),

    secondOverdueEnabled: settings.secondOverdueEnabled,
    secondOverdueDays: String(settings.secondOverdueDays),
  }));

  const messageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.message) {
      messageRef.current?.focus();
    }
  }, [state]);

  function updateBoolean(
    field:
      | "enabled"
      | "beforeDueEnabled"
      | "dueTodayEnabled"
      | "firstOverdueEnabled"
      | "secondOverdueEnabled",
    value: boolean,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateNumber(
    field: "beforeDueDays" | "firstOverdueDays" | "secondOverdueDays",
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  const settingsDisabled = !form.enabled;

  return (
    <form action={formAction} className="space-y-6">
      {!canEdit && (
        <div className="flex gap-3 rounded-xl border bg-muted/30 p-4">
          <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />

          <div>
            <p className="font-medium">Invoice reminders are read-only</p>

            <p className="mt-1 text-sm text-muted-foreground">
              Only organization owners and administrators can update these settings.
            </p>
          </div>
        </div>
      )}

      {state.message && (
        <div
          ref={messageRef}
          tabIndex={-1}
          role={state.success ? "status" : "alert"}
          className={`rounded-xl border p-4 text-sm outline-none ${
            state.success
              ? "border-green-500/30 bg-green-500/10 text-green-700"
              : "border-destructive/30 bg-destructive/5 text-destructive"
          }`}
        >
          <div className="flex items-start gap-2">
            {state.success && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}

            <span>{state.message}</span>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-6 rounded-xl border p-4">
        <div className="flex gap-3">
          <div className="rounded-lg border bg-muted/30 p-2">
            <BellRing className="h-4 w-4 text-muted-foreground" />
          </div>

          <div>
            <p className="font-medium">Automatic invoice reminders</p>

            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Automatically email customers about upcoming and overdue invoice balances.
            </p>
          </div>
        </div>

        <ToggleCheckbox
          name="enabled"
          checked={form.enabled}
          disabled={!canEdit || pending}
          onChange={(checked) => updateBoolean("enabled", checked)}
          label="Enable automatic invoice reminders"
        />
      </div>

      <div className={`space-y-4 ${settingsDisabled ? "opacity-60" : ""}`}>
        <ReminderRow
          title="Before due date"
          description="Send a friendly reminder before the invoice becomes due."
          checked={form.beforeDueEnabled}
          name="beforeDueEnabled"
          disabled={!canEdit || pending || settingsDisabled}
          onCheckedChange={(checked) => updateBoolean("beforeDueEnabled", checked)}
        >
          <DaysInput
            id="beforeDueDays"
            name="beforeDueDays"
            value={form.beforeDueDays}
            disabled={!canEdit || pending || settingsDisabled || !form.beforeDueEnabled}
            onChange={(value) => updateNumber("beforeDueDays", value)}
          />

          <span className="text-sm text-muted-foreground">days before due</span>
        </ReminderRow>

        <ReminderRow
          title="Due date"
          description="Send a reminder on the day payment is due."
          checked={form.dueTodayEnabled}
          name="dueTodayEnabled"
          disabled={!canEdit || pending || settingsDisabled}
          onCheckedChange={(checked) => updateBoolean("dueTodayEnabled", checked)}
        />

        <ReminderRow
          title="First overdue reminder"
          description="Send the first collection reminder after the invoice becomes overdue."
          checked={form.firstOverdueEnabled}
          name="firstOverdueEnabled"
          disabled={!canEdit || pending || settingsDisabled}
          onCheckedChange={(checked) => updateBoolean("firstOverdueEnabled", checked)}
        >
          <DaysInput
            id="firstOverdueDays"
            name="firstOverdueDays"
            value={form.firstOverdueDays}
            disabled={
              !canEdit || pending || settingsDisabled || !form.firstOverdueEnabled
            }
            onChange={(value) => updateNumber("firstOverdueDays", value)}
          />

          <span className="text-sm text-muted-foreground">days overdue</span>
        </ReminderRow>

        <ReminderRow
          title="Second overdue reminder"
          description="Send a later follow-up when an invoice still has an outstanding balance."
          checked={form.secondOverdueEnabled}
          name="secondOverdueEnabled"
          disabled={!canEdit || pending || settingsDisabled}
          onCheckedChange={(checked) => updateBoolean("secondOverdueEnabled", checked)}
        >
          <DaysInput
            id="secondOverdueDays"
            name="secondOverdueDays"
            value={form.secondOverdueDays}
            disabled={
              !canEdit || pending || settingsDisabled || !form.secondOverdueEnabled
            }
            onChange={(value) => updateNumber("secondOverdueDays", value)}
          />

          <span className="text-sm text-muted-foreground">days overdue</span>
        </ReminderRow>
      </div>

      <div className="flex gap-3 rounded-xl border bg-muted/20 p-4">
        <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />

        <div>
          <p className="text-sm font-medium">Automatic processing</p>

          <p className="mt-1 text-sm text-muted-foreground">
            ContractFlow checks invoices automatically throughout the day. Paid invoices
            and invoices with no outstanding balance are skipped.
          </p>
        </div>
      </div>

      {canEdit && (
        <div className="flex justify-end border-t pt-6">
          <Button type="submit" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save reminder settings"
            )}
          </Button>
        </div>
      )}
    </form>
  );
}

type ReminderRowProps = {
  title: string;
  description: string;
  checked: boolean;
  name: string;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
  children?: React.ReactNode;
};

function ReminderRow({
  title,
  description,
  checked,
  name,
  disabled,
  onCheckedChange,
  children,
}: ReminderRowProps) {
  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="font-medium">{title}</p>

          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>

        <ToggleCheckbox
          name={name}
          checked={checked}
          disabled={disabled}
          onChange={onCheckedChange}
          label={title}
        />
      </div>

      {children && <div className="mt-4 flex items-center gap-3">{children}</div>}
    </div>
  );
}

type ToggleCheckboxProps = {
  name: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
  label: string;
};

function ToggleCheckbox({
  name,
  checked,
  disabled,
  onChange,
  label,
}: ToggleCheckboxProps) {
  return (
    <label className="relative inline-flex cursor-pointer items-center">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
        aria-label={label}
      />

      <span className="h-6 w-11 rounded-full bg-muted-foreground/30 transition-colors peer-checked:bg-primary peer-disabled:cursor-not-allowed peer-disabled:opacity-50" />

      <span className="absolute left-1 h-4 w-4 rounded-full bg-background shadow-sm transition-transform peer-checked:translate-x-5" />
    </label>
  );
}

type DaysInputProps = {
  id: string;
  name: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
};

function DaysInput({ id, name, value, disabled, onChange }: DaysInputProps) {
  return (
    <Input
      id={id}
      name={name}
      type="number"
      min={1}
      max={365}
      step={1}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="w-24"
      required
    />
  );
}
