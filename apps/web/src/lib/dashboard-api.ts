import "server-only";

import { authenticatedApiRequest } from "@/lib/server-api";

export type DashboardSummary = {
  activeJobs: number;
  completedUnbilled: number;
  outstandingCents: number;
  collectedThisMonthCents: number;
  jobsToday: number;
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
  budgetCents: number | null;
  updatedAt: string;
  customer: DashboardCustomer;
};

export type UpcomingJob = {
  id: string;
  name: string;
  status:
    | "LEAD"
    | "ESTIMATING"
    | "APPROVED"
    | "SCHEDULED"
    | "IN_PROGRESS"
    | "ON_HOLD"
    | "COMPLETED"
    | "CANCELLED";
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

export type DashboardData = {
  summary: DashboardSummary;
  readyToInvoice: ReadyToInvoiceJob[];
  upcomingJobs: UpcomingJob[];
  recentActivity: DashboardActivity[];
};

export function getDashboard(): Promise<DashboardData> {
  return authenticatedApiRequest<DashboardData>("/dashboard");
}
