import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommunicationCategory } from '@contractflow/db';
import {
  type DatabaseTransaction,
  db,
  fromPrisma8Timestamp,
  toPrisma8Timestamp,
} from '@contractflow/db-prisma8';

import { ActivityService } from '../activity/activity.service';
import { OrganizationMembershipService } from '../auth/organization-membership.service';
import { CustomerCommunicationsService } from '../customer-communications/customer-communications.service';

import type { CreateCustomerDto } from './dto/create-customer.dto';
import type { SendCustomerEmailDto } from './dto/send-customer-email.dto';
import type { UpdateCustomerDto } from './dto/update-customer.dto';

type OrmSource = typeof db.orm;

type CustomerRecord = {
  id: string;
  organizationId: string;

  firstName: string;
  lastName: string | null;

  companyName: string | null;

  email: string | null;
  phone: string | null;

  notes: string | null;

  archivedAt: Parameters<typeof fromPrisma8Timestamp>[0] | null;

  createdAt: Parameters<typeof fromPrisma8Timestamp>[0];

  updatedAt: Parameters<typeof fromPrisma8Timestamp>[0];
};

type ActivityMetadata = Parameters<
  DatabaseTransaction['orm']['public']['CustomerActivity']['create']
>[0]['metadata'];

@Injectable()
export class CustomersService {
  constructor(
    private readonly activityService: ActivityService,

    private readonly customerCommunicationsService: CustomerCommunicationsService,

    private readonly organizationMemberships: OrganizationMembershipService,
  ) {}

  async listForUser(
    clerkUserId: string,
    includeArchived = false,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const customers = await db.orm.public.Customer.where({
      organizationId: membership.organizationId,
    })
      .select(
        'id',
        'organizationId',
        'firstName',
        'lastName',
        'companyName',
        'email',
        'phone',
        'notes',
        'archivedAt',
        'createdAt',
        'updatedAt',
      )
      .all();

    const visibleCustomers = includeArchived
      ? customers
      : customers.filter((customer) => customer.archivedAt === null);

    visibleCustomers.sort((a, b) => {
      const aArchived = a.archivedAt !== null;

      const bArchived = b.archivedAt !== null;

      if (aArchived !== bArchived) {
        return aArchived ? 1 : -1;
      }

      const aCreatedAt = fromPrisma8Timestamp(a.createdAt).getTime();

      const bCreatedAt = fromPrisma8Timestamp(b.createdAt).getTime();

      return bCreatedAt - aCreatedAt;
    });

    return visibleCustomers.map((customer) => this.hydrateCustomer(customer));
  }

  async createForUser(
    clerkUserId: string,
    input: CreateCustomerDto,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return db.transaction(async (tx) => {
      const now = toPrisma8Timestamp();

      const customer = await tx.orm.public.Customer.create({
        organizationId: membership.organizationId,

        firstName: input.firstName.trim(),

        lastName: clean(input.lastName) ?? null,

        companyName: clean(input.companyName) ?? null,

        email: clean(input.email)?.toLowerCase() ?? null,

        phone: clean(input.phone) ?? null,

        notes: clean(input.notes) ?? null,

        archivedAt: null,

        createdAt: now,

        updatedAt: now,
      });

      const customerName = [customer.firstName, customer.lastName]
        .filter(Boolean)
        .join(' ');

      await this.recordCustomerActivity(tx, {
        organizationId: membership.organizationId,

        customerId: customer.id,

        actorUserId: membership.userId,

        type: 'CUSTOMER_CREATED',

        title: 'Customer created',

        description: `${customerName} was added to the customer directory.`,
      });

      return this.hydrateCustomer(customer);
    });
  }

  async getByIdForUser(
    clerkUserId: string,
    customerId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const customer = await this.requireCustomerForOrganization(
      membership.organizationId,
      customerId,
    );

    return this.hydrateCustomer(customer);
  }

