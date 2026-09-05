import { Injectable } from '@nestjs/common';
import {
  CustomerInternalNoteKind,
  InvoiceStatus,
  JobStatus,
  JobTaskStatus,
  PaymentStatus,
} from '@contractflow/db';
import { db, fromPrisma8Timestamp } from '@contractflow/db-prisma8';

import { OrganizationMembershipService } from '../auth/organization-membership.service';

const OUTSTANDING_INVOICE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.SENT,
  InvoiceStatus.VIEWED,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.OVERDUE,
];

const OPEN_TASK_STATUSES: JobTaskStatus[] = [
  JobTaskStatus.TODO,
  JobTaskStatus.IN_PROGRESS,
  JobTaskStatus.BLOCKED,
];

@Injectable()
export class DashboardService {
  constructor(
    private readonly organizationMemberships: OrganizationMembershipService,
  ) {}

  async getForUser(clerkUserId: string, activeOrganizationId?: string) {
    const membership = await this.organizationMemberships.resolveForUser(
      clerkUserId,
      activeOrganizationId,
    );

    const organizationId = membership.organizationId;

    const userId = membership.userId;

    const now = new Date();

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const nextDayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );

    const [
      activeJobs,
      completedUnbilledJobs,
      outstanding,
      collectedThisMonth,
      jobsToday,
      upcomingJobs,
      recentActivity,
      overdueInvoices,
      recentPayments,
      blockedTasks,
      overdueTasks,
      jobsOnHold,
      todaysSchedule,

      openFollowUpCount,
      overdueFollowUpCount,
      dueTodayFollowUpCount,

      myFollowUps,
      overdueFollowUps,
      dueTodayFollowUps,
      upcomingFollowUps,
    ] = await Promise.all([
      this.countActiveJobsPrisma8(organizationId),

      this.listCompletedUnbilledJobsPrisma8(organizationId),

      this.sumOutstandingInvoicesByCurrencyPrisma8(organizationId),

      this.sumCollectedPaymentsByCurrencyPrisma8(
        organizationId,
        monthStart,
        nextMonthStart,
      ),

      this.countJobsTodayPrisma8(organizationId, dayStart, nextDayStart),

      this.listUpcomingJobsPrisma8(organizationId, now),

      this.listRecentActivityPrisma8(organizationId),

      // Financial Action Center:
      // invoices that actually need attention.
      this.listOverdueInvoicesPrisma8(organizationId),

      // Recent successful payments.
      this.listRecentPaymentsPrisma8(organizationId),

      // Explicitly blocked tasks.
      this.listBlockedTasksPrisma8(organizationId),

      // Open tasks whose due date has passed.
      this.listOverdueTasksPrisma8(organizationId, dayStart),

      this.listJobsOnHoldPrisma8(organizationId),

      // Today's actual schedule entries,
      // not just Job.startDate.
      this.listTodaysSchedulePrisma8(organizationId, dayStart, nextDayStart),

      // All open customer follow-ups.
      this.countDashboardFollowUpsPrisma8(
        organizationId,
        dayStart,
        nextDayStart,
        'OPEN',
      ),

      // All overdue customer follow-ups.
      this.countDashboardFollowUpsPrisma8(
        organizationId,
        dayStart,
        nextDayStart,
        'OVERDUE',
      ),

      // Customer follow-ups due today.
      this.countDashboardFollowUpsPrisma8(
        organizationId,
        dayStart,
        nextDayStart,
        'DUE_TODAY',
      ),

      // Open follow-ups assigned to the
      // currently signed-in ContractFlow user.
      this.listDashboardFollowUpsPrisma8(
        organizationId,
        dayStart,
        nextDayStart,
        {
          mode: 'MY',
          userId,
        },
      ),

      // All overdue customer follow-ups.
      this.listDashboardFollowUpsPrisma8(
        organizationId,
        dayStart,
        nextDayStart,
        {
          mode: 'OVERDUE',
        },
      ),

      // Follow-ups due today.
      this.listDashboardFollowUpsPrisma8(
        organizationId,
        dayStart,
        nextDayStart,
        {
          mode: 'DUE_TODAY',
        },
      ),

      // Future follow-ups after today.
      this.listDashboardFollowUpsPrisma8(
        organizationId,
        dayStart,
        nextDayStart,
        {
          mode: 'UPCOMING',
        },
      ),
    ]);

