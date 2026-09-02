"use client";

import { useActionState, useState } from "react";
import {
  Clock3,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  UserRound,
  UserX,
  UsersRound,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CrewMember } from "@/lib/crew-api";
import type { JobTimeEntry } from "@/lib/job-time-entries-api";
import { formatMinorAmount } from "@/lib/money";

import { CrewCapacityForm } from "./crew-capacity-form";

import {
  activateCrewMemberAction,
  clockInCrewMemberAction,
  clockOutCrewMemberAction,
  createCrewMemberAction,
  createJobTimeEntryAction,
  deactivateCrewMemberAction,
  deleteJobTimeEntryAction,
  type JobCrewActionState,
  updateJobTimeEntryAction,
} from "./job-crew-actions";

const initialState: JobCrewActionState = {
  error: null,
  success: false,
};

export function JobCrewWorkspace({
  jobId,
  crewMembers,
  timeEntries,
  currency,
}: {
  jobId: string;
  crewMembers: CrewMember[];
  timeEntries: JobTimeEntry[];
  currency: string;
}) {
  const activeCrewMembers = crewMembers.filter((crewMember) => crewMember.active);

  const inactiveCrewMembers = crewMembers.filter((crewMember) => !crewMember.active);

  const compatibleActiveCrewMembers = activeCrewMembers.filter(
    (crewMember) => crewMember.currency === currency,
  );

  const completedEntries = timeEntries.filter((entry) => entry.endedAt !== null);

  const openEntries = timeEntries.filter((entry) => entry.endedAt === null);

  const openCrewMemberIds = new Set(openEntries.map((entry) => entry.crewMemberId));

  const availableForClockIn = compatibleActiveCrewMembers.filter(
    (crewMember) => !openCrewMemberIds.has(crewMember.id),
  );

  const laborCostCents = completedEntries.reduce(
    (total, entry) => total + entry.laborCostCents,
    0,
  );

  const totalHours = completedEntries.reduce(
    (total, entry) => total + calculateHours(entry),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CrewSummaryCard label="Active crew" value={String(activeCrewMembers.length)} />

        <CrewSummaryCard label="Currently working" value={String(openEntries.length)} />

        <CrewSummaryCard label="Completed hours" value={formatHours(totalHours)} />

        <CrewSummaryCard
          label="Labor cost"
          value={formatMinorAmount(laborCostCents, currency)}
        />
      </div>

      <ClockInPanel jobId={jobId} crewMembers={availableForClockIn} />

      {openEntries.length > 0 && (
        <div className="space-y-3">
          <div>
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-muted-foreground" />

              <h3 className="font-semibold">Currently working</h3>
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              Clocked-in crew members are tracked as open time entries. Labor cost is
              finalized when they clock out.
            </p>
          </div>

          <div className="space-y-3">
            {openEntries.map((entry) => (
              <TimeEntryRow
                key={entry.id}
                jobId={jobId}
                entry={entry}
                crewMembers={crewMembers}
              />
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <CrewMemberForm jobId={jobId} />

        <TimeEntryForm
          jobId={jobId}
          activeCrewMembers={compatibleActiveCrewMembers}
          currency={currency}
        />
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="font-semibold">Crew members</h3>

          <p className="text-sm text-muted-foreground">
            Manage internal labor rates and active crew availability.
          </p>
        </div>

        {crewMembers.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <UsersRound className="mx-auto h-8 w-8 text-muted-foreground" />

            <p className="mt-3 font-medium">No crew members yet</p>

            <p className="mt-1 text-sm text-muted-foreground">
              Add your first crew member above.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {activeCrewMembers.map((crewMember) => (
              <CrewMemberCard
                key={crewMember.id}
                jobId={jobId}
                crewMember={crewMember}
                clockedIn={openCrewMemberIds.has(crewMember.id)}
              />
            ))}

            {inactiveCrewMembers.map((crewMember) => (
              <CrewMemberCard
                key={crewMember.id}
                jobId={jobId}
                crewMember={crewMember}
                clockedIn={openCrewMemberIds.has(crewMember.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="font-semibold">Time history</h3>

          <p className="text-sm text-muted-foreground">
            Completed crew time automatically contributes to this job&apos;s labor cost
            and profitability.
          </p>
        </div>

        {completedEntries.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <Clock3 className="mx-auto h-8 w-8 text-muted-foreground" />

            <p className="mt-3 font-medium">No completed time entries</p>

            <p className="mt-1 text-sm text-muted-foreground">
              Clock out a crew member or add a completed time entry to begin tracking
              labor.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {completedEntries.map((entry) => (
              <TimeEntryRow
                key={entry.id}
                jobId={jobId}
                entry={entry}
                crewMembers={crewMembers}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ClockInPanel({
  jobId,
  crewMembers,
}: {
  jobId: string;
  crewMembers: CrewMember[];
}) {
  const [state, action, pending] = useActionState(
    clockInCrewMemberAction.bind(null, jobId),
    initialState,
  );

  return (
    <form action={action} className="rounded-xl border bg-muted/20 p-4">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <LogIn className="h-4 w-4 text-muted-foreground" />

            <h3 className="font-semibold">Clock in</h3>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            Start an open time entry using the current time.
          </p>

          {crewMembers.length > 0 && (
            <label className="mt-4 block space-y-1.5">
              <span className="text-sm font-medium">Crew member</span>

              <select
                name="crewMemberId"
                required
                disabled={pending}
                defaultValue=""
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="" disabled>
                  Select crew member
                </option>

                {crewMembers.map((crewMember) => (
                  <option key={crewMember.id} value={crewMember.id}>
                    {getCrewMemberName(crewMember)}
                    {` — ${formatMinorAmount(crewMember.hourlyCostCents, crewMember.currency)}/hr`}
                  </option>
                ))}
              </select>
            </label>
          )}

          {crewMembers.length === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              All active crew members are already clocked in, or there are no active crew
              members available.
            </p>
          )}

          {state.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}

          {state.success && (
            <p className="mt-3 text-sm text-green-700">Crew member clocked in.</p>
          )}
        </div>

        <Button type="submit" disabled={pending || crewMembers.length === 0}>
          <LogIn className="h-4 w-4" />

          {pending ? "Clocking in..." : "Clock in"}
        </Button>
      </div>
    </form>
  );
}

function CrewMemberForm({ jobId }: { jobId: string }) {
  const [state, action, pending] = useActionState(
    createCrewMemberAction.bind(null, jobId),
    initialState,
  );

  return (
    <form action={action} className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <div>
        <div className="flex items-center gap-2">
          <UserRound className="h-4 w-4 text-muted-foreground" />

          <h3 className="font-semibold">Add crew member</h3>
        </div>

        <p className="mt-1 text-sm text-muted-foreground">
          Hourly cost is internal and is used for job profitability.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm font-medium">First name</span>

          <Input name="firstName" placeholder="John" required disabled={pending} />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium">Last name</span>

          <Input name="lastName" placeholder="Smith" disabled={pending} />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium">Email</span>

          <Input
            name="email"
            type="email"
            placeholder="john@example.com"
            disabled={pending}
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium">Phone</span>

          <Input name="phone" placeholder="555-555-5555" disabled={pending} />
        </label>

        <label className="space-y-1.5 sm:col-span-2">
          <span className="text-sm font-medium">Internal hourly cost</span>

          <Input
            name="hourlyCost"
            type="text"
            inputMode="decimal"
            placeholder="25"
            required
            disabled={pending}
          />

          <span className="block text-xs text-muted-foreground">
            Uses your organization&apos;s currency.
          </span>
        </label>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      {state.success && <p className="text-sm text-green-700">Crew member added.</p>}

      <Button type="submit" disabled={pending}>
        <Plus className="h-4 w-4" />

        {pending ? "Adding..." : "Add crew member"}
      </Button>
    </form>
  );
}

function TimeEntryForm({
  jobId,
  activeCrewMembers,
  currency,
}: {
  jobId: string;
  activeCrewMembers: CrewMember[];
  currency: string;
}) {
  const [state, action, pending] = useActionState(
    createJobTimeEntryAction.bind(null, jobId),
    initialState,
  );

  return (
    <form action={action} className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <div>
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-muted-foreground" />

          <h3 className="font-semibold">Manual time entry</h3>
        </div>

        <p className="mt-1 text-sm text-muted-foreground">
          Enter historical or corrected time manually.
        </p>
      </div>

      {activeCrewMembers.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4">
          <p className="text-sm font-medium">No active crew available</p>

          <p className="mt-1 text-sm text-muted-foreground">
            Add or activate a crew member with a {currency} hourly rate before recording
            time on this job.
          </p>
        </div>
      ) : (
        <>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Crew member</span>

            <select
              name="crewMemberId"
              required
              disabled={pending}
              defaultValue=""
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="" disabled>
                Select crew member
              </option>

              {activeCrewMembers.map((crewMember) => (
                <option key={crewMember.id} value={crewMember.id}>
                  {getCrewMemberName(crewMember)}
                  {` — ${formatMinorAmount(crewMember.hourlyCostCents, crewMember.currency)}/hr`}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Start time</span>

              <Input name="startedAt" type="datetime-local" required disabled={pending} />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-medium">End time</span>

              <Input name="endedAt" type="datetime-local" disabled={pending} />

              <span className="block text-xs text-muted-foreground">
                Leave blank for an open entry.
              </span>
            </label>
          </div>

          <label className="space-y-1.5">
            <span className="text-sm font-medium">Notes</span>

            <textarea
              name="notes"
              rows={3}
              disabled={pending}
              placeholder="Work completed, site notes, etc."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>

          {state.error && <p className="text-sm text-red-600">{state.error}</p>}

          {state.success && <p className="text-sm text-green-700">Time entry added.</p>}

          <Button type="submit" disabled={pending}>
            <Clock3 className="h-4 w-4" />

            {pending ? "Saving..." : "Add time entry"}
          </Button>
        </>
      )}
    </form>
  );
}

function CrewMemberCard({
  jobId,
  crewMember,
  clockedIn,
}: {
  jobId: string;
  crewMember: CrewMember;
  clockedIn: boolean;
}) {
  const action = crewMember.active
    ? deactivateCrewMemberAction
    : activateCrewMemberAction;

  const [state, formAction, pending] = useActionState(
    action.bind(null, jobId, crewMember.id),
    initialState,
  );

  return (
    <div
      className={`rounded-xl border p-4 ${
        crewMember.active ? "bg-background" : "bg-muted/30 opacity-75"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{getCrewMemberName(crewMember)}</p>

            <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
              {crewMember.active ? "Active" : "Inactive"}
            </span>

            {clockedIn && (
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium">
                <Clock3 className="h-3 w-3" />
                Clocked in
              </span>
            )}
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            {formatMinorAmount(crewMember.hourlyCostCents, crewMember.currency)}
            /hr internal cost
          </p>
        </div>

        <UserRound className="h-5 w-5 text-muted-foreground" />
      </div>

      <div className="mt-3 space-y-1 text-sm text-muted-foreground">
        {crewMember.email && <p>{crewMember.email}</p>}

        {crewMember.phone && <p>{crewMember.phone}</p>}

        <p>
          {crewMember._count.timeEntries} time entr
          {crewMember._count.timeEntries === 1 ? "y" : "ies"}
        </p>
      </div>

      <CrewCapacityForm jobId={jobId} crewMember={crewMember} />

      {state.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}

      <form action={formAction} className="mt-4">
        <Button type="submit" size="sm" variant="outline" disabled={pending || clockedIn}>
          {crewMember.active ? (
            <>
              <UserX className="h-4 w-4" />

              {pending ? "Deactivating..." : "Deactivate"}
            </>
          ) : (
            <>
              <RotateCcw className="h-4 w-4" />

              {pending ? "Activating..." : "Activate"}
            </>
          )}
        </Button>
      </form>

      {clockedIn && (
        <p className="mt-2 text-xs text-muted-foreground">
          Clock this crew member out before deactivating them.
        </p>
      )}
    </div>
  );
}

function TimeEntryRow({
  jobId,
  entry,
  crewMembers,
}: {
  jobId: string;
  entry: JobTimeEntry;
  crewMembers: CrewMember[];
}) {
  const [editing, setEditing] = useState(false);

  const [deleteState, deleteAction, deleting] = useActionState(
    deleteJobTimeEntryAction.bind(null, jobId, entry.id),
    initialState,
  );

  const [clockOutState, clockOutAction, clockingOut] = useActionState(
    clockOutCrewMemberAction.bind(null, jobId, entry.id),
    initialState,
  );

  const hours = calculateHours(entry);

  if (editing) {
    return (
      <TimeEntryEditForm
        jobId={jobId}
        entry={entry}
        crewMembers={crewMembers}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{getCrewMemberName(entry.crewMember)}</p>

            {entry.endedAt === null && (
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium">
                <Clock3 className="h-3 w-3" />
                Clocked in
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>Started {formatDateTime(entry.startedAt)}</span>

            <span>
              {entry.endedAt ? `Ended ${formatDateTime(entry.endedAt)}` : "Still working"}
            </span>
          </div>

          {entry.notes && <p className="mt-2 text-sm">{entry.notes}</p>}
        </div>

        <div className="text-left sm:text-right">
          <p className="font-semibold tabular-nums">
            {entry.endedAt
              ? formatMinorAmount(entry.laborCostCents, entry.currency)
              : "Pending"}
          </p>

          <p className="text-xs text-muted-foreground">
            {entry.endedAt
              ? `${formatHours(hours)} hrs × ${formatMinorAmount(
                  entry.hourlyCostCents,
                  entry.currency,
                )}/hr`
              : `${formatMinorAmount(entry.hourlyCostCents, entry.currency)}/hr internal cost`}
          </p>
        </div>
      </div>

      {clockOutState.error && (
        <p className="mt-3 text-sm text-red-600">{clockOutState.error}</p>
      )}

      {deleteState.error && (
        <p className="mt-3 text-sm text-red-600">{deleteState.error}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
        {entry.endedAt === null && (
          <form action={clockOutAction}>
            <Button type="submit" size="sm" disabled={clockingOut || deleting}>
              <LogOut className="h-4 w-4" />

              {clockingOut ? "Clocking out..." : "Clock out"}
            </Button>
          </form>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={clockingOut || deleting}
          onClick={() => setEditing(true)}
        >
          <Pencil className="h-4 w-4" />
          Edit
        </Button>

        <form action={deleteAction}>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={deleting || clockingOut}
          >
            <Trash2 className="h-4 w-4" />

            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function TimeEntryEditForm({
  jobId,
  entry,
  crewMembers,
  onCancel,
}: {
  jobId: string;
  entry: JobTimeEntry;
  crewMembers: CrewMember[];
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(
    updateJobTimeEntryAction.bind(null, jobId, entry.id),
    initialState,
  );

  return (
    <form action={action} className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-muted-foreground" />

            <h3 className="font-semibold">Edit time entry</h3>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            Correct the crew member, timestamps, or notes. Labor cost will be recalculated
            automatically.
          </p>
        </div>

        <p className="text-sm text-muted-foreground">
          {formatMinorAmount(entry.hourlyCostCents, entry.currency)}
          /hr snapshot
        </p>
      </div>

      <label className="space-y-1.5">
        <span className="text-sm font-medium">Crew member</span>

        <select
          name="crewMemberId"
          defaultValue={entry.crewMemberId}
          disabled={pending}
          required
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {crewMembers.map((crewMember) => (
            <option
              key={crewMember.id}
              value={crewMember.id}
              disabled={
                crewMember.currency !== entry.currency ||
                (!crewMember.active && crewMember.id !== entry.crewMemberId)
              }
            >
              {getCrewMemberName(crewMember)}
              {` — ${formatMinorAmount(
                crewMember.hourlyCostCents,
                crewMember.currency,
              )}/hr`}
              {!crewMember.active ? " — inactive" : ""}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Start time</span>

          <Input
            name="startedAt"
            type="datetime-local"
            defaultValue={dateTimeForInput(entry.startedAt)}
            disabled={pending}
            required
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium">End time</span>

          <Input
            name="endedAt"
            type="datetime-local"
            defaultValue={entry.endedAt ? dateTimeForInput(entry.endedAt) : ""}
            disabled={pending}
          />

          <span className="block text-xs text-muted-foreground">
            Leave blank to keep this entry open.
          </span>
        </label>
      </div>

      <label className="space-y-1.5">
        <span className="text-sm font-medium">Notes</span>

        <textarea
          name="notes"
          rows={3}
          defaultValue={entry.notes ?? ""}
          disabled={pending}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      {state.success && <p className="text-sm text-green-700">Time entry updated.</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          <Save className="h-4 w-4" />

          {pending ? "Saving..." : "Save changes"}
        </Button>

        <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
          <X className="h-4 w-4" />
          Close
        </Button>
      </div>
    </form>
  );
}

function CrewSummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>

      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function getCrewMemberName(crewMember: { firstName: string; lastName: string | null }) {
  return [crewMember.firstName, crewMember.lastName].filter(Boolean).join(" ");
}

function calculateHours(entry: JobTimeEntry) {
  if (!entry.endedAt) {
    return 0;
  }

  const start = new Date(entry.startedAt).getTime();

  const end = new Date(entry.endedAt).getTime();

  const duration = (end - start) / 3_600_000;

  if (!Number.isFinite(duration) || duration < 0) {
    return 0;
  }

  return duration;
}

function formatHours(hours: number) {
  return new Intl.NumberFormat("en-CA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(hours);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function dateTimeForInput(value: string) {
  const date = new Date(value);

  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  const hours = String(date.getHours()).padStart(2, "0");

  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