  async updateForUser(
    clerkUserId: string,
    customerId: string,
    input: UpdateCustomerDto,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return db.transaction(async (tx) => {
      const existingCustomer = await this.requireCustomerForOrganization(
        membership.organizationId,
        customerId,
        tx.orm,
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

      await tx.orm.public.Customer.where({
        id: customerId,
      }).update({
        firstName: nextValues.firstName,

        lastName: nextValues.lastName,

        companyName: nextValues.companyName,

        email: nextValues.email,

        phone: nextValues.phone,

        notes: nextValues.notes,

        updatedAt: toPrisma8Timestamp(),
      });

      const customer = await this.requireCustomerForOrganization(
        membership.organizationId,
        customerId,
        tx.orm,
      );

      if (Object.keys(changes).length > 0) {
        await this.recordCustomerActivity(tx, {
          organizationId: membership.organizationId,

          customerId,

          actorUserId: membership.userId,

          type: 'CUSTOMER_UPDATED',

          title: 'Customer updated',

          description: 'Customer information was updated.',

          metadata: {
            changes,
          },
        });
      }

      return this.hydrateCustomer(customer);
    });
  }

  async archiveForUser(
    clerkUserId: string,
    customerId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return db.transaction(async (tx) => {
      await this.requireCustomerForOrganization(
        membership.organizationId,
        customerId,
        tx.orm,
      );

      await tx.orm.public.Customer.where({
        id: customerId,
      }).update({
        archivedAt: toPrisma8Timestamp(),

        updatedAt: toPrisma8Timestamp(),
      });

      const customer = await this.requireCustomerForOrganization(
        membership.organizationId,
        customerId,
        tx.orm,
      );

      await this.recordCustomerActivity(tx, {
        organizationId: membership.organizationId,

        customerId,

        actorUserId: membership.userId,

        type: 'CUSTOMER_ARCHIVED',

        title: 'Customer archived',

        description: 'Customer was moved out of the active directory.',
      });

      return this.hydrateCustomer(customer);
    });
  }

  async restoreForUser(
    clerkUserId: string,
    customerId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return db.transaction(async (tx) => {
      await this.requireCustomerForOrganization(
        membership.organizationId,
        customerId,
        tx.orm,
      );

      await tx.orm.public.Customer.where({
        id: customerId,
      }).update({
        archivedAt: null,

        updatedAt: toPrisma8Timestamp(),
      });

      const customer = await this.requireCustomerForOrganization(
        membership.organizationId,
        customerId,
        tx.orm,
      );

      await this.recordCustomerActivity(tx, {
        organizationId: membership.organizationId,

        customerId,

        actorUserId: membership.userId,

        type: 'CUSTOMER_RESTORED',

        title: 'Customer restored',

        description: 'Customer was restored to the active directory.',
      });

      return this.hydrateCustomer(customer);
    });
  }

  async listActivityForUser(
    clerkUserId: string,
    customerId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    await this.requireCustomerForOrganization(
      membership.organizationId,
      customerId,
    );

    return this.activityService.listCustomerActivity(
      membership.organizationId,
      customerId,
    );
  }

  async listCommunicationsForUser(
    clerkUserId: string,
    customerId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

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
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const customer = await this.requireCustomerForOrganization(
      membership.organizationId,
      customerId,
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

    const organization = await db.orm.public.Organization.where({
      id: membership.organizationId,
    })
      .select('name', 'legalName', 'email')
      .first();

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
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

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

  async deleteForUser(
    clerkUserId: string,
    customerId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    await this.requireCustomerForOrganization(
      membership.organizationId,
      customerId,
    );

    await db.orm.public.Customer.where({
      id: customerId,
    }).delete();

    return {
      success: true,
    };
  }

  private async requireCustomerForOrganization(
    organizationId: string,
    customerId: string,
    orm: OrmSource = db.orm,
  ) {
    const customer = await orm.public.Customer.where({
      id: customerId,

      organizationId,
    })
      .select(
        'id',
        'organizationId',
        'firstName',
        'lastName',
        'companyName',
        'email',
        'phone',
        'notes',
        'archivedAt',
        'createdAt',
        'updatedAt',
      )
      .first();

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  private getMembership(clerkUserId: string, activeOrganizationId?: string) {
    return this.organizationMemberships.resolveForUser(
      clerkUserId,
      activeOrganizationId,
    );
  }

  private hydrateCustomer(customer: CustomerRecord) {
    return {
      id: customer.id,

      firstName: customer.firstName,

      lastName: customer.lastName,

      companyName: customer.companyName,

      email: customer.email,

      phone: customer.phone,

      notes: customer.notes,

      archivedAt:
        customer.archivedAt === null
          ? null
          : fromPrisma8Timestamp(customer.archivedAt),

      createdAt: fromPrisma8Timestamp(customer.createdAt),

      updatedAt: fromPrisma8Timestamp(customer.updatedAt),
    };
  }

  private async recordCustomerActivity(
    tx: DatabaseTransaction,
    input: {
      organizationId: string;
      customerId: string;

      actorUserId: string | null;

      type:
        | 'CUSTOMER_CREATED'
        | 'CUSTOMER_UPDATED'
        | 'CUSTOMER_ARCHIVED'
        | 'CUSTOMER_RESTORED';

      title: string;

      description: string;

      metadata?: ActivityMetadata;
    },
  ) {
    await tx.orm.public.CustomerActivity.create({
      organizationId: input.organizationId,

      customerId: input.customerId,

      actorUserId: input.actorUserId,

      _type: input.type,

      title: input.title,

      description: input.description,

      metadata: input.metadata,

      createdAt: toPrisma8Timestamp(),
    });
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
