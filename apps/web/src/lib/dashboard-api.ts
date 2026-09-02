import "server-only";

import { authenticatedApiRequest } from "@/lib/server-api";

export type DashboardJobStatus =
  | "LEAD"
  | "ESTIMATING"
  | "APPROVED"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "COMPLETED"
  | "CANCELLED";

export type DashboardTaskStatus =
  "TODO" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED" | "CANCELLED";

export type DashboardTaskPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type DashboardScheduleStatus =
  "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type DashboardScheduleType =
  "WORK" | "SITE_VISIT" | "ESTIMATE" | "INSPECTION" | "DELIVERY" | "MEETING";

export type DashboardInvoiceStatus =
  "DRAFT" | "SENT" | "VIEWED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "VOIDED";

export type DashboardPaymentMethod =
  | "CASH"
  | "CHEQUE"
  | "CREDIT_CARD"
  | "DEBIT_CARD"
  | "E_TRANSFER"
  | "BANK_TRANSFER"
  | "OTHER";

export type DashboardSummary = {
  activeJobs: number;
  completedUnbilled: number;
  outstanding: Array<{
    currency: string;
    amountMinor: number;
  }>;
  collectedThisMonth: Array<{
    currency: string;
    amountMinor: number;
  }>;
  jobsToday: number;

  overdueInvoices: number;
  blockedTasks: number;
  overdueTasks: number;
  jobsOnHold: number;
  scheduleItemsToday: number;

  openFollowUps: number;
  overdueFollowUps: number;
  dueTodayFollowUps: number;
};

export type DashboardCustomer = {
  id: string;
  firstName: string;
  lastName: string | null;
  companyName: string | null;
};

export type ReadyToInvoiceJob = {
  id: string;
  name: string;
  currency: string;
  budgetCents: number | null;
  updatedAt: string;
  customer: DashboardCustomer;
};

export type UpcomingJob = {
  id: string;
  name: string;
  status: DashboardJobStatus;
  startDate: string | null;
  customer: DashboardCustomer;
};

export type DashboardActivityActor = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
};

export type DashboardActivity = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  metadata: unknown;
  createdAt: string;
  customer: DashboardCustomer;
  actor: DashboardActivityActor | null;
};

export type DashboardOverdueInvoice = {
  id: string;
  number: string;
  status: DashboardInvoiceStatus;
  currency: string;
  dueDate: string | null;
  overdueAt: string | null;
  totalCents: number;
  amountPaidCents: number;
  balanceDueCents: number;

  customer: DashboardCustomer;

  job: {
    id: string;
    name: string;
  } | null;
};

export type DashboardRecentPayment = {
  id: string;
  amountCents: number;
  currency: string;
  method: DashboardPaymentMethod;
  reference: string | null;
  receivedAt: string;

  customer: DashboardCustomer;

  invoice: {
    id: string;
    number: string;
    currency: string;
  };
};

export type DashboardTaskAlert = {
  id: string;
  title: string;
  status: DashboardTaskStatus;
  priority: DashboardTaskPriority;
  dueDate: string | null;
  updatedAt?: string;

  job: {
    id: string;
    name: string;
    customer: DashboardCustomer;
  };
};

export type DashboardJobOnHold = {
  id: string;
  name: string;
  priority: DashboardTaskPriority;
  updatedAt: string;
  customer: DashboardCustomer;
};

export type DashboardScheduleItem = {
  id: string;
  type: DashboardScheduleType;
  status: DashboardScheduleStatus;
  title: string;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  location: string | null;

  job: {
    id: string;
    name: string;
    customer: DashboardCustomer;
  };
};

export type DashboardFollowUp = {
  id: string;

  content: string;

  dueAt: string | null;
  completedAt: string | null;

  createdAt: string;
  updatedAt: string;

  customer: DashboardCustomer;

  assignedTo: DashboardActivityActor | null;
};

export type DashboardData = {
  summary: DashboardSummary;

  readyToInvoice: ReadyToInvoiceJob[];

  upcomingJobs: UpcomingJob[];

  recentActivity: DashboardActivity[];

  overdueInvoices: DashboardOverdueInvoice[];

  recentPayments: DashboardRecentPayment[];

  blockedTasks: DashboardTaskAlert[];

  overdueTasks: DashboardTaskAlert[];

  jobsOnHold: DashboardJobOnHold[];

  todaysSchedule: DashboardScheduleItem[];

  myFollowUps: DashboardFollowUp[];

  overdueFollowUps: DashboardFollowUp[];

  dueTodayFollowUps: DashboardFollowUp[];

  upcomingFollowUps: DashboardFollowUp[];
};

export function getDashboard(): Promise<DashboardData> {
  return authenticatedApiRequest<DashboardData>("/dashboard");
}
