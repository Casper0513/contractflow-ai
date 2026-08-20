import { Injectable, NotFoundException } from '@nestjs/common';
import {
  InvoiceStatus,
  JobStatus,
  JobTaskStatus,
  PaymentStatus,
  prisma,
} from '@contractflow/db';

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
  async getForUser(clerkUserId: string) {
    const membership = await prisma.membership.findFirst({
      where: {
        user: {
          clerkUserId,
        },
      },
      select: {
        organizationId: true,
      },
    });

    if (!membership) {
      throw new NotFoundException('No organization membership found');
    }

    const organizationId = membership.organizationId;
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
    ] = await Promise.all([
      prisma.job.count({
        where: {
          organizationId,
          archivedAt: null,
          status: {
            notIn: [JobStatus.COMPLETED, JobStatus.CANCELLED],
          },
        },
      }),

      prisma.job.findMany({
        where: {
          organizationId,
          archivedAt: null,
          status: JobStatus.COMPLETED,

          invoices: {
            none: {
              status: {
                not: InvoiceStatus.VOIDED,
              },
            },
          },
        },

        orderBy: {
          updatedAt: 'desc',
        },

        take: 8,

        select: {
          id: true,
          name: true,
          budgetCents: true,
          updatedAt: true,

          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              companyName: true,
            },
          },
        },
      }),

      prisma.invoice.aggregate({
        where: {
          organizationId,

          status: {
            in: OUTSTANDING_INVOICE_STATUSES,
          },
        },

        _sum: {
          balanceDueCents: true,
        },
      }),

      prisma.payment.aggregate({
        where: {
          organizationId,
          status: PaymentStatus.RECORDED,

          receivedAt: {
            gte: monthStart,
            lt: nextMonthStart,
          },
        },

        _sum: {
          amountCents: true,
        },
      }),

      prisma.job.count({
        where: {
          organizationId,
          archivedAt: null,

          startDate: {
            gte: dayStart,
            lt: nextDayStart,
          },

          status: {
            notIn: [JobStatus.COMPLETED, JobStatus.CANCELLED],
          },
        },
      }),

      prisma.job.findMany({
        where: {
          organizationId,
          archivedAt: null,

          startDate: {
            gte: now,
          },

          status: {
            notIn: [JobStatus.COMPLETED, JobStatus.CANCELLED],
          },
        },

        orderBy: {
          startDate: 'asc',
        },

        take: 5,

        select: {
          id: true,
          name: true,
          status: true,
          startDate: true,

          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              companyName: true,
            },
          },
        },
      }),

      prisma.customerActivity.findMany({
        where: {
          organizationId,
        },

        orderBy: {
          createdAt: 'desc',
        },

        take: 8,

        select: {
          id: true,
          type: true,
          title: true,
          description: true,
          metadata: true,
          createdAt: true,

          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              companyName: true,
            },
          },

          actor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),

      // Financial Action Center: invoices that actually need attention.
      prisma.invoice.findMany({
        where: {
          organizationId,
          status: InvoiceStatus.OVERDUE,
          balanceDueCents: {
            gt: 0,
          },
        },

        orderBy: [
          {
            dueDate: 'asc',
          },
          {
            balanceDueCents: 'desc',
          },
        ],

        take: 8,

        select: {
          id: true,
          number: true,
          status: true,
          currency: true,
          dueDate: true,
          overdueAt: true,
          totalCents: true,
          amountPaidCents: true,
          balanceDueCents: true,

          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              companyName: true,
            },
          },

          job: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),

      // Recent successful payments.
      prisma.payment.findMany({
        where: {
          organizationId,
          status: PaymentStatus.RECORDED,
        },

        orderBy: {
          receivedAt: 'desc',
        },

        take: 8,

        select: {
          id: true,
          amountCents: true,
          method: true,
          reference: true,
          receivedAt: true,

          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              companyName: true,
            },
          },

          invoice: {
            select: {
              id: true,
              number: true,
              currency: true,
            },
          },
        },
      }),

      // Explicitly blocked tasks.
      prisma.jobTask.findMany({
        where: {
          organizationId,
          status: JobTaskStatus.BLOCKED,

          job: {
            archivedAt: null,
            status: {
              notIn: [JobStatus.COMPLETED, JobStatus.CANCELLED],
            },
          },
        },

        orderBy: [
          {
            dueDate: 'asc',
          },
          {
            updatedAt: 'desc',
          },
        ],

        take: 8,

        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          updatedAt: true,

          job: {
            select: {
              id: true,
              name: true,

              customer: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  companyName: true,
                },
              },
            },
          },
        },
      }),

      // Tasks whose due date has passed but which are still open.
      prisma.jobTask.findMany({
        where: {
          organizationId,

          status: {
            in: OPEN_TASK_STATUSES,
          },

          dueDate: {
            lt: dayStart,
          },

          job: {
            archivedAt: null,
            status: {
              notIn: [JobStatus.COMPLETED, JobStatus.CANCELLED],
            },
          },
        },

        orderBy: {
          dueDate: 'asc',
        },

        take: 8,

        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,

          job: {
            select: {
              id: true,
              name: true,

              customer: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  companyName: true,
                },
              },
            },
          },
        },
      }),

      prisma.job.findMany({
        where: {
          organizationId,
          archivedAt: null,
          status: JobStatus.ON_HOLD,
        },

        orderBy: {
          updatedAt: 'desc',
        },

        take: 8,

        select: {
          id: true,
          name: true,
          priority: true,
          updatedAt: true,

          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              companyName: true,
            },
          },
        },
      }),

      // Today's actual schedule entries, not just Job.startDate.
      prisma.jobSchedule.findMany({
        where: {
          organizationId,

          startAt: {
            gte: dayStart,
            lt: nextDayStart,
          },

          cancelledAt: null,

          job: {
            archivedAt: null,
            status: {
              notIn: [JobStatus.COMPLETED, JobStatus.CANCELLED],
            },
          },
        },

        orderBy: {
          startAt: 'asc',
        },

        take: 12,

        select: {
          id: true,
          type: true,
          status: true,
          title: true,
          startAt: true,
          endAt: true,
          allDay: true,
          location: true,

          job: {
            select: {
              id: true,
              name: true,

              customer: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  companyName: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      summary: {
        activeJobs,

        completedUnbilled: completedUnbilledJobs.length,

        outstandingCents: outstanding._sum.balanceDueCents ?? 0,

        collectedThisMonthCents: collectedThisMonth._sum.amountCents ?? 0,

        jobsToday,

        overdueInvoices: overdueInvoices.length,

        blockedTasks: blockedTasks.length,

        overdueTasks: overdueTasks.length,

        jobsOnHold: jobsOnHold.length,

        scheduleItemsToday: todaysSchedule.length,
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
    };
  }
}
