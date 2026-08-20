"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { BellRing, CheckCircle2, Clock3, Loader2, LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EstimateReminderSettings } from "@/lib/organizations-api";

import {
  updateEstimateReminderSettingsAction,
  type EstimateReminderSettingsActionState,
} from "./estimate-reminder-settings-actions";

const initialState: EstimateReminderSettingsActionState = {
  success: false,
  message: null,
};

type EstimateReminderSettingsFormProps = {
  settings: EstimateReminderSettings;
  canEdit: boolean;
};

export function EstimateReminderSettingsForm({
  settings,
  canEdit,
}: EstimateReminderSettingsFormProps) {
  const [state, formAction, pending] = useActionState(
    updateEstimateReminderSettingsAction,
    initialState,
  );

  const [form, setForm] = useState(() => ({
    enabled: settings.enabled,

    firstFollowUpEnabled: settings.firstFollowUpEnabled,
    firstFollowUpDays: String(settings.firstFollowUpDays),

    secondFollowUpEnabled: settings.secondFollowUpEnabled,
    secondFollowUpDays: String(settings.secondFollowUpDays),
  }));

  const messageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.message) {
      messageRef.current?.focus();
    }
  }, [state]);

  function updateBoolean(
    field: "enabled" | "firstFollowUpEnabled" | "secondFollowUpEnabled",
    value: boolean,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateNumber(
    field: "firstFollowUpDays" | "secondFollowUpDays",
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
            <p className="font-medium">Estimate reminders are read-only</p>

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
            <p className="font-medium">Automatic estimate follow-ups</p>

            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Automatically follow up with customers who have not yet approved or declined
              a sent estimate.
            </p>
          </div>
        </div>

        <ToggleCheckbox
          name="enabled"
          checked={form.enabled}
          disabled={!canEdit || pending}
          onChange={(checked) => updateBoolean("enabled", checked)}
          label="Enable automatic estimate reminders"
        />
      </div>

      <div className={`space-y-4 ${settingsDisabled ? "opacity-60" : ""}`}>
        <ReminderRow
          title="First follow-up"
          description="Send a friendly reminder after the customer has had time to review the estimate."
          checked={form.firstFollowUpEnabled}
          name="firstFollowUpEnabled"
          disabled={!canEdit || pending || settingsDisabled}
          onCheckedChange={(checked) => updateBoolean("firstFollowUpEnabled", checked)}
        >
          <DaysInput
            id="firstFollowUpDays"
            name="firstFollowUpDays"
            value={form.firstFollowUpDays}
            disabled={
              !canEdit || pending || settingsDisabled || !form.firstFollowUpEnabled
            }
            onChange={(value) => updateNumber("firstFollowUpDays", value)}
          />

          <span className="text-sm text-muted-foreground">days after sent</span>
        </ReminderRow>

        <ReminderRow
          title="Second follow-up"
          description="Send another reminder if the customer still has not responded to the estimate."
          checked={form.secondFollowUpEnabled}
          name="secondFollowUpEnabled"
          disabled={!canEdit || pending || settingsDisabled}
          onCheckedChange={(checked) => updateBoolean("secondFollowUpEnabled", checked)}
        >
          <DaysInput
            id="secondFollowUpDays"
            name="secondFollowUpDays"
            value={form.secondFollowUpDays}
            disabled={
              !canEdit || pending || settingsDisabled || !form.secondFollowUpEnabled
            }
            onChange={(value) => updateNumber("secondFollowUpDays", value)}
          />

          <span className="text-sm text-muted-foreground">days after sent</span>
        </ReminderRow>
      </div>

      <div className="flex gap-3 rounded-xl border bg-muted/20 p-4">
        <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />

        <div>
          <p className="text-sm font-medium">Automatic processing</p>

          <p className="mt-1 text-sm text-muted-foreground">
            ContractFlow checks eligible estimates automatically throughout the day.
            Approved, declined, expired, and draft estimates are skipped.
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
              "Save estimate reminder settings"
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
