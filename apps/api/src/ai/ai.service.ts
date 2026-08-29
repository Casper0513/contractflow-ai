import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { prisma } from '@contractflow/db';
import OpenAI from 'openai';

import type { Environment } from '../config/environment';

@Injectable()
export class AiService {
  constructor(
    private readonly configService: ConfigService<Environment, true>,
  ) {}

  async askForUser(
    clerkUserId: string,
    message: string,
    history: Array<{
      role: 'user' | 'assistant';
      content: string;
    }> = [],
  ) {
    const membership = await prisma.membership.findFirst({
      where: {
        user: {
          clerkUserId,
        },
      },
      select: {
        organizationId: true,
        organization: {
          select: {
            name: true,
            legalName: true,
            timezone: true,
            currency: true,
          },
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('No organization membership found');
    }

    const apiKey = this.configService.get('OPENAI_API_KEY', {
      infer: true,
    });

    if (!apiKey) {
      throw new ServiceUnavailableException(
        'ContractFlow AI is not configured',
      );
    }

    const model = this.configService.get('OPENAI_MODEL', {
      infer: true,
    });

    const organizationId = membership.organizationId;
    const organization = membership.organization;
    const currency = organization.currency;
    const now = new Date();

    const [
      customerCount,
      activeJobCount,
      overdueInvoiceCount,
      openEstimateCount,
      recentJobs,
      openEstimates,
      activeInvoices,
      openTasks,
      upcomingSchedules,
      followUps,
      crewMembers,
    ] = await Promise.all([
      prisma.customer.count({
        where: {
          organizationId,
          archivedAt: null,
        },
      }),

      prisma.job.count({
        where: {
          organizationId,
          archivedAt: null,
          status: {
            notIn: ['COMPLETED', 'CANCELLED'],
          },
        },
      }),

      prisma.invoice.count({
        where: {
          organizationId,
          status: 'OVERDUE',
        },
      }),

      prisma.estimate.count({
        where: {
          organizationId,
          status: {
            in: ['DRAFT', 'SENT', 'VIEWED'],
          },
        },
      }),

      prisma.job.findMany({
        where: {
          organizationId,
          archivedAt: null,
        },
        orderBy: {
          updatedAt: 'desc',
        },
        take: 15,
        select: {
          name: true,
          description: true,
          status: true,
          priority: true,
          startDate: true,
          endDate: true,
          budgetCents: true,
          city: true,
          province: true,
          updatedAt: true,
          customer: {
            select: {
              firstName: true,
              lastName: true,
              companyName: true,
            },
          },
        },
      }),

      prisma.estimate.findMany({
        where: {
          organizationId,
          status: {
            in: ['DRAFT', 'SENT', 'VIEWED'],
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
        take: 15,
        select: {
          number: true,
          status: true,
          title: true,
          notes: true,
          validUntil: true,
          subtotalCents: true,
          discountCents: true,
          taxCents: true,
          totalCents: true,
          sentAt: true,
          viewedAt: true,
          createdAt: true,
          updatedAt: true,
          customer: {
            select: {
              firstName: true,
              lastName: true,
              companyName: true,
            },
          },
          job: {
            select: {
              name: true,
              status: true,
            },
          },
        },
      }),

      prisma.invoice.findMany({
        where: {
          organizationId,
          status: {
            in: ['DRAFT', 'SENT', 'VIEWED', 'PARTIALLY_PAID', 'OVERDUE'],
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
        take: 20,
        select: {
          number: true,
          status: true,
          title: true,
          notes: true,
          currency: true,
          issueDate: true,
          dueDate: true,
          totalCents: true,
          amountPaidCents: true,
          balanceDueCents: true,
          sentAt: true,
          viewedAt: true,
          overdueAt: true,
          updatedAt: true,
          customer: {
            select: {
              firstName: true,
              lastName: true,
              companyName: true,
            },
          },
          job: {
            select: {
              name: true,
              status: true,
            },
          },
        },
      }),

      prisma.jobTask.findMany({
        where: {
          organizationId,
          status: {
            notIn: ['COMPLETED', 'CANCELLED'],
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
        take: 25,
        select: {
          title: true,
          description: true,
          status: true,
          priority: true,
          dueDate: true,
          updatedAt: true,
          job: {
            select: {
              name: true,
              status: true,
              customer: {
                select: {
                  firstName: true,
                  lastName: true,
                  companyName: true,
                },
              },
            },
          },
        },
      }),

      prisma.jobSchedule.findMany({
        where: {
          organizationId,
          status: {
            in: ['SCHEDULED', 'IN_PROGRESS'],
          },
          startAt: {
            gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          },
        },
        orderBy: {
          startAt: 'asc',
        },
        take: 30,
        select: {
          type: true,
          status: true,
          title: true,
          description: true,
          startAt: true,
          endAt: true,
          allDay: true,
          location: true,
          notes: true,
          job: {
            select: {
              name: true,
              status: true,
              priority: true,
              customer: {
                select: {
                  firstName: true,
                  lastName: true,
                  companyName: true,
                },
              },
            },
          },
          crewMembers: {
            select: {
              crewMember: {
                select: {
                  firstName: true,
                  lastName: true,
                  active: true,
                },
              },
            },
          },
        },
      }),

      prisma.customerInternalNote.findMany({
        where: {
          organizationId,
          kind: 'FOLLOW_UP',
          completedAt: null,
        },
        orderBy: [
          {
            dueAt: 'asc',
          },
          {
            createdAt: 'desc',
          },
        ],
        take: 25,
        select: {
          content: true,
          dueAt: true,
          createdAt: true,
          customer: {
            select: {
              firstName: true,
              lastName: true,
              companyName: true,
            },
          },
          assignedTo: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),

      prisma.crewMember.findMany({
        where: {
          organizationId,
          active: true,
        },
        orderBy: [
          {
            firstName: 'asc',
          },
          {
            lastName: 'asc',
          },
        ],
        take: 50,
        select: {
          firstName: true,
          lastName: true,
          email: true,
          dailyCapacityMinutes: true,
          active: true,
        },
      }),
    ]);

    const businessName = organization.legalName || organization.name;

    const context = {
      generatedAt: now.toISOString(),

      organization: {
        name: businessName,
        timezone: organization.timezone,
        currency,
        localDate: localDateForTimezone(now, organization.timezone),
      },

      summary: {
        activeCustomers: customerCount,
        activeJobs: activeJobCount,
        overdueInvoices: overdueInvoiceCount,
        openEstimates: openEstimateCount,
        openTasks: openTasks.length,
        activeSchedules: upcomingSchedules.length,
        openFollowUps: followUps.length,
        activeCrewMembers: crewMembers.length,
      },

      recentJobs: recentJobs.map((job) => ({
        name: job.name,
        description: job.description,
        status: job.status,
        priority: job.priority,
        startDate: job.startDate,
        endDate: job.endDate,
        budget:
          job.budgetCents === null ? null : money(job.budgetCents, currency),
        location: compactLocation(job.city, job.province),
        updatedAt: job.updatedAt,
        customer: customerLabel(job.customer),
      })),

      openEstimates: openEstimates.map((estimate) => ({
        number: estimate.number,
        title: estimate.title,
        status: estimate.status,
        customer: customerLabel(estimate.customer),
        job: estimate.job
          ? {
              name: estimate.job.name,
              status: estimate.job.status,
            }
          : null,
        notes: estimate.notes,
        subtotal: money(estimate.subtotalCents, currency),
        discount: money(estimate.discountCents, currency),
        tax: money(estimate.taxCents, currency),
        total: money(estimate.totalCents, currency),
        validUntil: estimate.validUntil,
        sentAt: estimate.sentAt,
        viewedAt: estimate.viewedAt,
        createdAt: estimate.createdAt,
        updatedAt: estimate.updatedAt,
      })),

      activeInvoices: activeInvoices.map((invoice) => ({
        number: invoice.number,
        title: invoice.title,
        status: invoice.status,
        customer: customerLabel(invoice.customer),
        job: invoice.job
          ? {
              name: invoice.job.name,
              status: invoice.job.status,
            }
          : null,
        notes: invoice.notes,
        currency: invoice.currency,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        total: money(invoice.totalCents, invoice.currency),
        amountPaid: money(invoice.amountPaidCents, invoice.currency),
        balanceDue: money(invoice.balanceDueCents, invoice.currency),
        sentAt: invoice.sentAt,
        viewedAt: invoice.viewedAt,
        overdueAt: invoice.overdueAt,
        updatedAt: invoice.updatedAt,
      })),

      openTasks: openTasks.map((task) => ({
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        updatedAt: task.updatedAt,
        job: {
          name: task.job.name,
          status: task.job.status,
          customer: customerLabel(task.job.customer),
        },
      })),

      schedules: upcomingSchedules.map((schedule) => ({
        title: schedule.title,
        description: schedule.description,
        type: schedule.type,
        status: schedule.status,
        startAt: schedule.startAt,
        endAt: schedule.endAt,
        allDay: schedule.allDay,
        location: schedule.location,
        notes: schedule.notes,
        job: {
          name: schedule.job.name,
          status: schedule.job.status,
          priority: schedule.job.priority,
          customer: customerLabel(schedule.job.customer),
        },
        crew: schedule.crewMembers.map(({ crewMember }) =>
          personName(crewMember.firstName, crewMember.lastName),
        ),
      })),

      openFollowUps: followUps.map((followUp) => ({
        customer: customerLabel(followUp.customer),
        content: followUp.content,
        dueAt: followUp.dueAt,
        createdAt: followUp.createdAt,
        assignedTo: followUp.assignedTo
          ? {
              name: personName(
                followUp.assignedTo.firstName,
                followUp.assignedTo.lastName,
              ),
              email: followUp.assignedTo.email,
            }
          : null,
      })),

      activeCrew: crewMembers.map((crewMember) => ({
        name: personName(crewMember.firstName, crewMember.lastName),
        email: crewMember.email,
        dailyCapacityMinutes: crewMember.dailyCapacityMinutes,
      })),
    };

    const client = new OpenAI({
      apiKey,
    });

    const response = await client.responses.create({
      model,

      instructions: [
        'You are ContractFlow AI, an operations assistant for a contracting business.',
        'Use only the organization data supplied in BUSINESS CONTEXT.',
        'All supplied records belong to the authenticated organization.',
        'Never claim to know records or facts that are not present in the supplied context.',
        'If the context is insufficient for a question, clearly explain what information is missing.',
        'Use the organization timezone and local date when reasoning about today, tomorrow, deadlines, overdue work, and schedules.',
        'Prioritize urgent and high-priority work, overdue financial items, overdue follow-ups, blocked tasks, imminent deadlines, and schedule problems when asked what needs attention.',
        'A record does not need an OVERDUE status to deserve attention if its due date has already passed and it still has an outstanding balance or unfinished work.',
        'When discussing estimates, consider status, whether they were sent or viewed, validity date, total value, and age.',
        'When discussing invoices, consider status, due date, outstanding balance, whether they were sent or viewed, and overdue state.',
        'When discussing jobs, consider status, priority, dates, tasks, schedules, customer, and crew assignment.',
        'When discussing schedules, distinguish unassigned work from crew-assigned work.',
        'When discussing follow-ups, consider due date and assigned team member.',
        'Do not assume crew availability merely because a crew member exists. Use supplied schedules and capacity information and clearly state when the context is insufficient for a definitive capacity calculation.',
        'Be concise, practical, and focused on specific operational next steps.',
        'Use plain text with readable numbered or bulleted lists when useful.',
        'Do not use Markdown bold markers such as double asterisks.',
        'Do not expose internal database IDs.',
        'Never imply that you performed an action unless ContractFlow actually performed it.',
      ].join(' '),

      input: [
        {
          role: 'user',
          content: `BUSINESS CONTEXT:\n${JSON.stringify(context, null, 2)}`,
        },

        ...history.slice(-12).map((item) => ({
          role: item.role,
          content: item.content,
        })),

        {
          role: 'user',
          content: message,
        },
      ],
    });

    const answer = response.output_text.trim();

    if (!answer) {
      throw new ServiceUnavailableException(
        'ContractFlow AI returned an empty response',
      );
    }

    return {
      answer,
      model,
      context: {
        activeCustomers: customerCount,
        activeJobs: activeJobCount,
        overdueInvoices: overdueInvoiceCount,
        openEstimates: openEstimateCount,
        recentJobsIncluded: recentJobs.length,
      },
    };
  }
}

type CustomerNameSource = {
  firstName: string;
  lastName: string | null;
  companyName: string | null;
};

function customerLabel(customer: CustomerNameSource) {
  return {
    name: personName(customer.firstName, customer.lastName),
    companyName: customer.companyName,
  };
}

function personName(firstName: string | null, lastName: string | null) {
  return [firstName, lastName].filter(Boolean).join(' ').trim();
}

function compactLocation(city: string | null, province: string | null) {
  const value = [city, province].filter(Boolean).join(', ').trim();

  return value || null;
}

function money(cents: number, currency: string) {
  return {
    cents,
    formatted: `${currency} ${(cents / 100).toFixed(2)}`,
  };
}

function localDateForTimezone(date: Date, timezone: string) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'long',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}
