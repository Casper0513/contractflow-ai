import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CommunicationCategory,
  CustomerActivityType,
  Prisma,
  prisma,
} from '@contractflow/db';

import { ActivityService } from '../activity/activity.service';
import { OrganizationMembershipService } from '../auth/organization-membership.service';
import { CustomerCommunicationsService } from '../customer-communications/customer-communications.service';
import type { CreateCustomerDto } from './dto/create-customer.dto';
import type { SendCustomerEmailDto } from './dto/send-customer-email.dto';
import type { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    private readonly activityService: ActivityService,
    private readonly customerCommunicationsService: CustomerCommunicationsService,
    private readonly organizationMemberships: OrganizationMembershipService,
  ) {}

  async listForUser(clerkUserId: string, includeArchived = false) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.customer.findMany({
      where: {
        organizationId: membership.organizationId,
        ...(includeArchived
          ? {}
          : {
              archivedAt: null,
            }),
      },
      orderBy: [
        {
          archivedAt: 'asc',
        },
        {
          createdAt: 'desc',
        },
      ],
      select: this.customerSelect(),
    });
  }

  async createForUser(clerkUserId: string, input: CreateCustomerDto) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          organizationId: membership.organizationId,
          firstName: input.firstName.trim(),
          lastName: clean(input.lastName),
          companyName: clean(input.companyName),
          email: clean(input.email)?.toLowerCase(),
          phone: clean(input.phone),
          notes: clean(input.notes),
        },
        select: this.customerSelect(),
      });

      const customerName = [customer.firstName, customer.lastName]
        .filter(Boolean)
        .join(' ');

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,
          customerId: customer.id,
          actorUserId: membership.userId,
          type: CustomerActivityType.CUSTOMER_CREATED,
          title: 'Customer created',
          description: `${customerName} was added to the customer directory.`,
        },
        tx,
      );

      return customer;
    });
  }

  async getByIdForUser(clerkUserId: string, customerId: string) {
    const membership = await this.getMembership(clerkUserId);

    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        organizationId: membership.organizationId,
      },
      select: this.customerSelect(),
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async updateForUser(
    clerkUserId: string,
    customerId: string,
    input: UpdateCustomerDto,
  ) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const existingCustomer = await this.requireCustomerForOrganization(
        membership.organizationId,
        customerId,
        tx,
        {
          id: true,
          firstName: true,
          lastName: true,
          companyName: true,
          email: true,
          phone: true,
          notes: true,
        },
      );

      const nextValues = {
        firstName:
          input.firstName !== undefined
            ? input.firstName.trim()
            : existingCustomer.firstName,

        lastName:
          input.lastName !== undefined
            ? (clean(input.lastName) ?? null)
            : existingCustomer.lastName,

        companyName:
          input.companyName !== undefined
            ? (clean(input.companyName) ?? null)
            : existingCustomer.companyName,

        email:
          input.email !== undefined
            ? (clean(input.email)?.toLowerCase() ?? null)
            : existingCustomer.email,

        phone:
          input.phone !== undefined
            ? (clean(input.phone) ?? null)
            : existingCustomer.phone,

        notes:
          input.notes !== undefined
            ? (clean(input.notes) ?? null)
            : existingCustomer.notes,
      };

      const changes: Record<
        string,
        {
          oldValue: string | null;
          newValue: string | null;
        }
      > = {};

      for (const field of [
        'firstName',
        'lastName',
        'companyName',
        'email',
        'phone',
        'notes',
      ] as const) {
        const oldValue = existingCustomer[field];
        const newValue = nextValues[field];

        if (oldValue !== newValue) {
          changes[field] = {
            oldValue,
            newValue,
          };
        }
      }

      const customer = await tx.customer.update({
        where: {
          id: customerId,
        },
        data: {
          firstName: nextValues.firstName,
          lastName: nextValues.lastName,
          companyName: nextValues.companyName,
          email: nextValues.email,
          phone: nextValues.phone,
          notes: nextValues.notes,
        },
        select: this.customerSelect(),
      });

      if (Object.keys(changes).length > 0) {
        await this.activityService.recordCustomerActivity(
          {
            organizationId: membership.organizationId,
            customerId,
            actorUserId: membership.userId,
            type: CustomerActivityType.CUSTOMER_UPDATED,
            title: 'Customer updated',
            description: 'Customer information was updated.',
            metadata: {
              changes,
            },
          },
          tx,
        );
      }

      return customer;
    });
  }

  async archiveForUser(clerkUserId: string, customerId: string) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      await this.requireCustomerForOrganization(
        membership.organizationId,
        customerId,
        tx,
      );

      const customer = await tx.customer.update({
        where: {
          id: customerId,
        },
        data: {
          archivedAt: new Date(),
        },
        select: this.customerSelect(),
      });

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,
          customerId,
          actorUserId: membership.userId,
          type: CustomerActivityType.CUSTOMER_ARCHIVED,
          title: 'Customer archived',
          description: 'Customer was moved out of the active directory.',
        },
        tx,
      );

      return customer;
    });
  }

  async restoreForUser(clerkUserId: string, customerId: string) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      await this.requireCustomerForOrganization(
        membership.organizationId,
        customerId,
        tx,
      );

      const customer = await tx.customer.update({
        where: {
          id: customerId,
        },
        data: {
          archivedAt: null,
        },
        select: this.customerSelect(),
      });

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,
          customerId,
          actorUserId: membership.userId,
          type: CustomerActivityType.CUSTOMER_RESTORED,
          title: 'Customer restored',
          description: 'Customer was restored to the active directory.',
        },
        tx,
      );

      return customer;
    });
  }

  async listActivityForUser(clerkUserId: string, customerId: string) {
    const membership = await this.getMembership(clerkUserId);

    await this.requireCustomerForOrganization(
      membership.organizationId,
      customerId,
    );

    return this.activityService.listCustomerActivity(
      membership.organizationId,
      customerId,
    );
  }

  async listCommunicationsForUser(clerkUserId: string, customerId: string) {
    const membership = await this.getMembership(clerkUserId);

    await this.requireCustomerForOrganization(
      membership.organizationId,
      customerId,
    );

    return this.customerCommunicationsService.listForCustomer(
      membership.organizationId,
      customerId,
    );
  }

  async sendCommunicationForUser(
    clerkUserId: string,
    customerId: string,
    input: SendCustomerEmailDto,
  ) {
    const membership = await this.getMembership(clerkUserId);

    const customer = await this.requireCustomerForOrganization(
      membership.organizationId,
      customerId,
      prisma,
      {
        id: true,
        email: true,
        archivedAt: true,
      },
    );

    if (customer.archivedAt) {
      throw new BadRequestException('Archived customers cannot be emailed');
    }

    const recipientEmail = customer.email?.trim().toLowerCase();

    if (!recipientEmail) {
      throw new BadRequestException(
        'Customer must have an email address before a message can be sent',
      );
    }

    const subject = input.subject.trim();
    const message = input.message.trim();

    if (!subject) {
      throw new BadRequestException('Email subject is required');
    }

    if (!message) {
      throw new BadRequestException('Email message is required');
    }

    const organization = await prisma.organization.findUnique({
      where: {
        id: membership.organizationId,
      },

      select: {
        name: true,
        legalName: true,
        email: true,
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const businessName = organization.legalName || organization.name;

    const htmlBody = buildCustomerEmailHtml({
      businessName,
      message,
    });

    const textBody = buildCustomerEmailText({
      businessName,
      message,
    });

    return this.customerCommunicationsService.sendEmail({
      organizationId: membership.organizationId,
      customerId,
      actorUserId: membership.userId,

      category: CommunicationCategory.GENERAL,

      recipientEmail,
      subject,
      htmlBody,
      textBody,

      replyTo: organization.email ?? undefined,
    });
  }

  async retryCommunicationForUser(
    clerkUserId: string,
    customerId: string,
    communicationId: string,
  ) {
    const membership = await this.getMembership(clerkUserId);

    await this.requireCustomerForOrganization(
      membership.organizationId,
      customerId,
    );

    return this.customerCommunicationsService.retryFailedGeneralEmail(
      membership.organizationId,
      customerId,
      communicationId,
    );
  }

  async deleteForUser(clerkUserId: string, customerId: string) {
    const membership = await this.getMembership(clerkUserId);

    await this.requireCustomerForOrganization(
      membership.organizationId,
      customerId,
    );

    await prisma.customer.delete({
      where: {
        id: customerId,
      },
    });

    return {
      success: true,
    };
  }

  private async requireCustomerForOrganization(
    organizationId: string,
    customerId: string,
    client: typeof prisma | Prisma.TransactionClient = prisma,
    select: Prisma.CustomerSelect = {
      id: true,
    },
  ) {
    const customer = await client.customer.findFirst({
      where: {
        id: customerId,
        organizationId,
      },
      select,
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  private getMembership(clerkUserId: string) {
    return this.organizationMemberships.resolveForUser(clerkUserId);
  }

  private customerSelect(): Prisma.CustomerSelect {
    return {
      id: true,
      firstName: true,
      lastName: true,
      companyName: true,
      email: true,
      phone: true,
      notes: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
    };
  }
}

function clean(value: string | undefined): string | undefined {
  const result = value?.trim();

  return result || undefined;
}

function buildCustomerEmailHtml({
  businessName,
  message,
}: {
  businessName: string;
  message: string;
}) {
  const paragraphs = message
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;line-height:1.6;">${escapeHtml(
          paragraph,
        ).replace(/\n/g, '<br />')}</p>`,
    )
    .join('');

  return `
    <!doctype html>
    <html>
      <body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b;">
        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          style="background:#f4f4f5;padding:32px 16px;"
        >
          <tr>
            <td align="center">
              <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                style="max-width:620px;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;"
              >
                <tr>
                  <td style="padding:32px;">
                    <p style="margin:0 0 24px;font-size:14px;color:#71717a;">
                      ${escapeHtml(businessName)}
                    </p>

                    ${paragraphs}

                    <p style="margin:24px 0 0;color:#71717a;font-size:14px;">
                      ${escapeHtml(businessName)}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function buildCustomerEmailText({
  businessName,
  message,
}: {
  businessName: string;
  message: string;
}) {
  return `${message}

${businessName}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
