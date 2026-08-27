import type { Invoice } from "@/lib/invoices-api";
import type { JobChecklist } from "@/lib/job-checklists-api";
import type { JobSchedule } from "@/lib/job-schedules-api";
import type { JobTask } from "@/lib/job-tasks-api";
import type { JobStatus } from "@/lib/jobs-api";

export type JobBillingStatus =
  "NOT_INVOICED" | "DRAFT" | "AWAITING_PAYMENT" | "PARTIALLY_PAID" | "OVERDUE" | "PAID";

export type JobReadiness = {
  activeTaskCount: number;
  completedTaskCount: number;
  cancelledTaskCount: number;
  blockedTaskCount: number;
  remainingTaskCount: number;

  activeScheduleCount: number;
  completedScheduleCount: number;
  cancelledScheduleCount: number;

  checklistItemCount: number;
  completedChecklistItemCount: number;
  remainingChecklistItemCount: number;

  requiredChecklistItemCount: number;
  completedRequiredChecklistItemCount: number;
  remainingRequiredChecklistItemCount: number;

  taskProgress: number;
  checklistProgress: number;
  requiredChecklistProgress: number;

  readyToComplete: boolean;

  activeInvoiceCount: number;
  draftInvoiceCount: number;
  outstandingInvoiceCount: number;
  partiallyPaidInvoiceCount: number;
  overdueInvoiceCount: number;
  paidInvoiceCount: number;

  totalInvoicedCents: number;
  totalPaidCents: number;
  totalBalanceDueCents: number;

  billingStatus: JobBillingStatus;

  hasActiveInvoice: boolean;
  hasPaidInvoice: boolean;
  readyToInvoice: boolean;

  completionBlockers: string[];
};

type CalculateJobReadinessInput = {
  status: JobStatus;
  tasks: JobTask[];
  schedules: JobSchedule[];
  invoices: Invoice[];
  checklists: JobChecklist[];
};

