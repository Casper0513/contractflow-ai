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

  async askForUser(clerkUserId: string, message: string) {
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

    const [
      customerCount,
      activeJobCount,
      overdueInvoiceCount,
      openEstimateCount,
      recentJobs,
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
        take: 12,
        select: {
          id: true,
          name: true,
          status: true,
          priority: true,
          description: true,
          startDate: true,
          endDate: true,
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
    ]);

    const businessName =
      membership.organization.legalName || membership.organization.name;

    const context = {
      organization: {
        name: businessName,
        timezone: membership.organization.timezone,
        currency: membership.organization.currency,
      },
      summary: {
        activeCustomers: customerCount,
        activeJobs: activeJobCount,
        overdueInvoices: overdueInvoiceCount,
        openEstimates: openEstimateCount,
      },
      recentJobs: recentJobs.map((job) => ({
        id: job.id,
        name: job.name,
        status: job.status,
        priority: job.priority,
        description: job.description,
        startDate: job.startDate,
        endDate: job.endDate,
        updatedAt: job.updatedAt,
        customer: {
          name: [job.customer.firstName, job.customer.lastName]
            .filter(Boolean)
            .join(' '),
          companyName: job.customer.companyName,
        },
      })),
    };

    const client = new OpenAI({
      apiKey,
    });

    const response = await client.responses.create({
      model,
      instructions: [
        'You are ContractFlow AI, an operations assistant for a contracting business.',
        'Answer using only the organization data supplied in the business context.',
        'Never claim to know records that are not present in the supplied context.',
        'If the supplied context is insufficient, clearly say what information is missing.',
        'Be concise, practical, and focused on business operations.',
        'Do not expose internal IDs unless the user explicitly asks for them.',
        'Never imply that you performed an action unless the application actually performed it.',
      ].join(' '),
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `BUSINESS CONTEXT:\n${JSON.stringify(
                context,
                null,
                2,
              )}\n\nUSER QUESTION:\n${message}`,
            },
          ],
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
