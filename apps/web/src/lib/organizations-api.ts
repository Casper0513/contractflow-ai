import "server-only";

import { authenticatedApiRequest } from "@/lib/server-api";

export type OrganizationRole =
  "OWNER" | "ADMIN" | "MANAGER" | "TECHNICIAN" | "OFFICE" | "VIEWER";

export type JobScheduleType =
  "WORK" | "SITE_VISIT" | "ESTIMATE" | "INSPECTION" | "DELIVERY" | "MEETING" | "OTHER";

export type OrganizationProfile = {
  id: string;
  name: string;
  slug: string;

  legalName: string | null;

  email: string | null;
  phone: string | null;

  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string;

  taxNumber: string | null;

  website: string | null;
  logoUrl: string | null;

  timezone: string;
  currency: string;

  createdAt: string;
  updatedAt: string;

  role: OrganizationRole;
};

export type UpdateOrganizationProfileInput = {
  name?: string;

  legalName?: string;

  email?: string;
  phone?: string;

  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;

  taxNumber?: string;

  website?: string;
  logoUrl?: string;

  timezone?: string;
  currency?: "CAD" | "USD";
};

export type InvoiceReminderSettings = {
  enabled: boolean;

  beforeDueEnabled: boolean;
  beforeDueDays: number;

  dueTodayEnabled: boolean;

  firstOverdueEnabled: boolean;
  firstOverdueDays: number;

  secondOverdueEnabled: boolean;
  secondOverdueDays: number;

  createdAt: string | null;
  updatedAt: string | null;

  role: OrganizationRole;
};

export type UpdateInvoiceReminderSettingsInput = {
  enabled?: boolean;

  beforeDueEnabled?: boolean;
  beforeDueDays?: number;

  dueTodayEnabled?: boolean;

  firstOverdueEnabled?: boolean;
  firstOverdueDays?: number;

  secondOverdueEnabled?: boolean;
  secondOverdueDays?: number;
};

export type EstimateReminderSettings = {
  enabled: boolean;

  firstFollowUpEnabled: boolean;
  firstFollowUpDays: number;

  secondFollowUpEnabled: boolean;
  secondFollowUpDays: number;

  createdAt: string | null;
  updatedAt: string | null;

  role: OrganizationRole;
};

export type UpdateEstimateReminderSettingsInput = {
  enabled?: boolean;

  firstFollowUpEnabled?: boolean;
  firstFollowUpDays?: number;

  secondFollowUpEnabled?: boolean;
  secondFollowUpDays?: number;
};

export type DispatchSettings = {
  defaultStartHour: number;
  defaultStartMinute: number;
  defaultDurationMinutes: number;
  defaultScheduleType: JobScheduleType;
  defaultCrewDailyCapacityMinutes: number;

  createdAt: string;
  updatedAt: string;

  role: OrganizationRole;
};

export type UpdateDispatchSettingsInput = {
  defaultStartHour?: number;
  defaultStartMinute?: number;
  defaultDurationMinutes?: number;
  defaultScheduleType?: JobScheduleType;
  defaultCrewDailyCapacityMinutes?: number;
};

export function getCurrentOrganization(): Promise<OrganizationProfile> {
  return authenticatedApiRequest<OrganizationProfile>("/organizations/current");
}

export function updateCurrentOrganization(
  input: UpdateOrganizationProfileInput,
): Promise<OrganizationProfile> {
  return authenticatedApiRequest<OrganizationProfile>("/organizations/current", {
    method: "PATCH",
    body: input,
  });
}

export function getInvoiceReminderSettings(): Promise<InvoiceReminderSettings> {
  return authenticatedApiRequest<InvoiceReminderSettings>(
    "/organizations/current/invoice-reminder-settings",
  );
}

export function updateInvoiceReminderSettings(
  input: UpdateInvoiceReminderSettingsInput,
): Promise<InvoiceReminderSettings> {
  return authenticatedApiRequest<InvoiceReminderSettings>(
    "/organizations/current/invoice-reminder-settings",
    {
      method: "PATCH",
      body: input,
    },
  );
}

export function getEstimateReminderSettings(): Promise<EstimateReminderSettings> {
  return authenticatedApiRequest<EstimateReminderSettings>(
    "/organizations/current/estimate-reminder-settings",
  );
}

export function updateEstimateReminderSettings(
  input: UpdateEstimateReminderSettingsInput,
): Promise<EstimateReminderSettings> {
  return authenticatedApiRequest<EstimateReminderSettings>(
    "/organizations/current/estimate-reminder-settings",
    {
      method: "PATCH",
      body: input,
    },
  );
}

export function getDispatchSettings(): Promise<DispatchSettings> {
  return authenticatedApiRequest<DispatchSettings>(
    "/organizations/current/dispatch-settings",
  );
}

export function updateDispatchSettings(
  input: UpdateDispatchSettingsInput,
): Promise<DispatchSettings> {
  return authenticatedApiRequest<DispatchSettings>(
    "/organizations/current/dispatch-settings",
    {
      method: "PATCH",
      body: input,
    },
  );
}
