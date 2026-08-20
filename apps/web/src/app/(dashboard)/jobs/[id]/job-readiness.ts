import type { Invoice } from "@/lib/invoices-api";
import type { JobSchedule } from "@/lib/job-schedules-api";
import type { JobTask } from "@/lib/job-tasks-api";
import type { JobStatus } from "@/lib/jobs-api";

export type JobReadiness = {
  activeTaskCount: number;
  completedTaskCount: number;
  cancelledTaskCount: number;
  blockedTaskCount: number;
  remainingTaskCount: number;

  activeScheduleCount: number;
  completedScheduleCount: number;
  cancelledScheduleCount: number;

  taskProgress: number;

  readyToComplete: boolean;

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
};

export function calculateJobReadiness({
  status,
  tasks,
  schedules,
  invoices,
}: CalculateJobReadinessInput): JobReadiness {
  const cancelledTasks = tasks.filter((task) => task.status === "CANCELLED");

  const activeTasks = tasks.filter((task) => task.status !== "CANCELLED");

  const completedTasks = activeTasks.filter((task) => task.status === "COMPLETED");

  const blockedTasks = activeTasks.filter((task) => task.status === "BLOCKED");

  const remainingTasks = activeTasks.filter((task) => task.status !== "COMPLETED");

  const cancelledSchedules = schedules.filter(
    (schedule) => schedule.status === "CANCELLED",
  );

  const activeSchedules = schedules.filter(
    (schedule) => schedule.status === "SCHEDULED" || schedule.status === "IN_PROGRESS",
  );

  const completedSchedules = schedules.filter(
    (schedule) => schedule.status === "COMPLETED",
  );

  const taskProgress =
    activeTasks.length === 0
      ? 100
      : Math.round((completedTasks.length / activeTasks.length) * 100);

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

  const readyToComplete =
    status !== "COMPLETED" && status !== "CANCELLED" && completionBlockers.length === 0;

  /*
   * VOIDED invoices do not count as active billing.
   */
  const activeInvoices = invoices.filter((invoice) => invoice.status !== "VOIDED");

  const hasActiveInvoice = activeInvoices.length > 0;

  const hasPaidInvoice = activeInvoices.some((invoice) => invoice.status === "PAID");

  /*
   * A completed job with no non-voided invoice is ready
   * for billing.
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

    taskProgress,

    readyToComplete,

    hasActiveInvoice,
    hasPaidInvoice,
    readyToInvoice,

    completionBlockers,
  };
}