export function calculateJobReadiness({
  status,
  tasks,
  schedules,
  invoices,
  checklists,
}: CalculateJobReadinessInput): JobReadiness {
  /*
   * Tasks
   *
   * Cancelled tasks do not participate in completion readiness.
   */
  const cancelledTasks = tasks.filter((task) => task.status === "CANCELLED");

  const activeTasks = tasks.filter((task) => task.status !== "CANCELLED");

  const completedTasks = activeTasks.filter((task) => task.status === "COMPLETED");

  const blockedTasks = activeTasks.filter((task) => task.status === "BLOCKED");

  const remainingTasks = activeTasks.filter((task) => task.status !== "COMPLETED");

  /*
   * Schedule
   *
   * Only scheduled and in-progress events block completion.
   */
  const cancelledSchedules = schedules.filter(
    (schedule) => schedule.status === "CANCELLED",
  );

  const activeSchedules = schedules.filter(
    (schedule) => schedule.status === "SCHEDULED" || schedule.status === "IN_PROGRESS",
  );

  const completedSchedules = schedules.filter(
    (schedule) => schedule.status === "COMPLETED",
  );

  /*
   * Checklists
   *
   * ALL checklist items must be complete before the job may
   * transition to COMPLETED.
   *
   * Required-only metrics are still retained because they are
   * useful for UI reporting.
   */
  const checklistItems = checklists.flatMap((checklist) => checklist.items);

  const completedChecklistItems = checklistItems.filter(
    (item) => item.completedAt !== null,
  );

  const remainingChecklistItems = checklistItems.filter(
    (item) => item.completedAt === null,
  );

  const requiredChecklistItems = checklistItems.filter((item) => item.required);

  const completedRequiredChecklistItems = requiredChecklistItems.filter(
    (item) => item.completedAt !== null,
  );

  const remainingRequiredChecklistItems = requiredChecklistItems.filter(
    (item) => item.completedAt === null,
  );

  /*
   * Progress
   */
  const taskProgress =
    activeTasks.length === 0
      ? 100
      : Math.round((completedTasks.length / activeTasks.length) * 100);

  const checklistProgress =
    checklistItems.length === 0
      ? 100
      : Math.round((completedChecklistItems.length / checklistItems.length) * 100);

  const requiredChecklistProgress =
    requiredChecklistItems.length === 0
      ? 100
      : Math.round(
          (completedRequiredChecklistItems.length / requiredChecklistItems.length) * 100,
        );

  /*
   * Completion blockers
   */
  const completionBlockers: string[] = [];

  if (remainingTasks.length > 0) {
    completionBlockers.push(
      `${remainingTasks.length} active ${
        remainingTasks.length === 1 ? "task remains" : "tasks remain"
      }.`,
    );
  }

  if (blockedTasks.length > 0) {
    completionBlockers.push(
      `${blockedTasks.length} ${
        blockedTasks.length === 1 ? "task is" : "tasks are"
      } blocked.`,
    );
  }

  if (activeSchedules.length > 0) {
    completionBlockers.push(
      `${activeSchedules.length} scheduled ${
        activeSchedules.length === 1 ? "event remains" : "events remain"
      }.`,
    );
  }

  if (remainingChecklistItems.length > 0) {
    completionBlockers.push(
      `${remainingChecklistItems.length} checklist ${
        remainingChecklistItems.length === 1 ? "item remains" : "items remain"
      }.`,
    );
  }

  const readyToComplete =
    status !== "COMPLETED" && status !== "CANCELLED" && completionBlockers.length === 0;

  /*
   * Billing
   *
   * VOIDED invoices are excluded from the active billing lifecycle.
   */
  const activeInvoices = invoices.filter((invoice) => invoice.status !== "VOIDED");

  const draftInvoices = activeInvoices.filter((invoice) => invoice.status === "DRAFT");

  const outstandingInvoices = activeInvoices.filter(
    (invoice) => invoice.status === "SENT" || invoice.status === "VIEWED",
  );

  const partiallyPaidInvoices = activeInvoices.filter(
    (invoice) => invoice.status === "PARTIALLY_PAID",
  );

  const overdueInvoices = activeInvoices.filter(
    (invoice) => invoice.status === "OVERDUE",
  );

  const paidInvoices = activeInvoices.filter((invoice) => invoice.status === "PAID");

  const totalInvoicedCents = activeInvoices.reduce(
    (total, invoice) => total + invoice.totalCents,
    0,
  );

  const totalPaidCents = activeInvoices.reduce(
    (total, invoice) => total + invoice.amountPaidCents,
    0,
  );

  const totalBalanceDueCents = activeInvoices.reduce(
    (total, invoice) => total + invoice.balanceDueCents,
    0,
  );

  const hasActiveInvoice = activeInvoices.length > 0;

  const hasPaidInvoice = paidInvoices.length > 0;

  /*
   * Billing status priority:
   *
   * OVERDUE
   *   Highest priority because it requires attention.
   *
   * PARTIALLY_PAID
   *   Money has been collected but a balance remains.
   *
   * AWAITING_PAYMENT
   *   Sent/viewed invoices are waiting on the customer.
   *
   * DRAFT
   *   Billing has started but has not been sent.
   *
   * PAID
   *   All remaining active invoices are paid.
   *
   * NOT_INVOICED
   *   No non-voided invoice exists.
   */
  let billingStatus: JobBillingStatus = "NOT_INVOICED";

  if (overdueInvoices.length > 0) {
    billingStatus = "OVERDUE";
  } else if (partiallyPaidInvoices.length > 0) {
    billingStatus = "PARTIALLY_PAID";
  } else if (outstandingInvoices.length > 0) {
    billingStatus = "AWAITING_PAYMENT";
  } else if (draftInvoices.length > 0) {
    billingStatus = "DRAFT";
  } else if (activeInvoices.length > 0 && paidInvoices.length === activeInvoices.length) {
    billingStatus = "PAID";
  }

  /*
   * A completed job with no non-voided invoices is ready
   * for initial billing.
   *
   * Additional invoices remain allowed through the invoice section.
   */
  const readyToInvoice = status === "COMPLETED" && !hasActiveInvoice;

  return {
    activeTaskCount: activeTasks.length,
    completedTaskCount: completedTasks.length,
    cancelledTaskCount: cancelledTasks.length,
    blockedTaskCount: blockedTasks.length,
    remainingTaskCount: remainingTasks.length,

    activeScheduleCount: activeSchedules.length,
    completedScheduleCount: completedSchedules.length,
    cancelledScheduleCount: cancelledSchedules.length,

    checklistItemCount: checklistItems.length,
    completedChecklistItemCount: completedChecklistItems.length,
    remainingChecklistItemCount: remainingChecklistItems.length,

    requiredChecklistItemCount: requiredChecklistItems.length,
    completedRequiredChecklistItemCount: completedRequiredChecklistItems.length,
    remainingRequiredChecklistItemCount: remainingRequiredChecklistItems.length,

    taskProgress,
    checklistProgress,
    requiredChecklistProgress,

    readyToComplete,

    activeInvoiceCount: activeInvoices.length,
    draftInvoiceCount: draftInvoices.length,
    outstandingInvoiceCount: outstandingInvoices.length,
    partiallyPaidInvoiceCount: partiallyPaidInvoices.length,
    overdueInvoiceCount: overdueInvoices.length,
    paidInvoiceCount: paidInvoices.length,

    totalInvoicedCents,
    totalPaidCents,
    totalBalanceDueCents,

    billingStatus,

    hasActiveInvoice,
    hasPaidInvoice,
    readyToInvoice,

    completionBlockers,
  };
}
