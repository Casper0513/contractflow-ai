"use server";

import { revalidatePath } from "next/cache";

import {
  activateCrewMember,
  createCrewMember,
  deactivateCrewMember,
  getCrewMember,
  updateCrewMember,
} from "@/lib/crew-api";
import {
  createJobTimeEntry,
  deleteJobTimeEntry,
  updateJobTimeEntry,
} from "@/lib/job-time-entries-api";
import { getCurrencyFractionDigits, majorToMinor } from "@/lib/money";
import { getCurrentOrganization } from "@/lib/organizations-api";
import { ApiRequestError } from "@/lib/server-api";

export type JobCrewActionState = {
  error: string | null;
  success: boolean;
};

export async function createCrewMemberAction(
  jobId: string,
  _previousState: JobCrewActionState,
  formData: FormData,
): Promise<JobCrewActionState> {
  void _previousState;

  try {
    const firstName = readRequiredString(formData.get("firstName"), "First name");

    const lastName = readOptionalString(formData.get("lastName"));

    const email = readOptionalString(formData.get("email"));

    const phone = readOptionalString(formData.get("phone"));

    const organization = await getCurrentOrganization();

    const hourlyCostCents = readMoneyAsCents(
      formData.get("hourlyCost"),
      "Hourly cost",
      organization.currency,
    );

    await createCrewMember({
      firstName,
      ...(lastName ? { lastName } : {}),
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      hourlyCostCents,
    });

    revalidateCrew(jobId);

    return {
      error: null,
      success: true,
    };
  } catch (error) {
    return {
      error: getActionErrorMessage(error, "Unable to add crew member."),
      success: false,
    };
  }
}

export async function updateCrewMemberAction(
  jobId: string,
  crewMemberId: string,
  _previousState: JobCrewActionState,
  formData: FormData,
): Promise<JobCrewActionState> {
  void _previousState;

  try {
    const firstName = readRequiredString(formData.get("firstName"), "First name");

    const lastName = readNullableString(formData.get("lastName"));

    const email = readNullableString(formData.get("email"));

    const phone = readNullableString(formData.get("phone"));

    const crewMember = await getCrewMember(crewMemberId);

    const hourlyCostCents = readMoneyAsCents(
      formData.get("hourlyCost"),
      "Hourly cost",
      crewMember.currency,
    );

    await updateCrewMember(crewMemberId, {
      firstName,
      lastName,
      email,
      phone,
      hourlyCostCents,
    });

    revalidateCrew(jobId);

    return {
      error: null,
      success: true,
    };
  } catch (error) {
    return {
      error: getActionErrorMessage(error, "Unable to update crew member."),
      success: false,
    };
  }
}

export async function updateCrewCapacityAction(
  jobId: string,
  crewMemberId: string,
  _previousState: JobCrewActionState,
  formData: FormData,
): Promise<JobCrewActionState> {
  void _previousState;

  try {
    const dailyCapacityMinutes = readNullableInteger(
      formData.get("dailyCapacityMinutes"),
      "Daily capacity",
      15,
      1440,
    );

    await updateCrewMember(crewMemberId, {
      dailyCapacityMinutes,
    });

    revalidateCrew(jobId);
    revalidatePath("/calendar");
    revalidatePath("/settings");

    return {
      error: null,
      success: true,
    };
  } catch (error) {
    return {
      error: getActionErrorMessage(error, "Unable to update crew capacity."),
      success: false,
    };
  }
}

export async function deactivateCrewMemberAction(
  jobId: string,
  crewMemberId: string,
  _previousState: JobCrewActionState,
): Promise<JobCrewActionState> {
  void _previousState;

  try {
    await deactivateCrewMember(crewMemberId);

    revalidateCrew(jobId);

    return {
      error: null,
      success: true,
    };
  } catch (error) {
    return {
      error: getActionErrorMessage(error, "Unable to deactivate crew member."),
      success: false,
    };
  }
}

export async function activateCrewMemberAction(
  jobId: string,
  crewMemberId: string,
  _previousState: JobCrewActionState,
): Promise<JobCrewActionState> {
  void _previousState;

  try {
    await activateCrewMember(crewMemberId);

    revalidateCrew(jobId);

    return {
      error: null,
      success: true,
    };
  } catch (error) {
    return {
      error: getActionErrorMessage(error, "Unable to activate crew member."),
      success: false,
    };
  }
}

export async function clockInCrewMemberAction(
  jobId: string,
  _previousState: JobCrewActionState,
  formData: FormData,
): Promise<JobCrewActionState> {
  void _previousState;

  try {
    const crewMemberId = readRequiredString(formData.get("crewMemberId"), "Crew member");

    await createJobTimeEntry(jobId, {
      crewMemberId,
      startedAt: new Date().toISOString(),
    });

    revalidateCrew(jobId);

    return {
      error: null,
      success: true,
    };
  } catch (error) {
    return {
      error: getActionErrorMessage(error, "Unable to clock in crew member."),
      success: false,
    };
  }
}

