import { Injectable, NotFoundException } from '@nestjs/common';
import {
  InvoiceStatus,
  JobStatus,
  PaymentStatus,
  prisma,
} from '@contractflow/db';

const OUTSTANDING_INVOICE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.SENT,
  InvoiceStatus.VIEWED,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.OVERDUE,
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
    ]);

    return {
      summary: {
        activeJobs,

        completedUnbilled: completedUnbilledJobs.length,

        outstandingCents: outstanding._sum.balanceDueCents ?? 0,

        collectedThisMonthCents: collectedThisMonth._sum.amountCents ?? 0,

        jobsToday,
      },

      readyToInvoice: completedUnbilledJobs,

      upcomingJobs,

      recentActivity,
    };
  }
}