    return {
      summary: {
        activeJobs,

        completedUnbilled: completedUnbilledJobs.length,

        outstanding: outstanding.map((item) => ({
          currency: item.currency,
          amountMinor: item._sum.balanceDueCents ?? 0,
        })),

        collectedThisMonth: collectedThisMonth.map((item) => ({
          currency: item.currency,
          amountMinor: item._sum.amountCents ?? 0,
        })),

        jobsToday,

        overdueInvoices: overdueInvoices.length,

        blockedTasks: blockedTasks.length,

        overdueTasks: overdueTasks.length,

        jobsOnHold: jobsOnHold.length,

        scheduleItemsToday: todaysSchedule.length,

        openFollowUps: openFollowUpCount,

        overdueFollowUps: overdueFollowUpCount,

        dueTodayFollowUps: dueTodayFollowUpCount,
      },

      readyToInvoice: completedUnbilledJobs,

      upcomingJobs,

      recentActivity,

      overdueInvoices,

      recentPayments,

      blockedTasks,

      overdueTasks,

      jobsOnHold,

      todaysSchedule,

      myFollowUps,

      overdueFollowUps,

      dueTodayFollowUps,

      upcomingFollowUps,
    };
  }
  private async countActiveJobsPrisma8(organizationId: string) {
    const jobs = await db.orm.public.Job.where({
      organizationId,
      archivedAt: null,
    })
      .select('id', 'status')
      .all();

    return jobs.filter(
      (job) =>
        job.status !== JobStatus.COMPLETED &&
        job.status !== JobStatus.CANCELLED,
    ).length;
  }

  private async listCompletedUnbilledJobsPrisma8(organizationId: string) {
    const jobs = await db.orm.public.Job.where({
      organizationId,
      archivedAt: null,
      status: JobStatus.COMPLETED,
    })
      .select(
        'id',
        'customerId',
        'name',
        'currency',
        'budgetCents',
        'updatedAt',
      )
      .all();

    const invoices = await db.orm.public.Invoice.where({
      organizationId,
    })
      .select('jobId', 'status')
      .all();

    const jobsWithNonVoidedInvoice = new Set(
      invoices
        .filter(
          (invoice) =>
            invoice.jobId !== null && invoice.status !== InvoiceStatus.VOIDED,
        )
        .map((invoice) => invoice.jobId as string),
    );

    const result = [];

    for (const job of jobs) {
      if (jobsWithNonVoidedInvoice.has(job.id)) {
        continue;
      }

      const customer = await this.findDashboardCustomerPrisma8(
        organizationId,
        job.customerId,
      );

      result.push({
        id: job.id,

        name: job.name,

        currency: job.currency,

        budgetCents: job.budgetCents,

        updatedAt: fromPrisma8Timestamp(job.updatedAt),

        customer,
      });
    }

    result.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    return result.slice(0, 8);
  }

  private async sumOutstandingInvoicesByCurrencyPrisma8(
    organizationId: string,
  ) {
    const invoices = await db.orm.public.Invoice.where({
      organizationId,
    })
      .select('currency', 'status', 'balanceDueCents')
      .all();

    const totals = new Map<string, number>();

    for (const invoice of invoices) {
      if (!OUTSTANDING_INVOICE_STATUSES.includes(invoice.status)) {
        continue;
      }

      totals.set(
        invoice.currency,
        (totals.get(invoice.currency) ?? 0) + invoice.balanceDueCents,
      );
    }

    return Array.from(totals.entries(), ([currency, amountMinor]) => ({
      currency,
      _sum: {
        balanceDueCents: amountMinor,
      },
    }));
  }

  private async sumCollectedPaymentsByCurrencyPrisma8(
    organizationId: string,
    monthStart: Date,
    nextMonthStart: Date,
  ) {
    const payments = await db.orm.public.Payment.where({
      organizationId,
      status: PaymentStatus.RECORDED,
    })
      .select('currency', 'amountCents', 'receivedAt')
      .all();

    const totals = new Map<string, number>();

    for (const payment of payments) {
      const receivedAt = fromPrisma8Timestamp(payment.receivedAt);

      if (receivedAt < monthStart || receivedAt >= nextMonthStart) {
        continue;
      }

      totals.set(
        payment.currency,
        (totals.get(payment.currency) ?? 0) + payment.amountCents,
      );
    }

    return Array.from(totals.entries(), ([currency, amountMinor]) => ({
      currency,
      _sum: {
        amountCents: amountMinor,
      },
    }));
  }

  private async countJobsTodayPrisma8(
    organizationId: string,
    dayStart: Date,
    nextDayStart: Date,
  ) {
    const jobs = await db.orm.public.Job.where({
      organizationId,
      archivedAt: null,
    })
      .select('id', 'status', 'startDate')
      .all();

    return jobs.filter((job) => {
      if (
        job.status === JobStatus.COMPLETED ||
        job.status === JobStatus.CANCELLED ||
        job.startDate === null
      ) {
        return false;
      }

      const startDate = fromPrisma8Timestamp(job.startDate);

      return startDate >= dayStart && startDate < nextDayStart;
    }).length;
  }

  private async findDashboardCustomerPrisma8(
    organizationId: string,
    customerId: string,
  ) {
    return db.orm.public.Customer.where({
      id: customerId,

      organizationId,
    })
      .select('id', 'firstName', 'lastName', 'companyName')
      .first();
  }

  private async listUpcomingJobsPrisma8(organizationId: string, now: Date) {
    const jobs = await db.orm.public.Job.where({
      organizationId,
      archivedAt: null,
    })
      .select('id', 'customerId', 'name', 'status', 'startDate')
      .all();

    const result = [];

    for (const job of jobs) {
      if (
        job.startDate === null ||
        job.status === JobStatus.COMPLETED ||
        job.status === JobStatus.CANCELLED
      ) {
        continue;
      }

      const startDate = fromPrisma8Timestamp(job.startDate);

      if (startDate < now) {
        continue;
      }

      const customer = await this.findDashboardCustomerPrisma8(
        organizationId,
        job.customerId,
      );

      result.push({
        id: job.id,

        name: job.name,

        status: job.status as JobStatus,

        startDate,

        customer,
      });
    }

    result.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    return result.slice(0, 5);
  }

  private async listRecentActivityPrisma8(organizationId: string) {
    const activities = await db.orm.public.CustomerActivity.where({
      organizationId,
    })
      .select(
        'id',
        'customerId',
        'actorUserId',
        '_type',
        'title',
        'description',
        'metadata',
        'createdAt',
      )
      .all();

    const result = [];

    for (const activity of activities) {
      const customer = await this.findDashboardCustomerPrisma8(
        organizationId,
        activity.customerId,
      );

      const actor = activity.actorUserId
        ? await this.findDashboardUserPrisma8(activity.actorUserId)
        : null;

      result.push({
        id: activity.id,

        type: activity._type,

        title: activity.title,

        description: activity.description,

        metadata: activity.metadata,

        createdAt: fromPrisma8Timestamp(activity.createdAt),

        customer,

        actor,
      });
    }

    result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return result.slice(0, 8);
  }

  private async listOverdueInvoicesPrisma8(organizationId: string) {
    const invoices = await db.orm.public.Invoice.where({
      organizationId,
      status: InvoiceStatus.OVERDUE,
    })
      .select(
        'id',
        'customerId',
        'jobId',
        'number',
        'status',
        'currency',
        'dueDate',
        'overdueAt',
        'totalCents',
        'amountPaidCents',
        'balanceDueCents',
      )
      .all();

    const result = [];

    for (const invoice of invoices) {
      if (invoice.balanceDueCents <= 0) {
        continue;
      }

      const customer = await this.findDashboardCustomerPrisma8(
        organizationId,
        invoice.customerId,
      );

      const job = invoice.jobId
        ? await db.orm.public.Job.where({
            id: invoice.jobId,

            organizationId,
          })
            .select('id', 'name')
            .first()
        : null;

      result.push({
        id: invoice.id,

        number: invoice.number,

        status: invoice.status,

        currency: invoice.currency,

        dueDate: invoice.dueDate ? fromPrisma8Timestamp(invoice.dueDate) : null,

        overdueAt: invoice.overdueAt
          ? fromPrisma8Timestamp(invoice.overdueAt)
          : null,

        totalCents: invoice.totalCents,

        amountPaidCents: invoice.amountPaidCents,

        balanceDueCents: invoice.balanceDueCents,

        customer,

        job,
      });
    }

    result.sort((a, b) => {
      const aDue = a.dueDate ? a.dueDate.getTime() : Number.POSITIVE_INFINITY;

      const bDue = b.dueDate ? b.dueDate.getTime() : Number.POSITIVE_INFINITY;

      if (aDue !== bDue) {
        return aDue - bDue;
      }

      return b.balanceDueCents - a.balanceDueCents;
    });

    return result.slice(0, 8);
  }

  private async listRecentPaymentsPrisma8(organizationId: string) {
    const payments = await db.orm.public.Payment.where({
      organizationId,
      status: PaymentStatus.RECORDED,
    })
      .select(
        'id',
        'customerId',
        'invoiceId',
        'amountCents',
        'currency',
        'method',
        'reference',
        'receivedAt',
      )
      .all();

    const result = [];

    for (const payment of payments) {
      const customer = await this.findDashboardCustomerPrisma8(
        organizationId,
        payment.customerId,
      );

      const invoice = await db.orm.public.Invoice.where({
        id: payment.invoiceId,

        organizationId,
      })
        .select('id', 'number', 'currency')
        .first();

      result.push({
        id: payment.id,

        amountCents: payment.amountCents,

        currency: payment.currency,

        method: payment.method,

        reference: payment.reference,

        receivedAt: fromPrisma8Timestamp(payment.receivedAt),

        customer,

        invoice,
      });
    }

    result.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());

    return result.slice(0, 8);
  }

  private async findDashboardUserPrisma8(userId: string) {
    return db.orm.public.User.where({
      id: userId,
    })
      .select('id', 'firstName', 'lastName', 'email')
      .first();
  }

  private async listBlockedTasksPrisma8(organizationId: string) {
    const tasks = await db.orm.public.JobTask.where({
      organizationId,
      status: JobTaskStatus.BLOCKED,
    })
      .select(
        'id',
        'jobId',
        'title',
        'status',
        'priority',
        'dueDate',
        'updatedAt',
      )
      .all();

    return this.hydrateDashboardTasksPrisma8(
      organizationId,
      tasks,
      (_task) => true,
      (a, b) => {
        const aDue = a.dueDate ? a.dueDate.getTime() : Number.POSITIVE_INFINITY;

        const bDue = b.dueDate ? b.dueDate.getTime() : Number.POSITIVE_INFINITY;

        if (aDue !== bDue) {
          return aDue - bDue;
        }

        return b.updatedAt.getTime() - a.updatedAt.getTime();
      },
    );
  }

  private async listOverdueTasksPrisma8(
    organizationId: string,
    dayStart: Date,
  ) {
    const tasks = await db.orm.public.JobTask.where({
      organizationId,
    })
      .select(
        'id',
        'jobId',
        'title',
        'status',
        'priority',
        'dueDate',
        'updatedAt',
      )
      .all();

    return this.hydrateDashboardTasksPrisma8(
      organizationId,
      tasks,
      (task) =>
        OPEN_TASK_STATUSES.includes(task.status as JobTaskStatus) &&
        task.dueDate !== null &&
        fromPrisma8Timestamp(task.dueDate) < dayStart,
      (a, b) => {
        const aDue = a.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;

        const bDue = b.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;

        return aDue - bDue;
      },
    );
  }

  private async hydrateDashboardTasksPrisma8(
    organizationId: string,
    tasks: Array<{
      id: string;
      jobId: string;
      title: string;
      status: string;
      priority: string;
      dueDate: Parameters<typeof fromPrisma8Timestamp>[0] | null;
      updatedAt: Parameters<typeof fromPrisma8Timestamp>[0];
    }>,
    predicate: (task: (typeof tasks)[number]) => boolean,
    sorter: (
      a: {
        dueDate: Date | null;
        updatedAt: Date;
      },
      b: {
        dueDate: Date | null;
        updatedAt: Date;
      },
    ) => number,
  ) {
    const result = [];

    for (const task of tasks) {
      if (!predicate(task)) {
        continue;
      }

      const job = await db.orm.public.Job.where({
        id: task.jobId,

        organizationId,
      })
        .select('id', 'customerId', 'name', 'status', 'archivedAt')
        .first();

      if (
        !job ||
        job.archivedAt ||
        job.status === JobStatus.COMPLETED ||
        job.status === JobStatus.CANCELLED
      ) {
        continue;
      }

      const customer = await this.findDashboardCustomerPrisma8(
        organizationId,
        job.customerId,
      );

      result.push({
        id: task.id,

        title: task.title,

        status: task.status as JobTaskStatus,

        priority: task.priority,

        dueDate: task.dueDate ? fromPrisma8Timestamp(task.dueDate) : null,

        updatedAt: fromPrisma8Timestamp(task.updatedAt),

        job: {
          id: job.id,

          name: job.name,

          customer,
        },
      });
    }

    result.sort(sorter);

    return result.slice(0, 8);
  }

  private async listJobsOnHoldPrisma8(organizationId: string) {
    const jobs = await db.orm.public.Job.where({
      organizationId,
      archivedAt: null,
      status: JobStatus.ON_HOLD,
    })
      .select('id', 'customerId', 'name', 'priority', 'updatedAt')
      .all();

    const result = [];

    for (const job of jobs) {
      const customer = await this.findDashboardCustomerPrisma8(
        organizationId,
        job.customerId,
      );

      result.push({
        id: job.id,

        name: job.name,

        priority: job.priority,

        updatedAt: fromPrisma8Timestamp(job.updatedAt),

        customer,
      });
    }

    result.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    return result.slice(0, 8);
  }

  private async listTodaysSchedulePrisma8(
    organizationId: string,
    dayStart: Date,
    nextDayStart: Date,
  ) {
    const schedules = await db.orm.public.JobSchedule.where({
      organizationId,
      cancelledAt: null,
    })
      .select(
        'id',
        'jobId',
        '_type',
        'status',
        'title',
        'startAt',
        'endAt',
        'allDay',
        'location',
      )
      .all();

    const result = [];

    for (const schedule of schedules) {
      const startAt = fromPrisma8Timestamp(schedule.startAt);

      if (startAt < dayStart || startAt >= nextDayStart) {
        continue;
      }

      const job = await db.orm.public.Job.where({
        id: schedule.jobId,

        organizationId,
      })
        .select('id', 'customerId', 'name', 'status', 'archivedAt')
        .first();

      if (
        !job ||
        job.archivedAt ||
        job.status === JobStatus.COMPLETED ||
        job.status === JobStatus.CANCELLED
      ) {
        continue;
      }

      const customer = await this.findDashboardCustomerPrisma8(
        organizationId,
        job.customerId,
      );

      result.push({
        id: schedule.id,

        type: schedule._type,

        status: schedule.status,

        title: schedule.title,

        startAt,

        endAt: schedule.endAt ? fromPrisma8Timestamp(schedule.endAt) : null,

        allDay: schedule.allDay,

        location: schedule.location,

        job: {
          id: job.id,

          name: job.name,

          customer,
        },
      });
    }

    result.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

    return result.slice(0, 12);
  }

  private async countDashboardFollowUpsPrisma8(
    organizationId: string,
    dayStart: Date,
    nextDayStart: Date,
    mode: 'OPEN' | 'OVERDUE' | 'DUE_TODAY',
  ) {
    const followUps =
      await this.readOpenDashboardFollowUpsPrisma8(organizationId);

    let count = 0;

    for (const followUp of followUps) {
      if (
        !(await this.isDashboardFollowUpCustomerActivePrisma8(
          organizationId,
          followUp.customerId,
        ))
      ) {
        continue;
      }

      if (mode === 'OPEN') {
        count += 1;

        continue;
      }

      if (followUp.dueAt === null) {
        continue;
      }

      const dueAt = fromPrisma8Timestamp(followUp.dueAt);

      if (mode === 'OVERDUE' && dueAt < dayStart) {
        count += 1;

        continue;
      }

      if (mode === 'DUE_TODAY' && dueAt >= dayStart && dueAt < nextDayStart) {
        count += 1;
      }
    }

    return count;
  }

  private async listDashboardFollowUpsPrisma8(
    organizationId: string,
    dayStart: Date,
    nextDayStart: Date,
    options:
      | {
          mode: 'MY';
          userId: string;
        }
      | {
          mode: 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING';
        },
  ) {
    const followUps =
      await this.readOpenDashboardFollowUpsPrisma8(organizationId);

    const result = [];

    for (const followUp of followUps) {
      if (
        options.mode === 'MY' &&
        followUp.assignedToUserId !== options.userId
      ) {
        continue;
      }

      if (
        !(await this.isDashboardFollowUpCustomerActivePrisma8(
          organizationId,
          followUp.customerId,
        ))
      ) {
        continue;
      }

      const dueAt = followUp.dueAt
        ? fromPrisma8Timestamp(followUp.dueAt)
        : null;

      if (options.mode === 'OVERDUE' && (dueAt === null || dueAt >= dayStart)) {
        continue;
      }

      if (
        options.mode === 'DUE_TODAY' &&
        (dueAt === null || dueAt < dayStart || dueAt >= nextDayStart)
      ) {
        continue;
      }

      if (
        options.mode === 'UPCOMING' &&
        (dueAt === null || dueAt < nextDayStart)
      ) {
        continue;
      }

      const customer = await this.findDashboardCustomerPrisma8(
        organizationId,
        followUp.customerId,
      );

      const assignedTo = followUp.assignedToUserId
        ? await this.findDashboardUserPrisma8(followUp.assignedToUserId)
        : null;

      result.push({
        id: followUp.id,

        content: followUp.content,

        dueAt,

        completedAt: null,

        createdAt: fromPrisma8Timestamp(followUp.createdAt),

        updatedAt: fromPrisma8Timestamp(followUp.updatedAt),

        customer,

        assignedTo,
      });
    }

    result.sort((a, b) => {
      const aDue = a.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;

      const bDue = b.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;

      if (aDue !== bDue) {
        return aDue - bDue;
      }

      if (options.mode === 'MY') {
        return b.createdAt.getTime() - a.createdAt.getTime();
      }

      return 0;
    });

    return result.slice(0, 8);
  }

  private async readOpenDashboardFollowUpsPrisma8(organizationId: string) {
    return db.orm.public.CustomerInternalNote.where({
      organizationId,

      kind: CustomerInternalNoteKind.FOLLOW_UP,

      completedAt: null,
    })
      .select(
        'id',
        'customerId',
        'content',
        'assignedToUserId',
        'dueAt',
        'createdAt',
        'updatedAt',
      )
      .all();
  }

  private async isDashboardFollowUpCustomerActivePrisma8(
    organizationId: string,
    customerId: string,
  ) {
    const customer = await db.orm.public.Customer.where({
      id: customerId,

      organizationId,
    })
      .select('id', 'archivedAt')
      .first();

    return Boolean(customer && !customer.archivedAt);
  }
}