export async function clockOutCrewMemberAction(
  jobId: string,
  timeEntryId: string,
  _previousState: JobCrewActionState,
): Promise<JobCrewActionState> {
  void _previousState;

  try {
    await updateJobTimeEntry(jobId, timeEntryId, {
      endedAt: new Date().toISOString(),
    });

    revalidateCrew(jobId);

    return {
      error: null,
      success: true,
    };
  } catch (error) {
    return {
      error: getActionErrorMessage(error, "Unable to clock out crew member."),
      success: false,
    };
  }
}

export async function createJobTimeEntryAction(
  jobId: string,
  _previousState: JobCrewActionState,
  formData: FormData,
): Promise<JobCrewActionState> {
  void _previousState;

  try {
    const crewMemberId = readRequiredString(formData.get("crewMemberId"), "Crew member");

    const startedAt = readRequiredDateTime(formData.get("startedAt"), "Start time");

    const endedAt = readOptionalDateTime(formData.get("endedAt"), "End time");

    const notes = readOptionalString(formData.get("notes"));

    await createJobTimeEntry(jobId, {
      crewMemberId,
      startedAt,
      ...(endedAt ? { endedAt } : {}),
      ...(notes ? { notes } : {}),
    });

    revalidateCrew(jobId);

    return {
      error: null,
      success: true,
    };
  } catch (error) {
    return {
      error: getActionErrorMessage(error, "Unable to add time entry."),
      success: false,
    };
  }
}

export async function updateJobTimeEntryAction(
  jobId: string,
  timeEntryId: string,
  _previousState: JobCrewActionState,
  formData: FormData,
): Promise<JobCrewActionState> {
  void _previousState;

  try {
    const crewMemberId = readRequiredString(formData.get("crewMemberId"), "Crew member");

    const startedAt = readRequiredDateTime(formData.get("startedAt"), "Start time");

    const endedAt = readNullableDateTime(formData.get("endedAt"), "End time");

    const notes = readNullableString(formData.get("notes"));

    await updateJobTimeEntry(jobId, timeEntryId, {
      crewMemberId,
      startedAt,
      endedAt,
      notes,
    });

    revalidateCrew(jobId);

    return {
      error: null,
      success: true,
    };
  } catch (error) {
    return {
      error: getActionErrorMessage(error, "Unable to update time entry."),
      success: false,
    };
  }
}

export async function deleteJobTimeEntryAction(
  jobId: string,
  timeEntryId: string,
  _previousState: JobCrewActionState,
): Promise<JobCrewActionState> {
  void _previousState;

  try {
    await deleteJobTimeEntry(jobId, timeEntryId);

    revalidateCrew(jobId);

    return {
      error: null,
      success: true,
    };
  } catch (error) {
    return {
      error: getActionErrorMessage(error, "Unable to delete time entry."),
      success: false,
    };
  }
}

function revalidateCrew(jobId: string) {
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
}

function readRequiredString(value: FormDataEntryValue | null, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required.`);
  }

  return value.trim();
}

function readOptionalString(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const result = value.trim();

  return result || undefined;
}

function readNullableString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const result = value.trim();

  return result || null;
}

function readNullableInteger(
  value: FormDataEntryValue | null,
  label: string,
  min: number,
  max: number,
): number | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const number = Number(value.trim());

  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${label} must be between ${min} and ${max} minutes.`);
  }

  return number;
}

function readMoneyAsCents(
  value: FormDataEntryValue | null,
  label: string,
  currency: string,
): number {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required.`);
  }

  const normalized = value.trim();
  const fractionDigits = getCurrencyFractionDigits(currency);

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(`${label} must be a valid ${currency} amount.`);
  }

  const decimalPart = normalized.split(".")[1] ?? "";

  if (decimalPart.length > fractionDigits) {
    throw new Error(
      `${label} cannot have more than ${fractionDigits} decimal place${
        fractionDigits === 1 ? "" : "s"
      } for ${currency}.`,
    );
  }

  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`${label} is invalid.`);
  }

  return majorToMinor(amount, currency);
}

function readRequiredDateTime(value: FormDataEntryValue | null, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required.`);
  }

  return normalizeDateTimeLocal(value.trim(), label);
}

function readOptionalDateTime(
  value: FormDataEntryValue | null,
  label: string,
): string | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  return normalizeDateTimeLocal(value.trim(), label);
}

function readNullableDateTime(
  value: FormDataEntryValue | null,
  label: string,
): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  return normalizeDateTimeLocal(value.trim(), label);
}

function normalizeDateTimeLocal(value: string, label: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} is invalid.`);
  }

  return date.toISOString();
}

function getActionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError) {
    const apiMessage = parseApiError(error.responseBody);

    if (apiMessage) {
      return apiMessage;
    }

    if (error.status === 404) {
      return "The requested job, crew member, or time entry could not be found.";
    }

    if (error.status === 401) {
      return "Your session has expired. Please sign in again.";
    }

    if (error.status === 403) {
      return "You do not have permission to perform this action.";
    }

    return fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function parseApiError(responseBody: string): string | null {
  try {
    const parsed = JSON.parse(responseBody) as {
      message?: string | string[];
    };

    if (Array.isArray(parsed.message)) {
      return parsed.message.join(" ");
    }

    if (typeof parsed.message === "string") {
      return parsed.message;
    }

    return null;
  } catch {
    return null;
  }
}
