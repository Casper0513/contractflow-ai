import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommunicationCategory } from '@contractflow/db';
import {
  db,
  fromPrisma8Timestamp,
  prisma8TextParam,
  prisma8TimestampParam,
  toPrisma8Timestamp,
} from '@contractflow/db-prisma8';

import { EmailService, type SendEmailAttachment } from '../email/email.service';

export type SendCustomerCommunicationInput = {
  organizationId: string;
  customerId: string;

  actorUserId?: string | null;

  category: CommunicationCategory;

  recipientEmail: string;

  subject: string;

  htmlBody: string;
  textBody: string;

  replyTo?: string;

  attachments?: SendEmailAttachment[];

  idempotencyKey?: string;

  jobId?: string | null;

  estimateId?: string | null;

  invoiceId?: string | null;

  paymentId?: string | null;
};

type OrmSource = typeof db.orm;

type CommunicationRecord = {
  id: string;

  organizationId: string;
  customerId: string;

  actorUserId: string | null;

  jobId: string | null;

  estimateId: string | null;

  invoiceId: string | null;

  paymentId: string | null;

  channel: 'EMAIL';

  direction: 'OUTBOUND';

  category: 'GENERAL' | 'ESTIMATE' | 'INVOICE' | 'PAYMENT' | 'REMINDER';

  status: 'PENDING' | 'SENT' | 'FAILED';

  recipientEmail: string;

  subject: string;

  textBody: string;

  htmlBody: string;

  provider: string | null;

  providerMessageId: string | null;

  errorMessage: string | null;

  sentAt: Parameters<typeof fromPrisma8Timestamp>[0] | null;

  createdAt: Parameters<typeof fromPrisma8Timestamp>[0];

  updatedAt: Parameters<typeof fromPrisma8Timestamp>[0];
};

@Injectable()
export class CustomerCommunicationsService {
  constructor(private readonly emailService: EmailService) {}

  async sendEmail(input: SendCustomerCommunicationInput) {
    await this.requireCustomer(input.organizationId, input.customerId);

    const now = toPrisma8Timestamp();

    const communication = await db.orm.public.CustomerCommunication.create({
      organizationId: input.organizationId,

      customerId: input.customerId,

      actorUserId: input.actorUserId ?? null,

      jobId: input.jobId ?? null,

      estimateId: input.estimateId ?? null,

      invoiceId: input.invoiceId ?? null,

      paymentId: input.paymentId ?? null,

      channel: 'EMAIL',

      direction: 'OUTBOUND',

      category: input.category,

      status: 'PENDING',

      recipientEmail: input.recipientEmail,

      subject: input.subject,

      htmlBody: input.htmlBody,

      textBody: input.textBody,

      provider: 'RESEND',

      providerMessageId: null,

      errorMessage: null,

      sentAt: null,

      createdAt: now,

      updatedAt: now,
    });

    try {
      const delivery = await this.emailService.send({
        to: input.recipientEmail,

        subject: input.subject,

        html: input.htmlBody,

        text: input.textBody,

        replyTo: input.replyTo,

        attachments: input.attachments,

        idempotencyKey: input.idempotencyKey,
      });

      await db.orm.public.CustomerCommunication.where({
        id: communication.id,
      }).update({
        status: 'SENT',

        provider: 'RESEND',

        providerMessageId: delivery.id,

        sentAt: toPrisma8Timestamp(),

        errorMessage: null,

        updatedAt: toPrisma8Timestamp(),
      });

      const sent = await this.requireCommunicationById(communication.id);

      return this.hydrateCommunication(sent);
    } catch (error) {
      await db.orm.public.CustomerCommunication.where({
        id: communication.id,
      }).update({
        status: 'FAILED',

        errorMessage: getCommunicationErrorMessage(error),

        updatedAt: toPrisma8Timestamp(),
      });

      throw error;
    }
  }

  async retryFailedGeneralEmail(
    organizationId: string,
    customerId: string,
    communicationId: string,
  ) {
    await this.requireCustomer(organizationId, customerId);

    const communication = await db.orm.public.CustomerCommunication.where({
      id: communicationId,

      organizationId,

      customerId,
    })
      .select(
        'id',
        'organizationId',
        'customerId',
        'actorUserId',
        'jobId',
        'estimateId',
        'invoiceId',
        'paymentId',
        'channel',
        'direction',
        'category',
        'status',
        'recipientEmail',
        'subject',
        'htmlBody',
        'textBody',
        'provider',
        'providerMessageId',
        'errorMessage',
        'sentAt',
        'createdAt',
        'updatedAt',
      )
      .first();

    if (!communication) {
      throw new NotFoundException('Communication not found');
    }

    if (
      communication.channel !== 'EMAIL' ||
      communication.direction !== 'OUTBOUND'
    ) {
      throw new BadRequestException(
        'Only outbound email communications can be retried',
      );
    }

    if (communication.category !== 'GENERAL') {
      throw new BadRequestException(
        'This communication must be retried from its original workflow',
      );
    }

    if (communication.status !== 'FAILED') {
      throw new BadRequestException(
        'Only failed communications can be retried',
      );
    }

    const organization = await db.orm.public.Organization.where({
      id: organizationId,
    })
      .select('email')
      .first();

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    /*
     * Atomically claim this failed communication.
     *
     * This preserves the Prisma 7 updateMany semantics:
     * only a row that is still FAILED may transition
     * to PENDING.
     */
    const claimed = await this.claimFailedCommunication(
      organizationId,
      customerId,
      communication.id,
    );

    if (!claimed) {
      throw new ConflictException('Communication is already being retried');
    }

    /*
     * Preserve the pre-claim updatedAt value.
     *
     * This provides a stable idempotency key for
     * this exact retry attempt.
     */
    const idempotencyKey =
      `customer-communication-retry/` +
      `${communication.id}/` +
      fromPrisma8Timestamp(communication.updatedAt).toISOString();

    try {
      const delivery = await this.emailService.send({
        to: communication.recipientEmail,

        subject: communication.subject,

        html: communication.htmlBody,

        text: communication.textBody,

        replyTo: organization.email ?? undefined,

        idempotencyKey,
      });

      await db.orm.public.CustomerCommunication.where({
        id: communication.id,
      }).update({
        status: 'SENT',

        provider: 'RESEND',

        providerMessageId: delivery.id,

        sentAt: toPrisma8Timestamp(),

        errorMessage: null,

        updatedAt: toPrisma8Timestamp(),
      });

      const sent = await this.requireCommunicationById(communication.id);

      return this.hydrateCommunication(sent);
    } catch (error) {
      await db.orm.public.CustomerCommunication.where({
        id: communication.id,
      }).update({
        status: 'FAILED',

        errorMessage: getCommunicationErrorMessage(error),

        updatedAt: toPrisma8Timestamp(),
      });

      throw error;
    }
  }

  async listForCustomer(organizationId: string, customerId: string) {
    await this.requireCustomer(organizationId, customerId);

    const communications = await db.orm.public.CustomerCommunication.where({
      organizationId,
      customerId,
    })
      .select(
        'id',
        'organizationId',
        'customerId',
        'actorUserId',
        'jobId',
        'estimateId',
        'invoiceId',
        'paymentId',
        'channel',
        'direction',
        'category',
        'status',
        'recipientEmail',
        'subject',
        'textBody',
        'htmlBody',
        'provider',
        'providerMessageId',
        'errorMessage',
        'sentAt',
        'createdAt',
        'updatedAt',
      )
      .orderBy((model) => model.createdAt.desc())
      .all();

    return Promise.all(
      communications.map((communication) =>
        this.hydrateCommunicationWithRelations(db.orm, communication),
      ),
    );
  }

  private async requireCustomer(
    organizationId: string,
    customerId: string,
    orm: OrmSource = db.orm,
  ) {
    const customer = await orm.public.Customer.where({
      id: customerId,

      organizationId,
    })
      .select('id')
      .first();

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  private async requireCommunicationById(
    communicationId: string,
    orm: OrmSource = db.orm,
  ) {
    const communication = await orm.public.CustomerCommunication.where({
      id: communicationId,
    })
      .select(
        'id',
        'organizationId',
        'customerId',
        'actorUserId',
        'jobId',
        'estimateId',
        'invoiceId',
        'paymentId',
        'channel',
        'direction',
        'category',
        'status',
        'recipientEmail',
        'subject',
        'textBody',
        'htmlBody',
        'provider',
        'providerMessageId',
        'errorMessage',
        'sentAt',
        'createdAt',
        'updatedAt',
      )
      .first();

    if (!communication) {
      throw new NotFoundException('Communication not found');
    }

    return communication;
  }

  private async claimFailedCommunication(
    organizationId: string,
    customerId: string,
    communicationId: string,
  ) {
    return db.transaction(async (tx) => {
      const now = toPrisma8Timestamp();

      const plan = db.raw.sql`
            UPDATE "CustomerCommunication"
            SET
              "status" = 'PENDING',
              "errorMessage" = NULL,
              "providerMessageId" = NULL,
              "sentAt" = NULL,
              "updatedAt" = ${prisma8TimestampParam(now)}
            WHERE
              "id" = ${prisma8TextParam(communicationId)}
              AND "organizationId" = ${prisma8TextParam(organizationId)}
              AND "customerId" = ${prisma8TextParam(customerId)}
              AND "status" = 'FAILED'
          `
        .affectedCount()
        .build();

      const result = await tx.execute(plan);

      return result.affectedRows === 1;
    });
  }

  private hydrateCommunication(communication: CommunicationRecord) {
    return {
      id: communication.id,

      organizationId: communication.organizationId,

      customerId: communication.customerId,

      actorUserId: communication.actorUserId,

      jobId: communication.jobId,

      estimateId: communication.estimateId,

      invoiceId: communication.invoiceId,

      paymentId: communication.paymentId,

      channel: communication.channel,

      direction: communication.direction,

      category: communication.category,

      status: communication.status,

      recipientEmail: communication.recipientEmail,

      subject: communication.subject,

      textBody: communication.textBody,

      htmlBody: communication.htmlBody,

      provider: communication.provider,

      providerMessageId: communication.providerMessageId,

      errorMessage: communication.errorMessage,

      sentAt:
        communication.sentAt === null
          ? null
          : fromPrisma8Timestamp(communication.sentAt),

      createdAt: fromPrisma8Timestamp(communication.createdAt),

      updatedAt: fromPrisma8Timestamp(communication.updatedAt),
    };
  }

  private async hydrateCommunicationWithRelations(
    orm: OrmSource,
    communication: CommunicationRecord,
  ) {
    const [actor, job, estimate, invoice] = await Promise.all([
      communication.actorUserId
        ? orm.public.User.where({
            id: communication.actorUserId,
          })
            .select('id', 'firstName', 'lastName', 'email')
            .first()
        : Promise.resolve(null),

      communication.jobId
        ? orm.public.Job.where({
            id: communication.jobId,
          })
            .select('id', 'name')
            .first()
        : Promise.resolve(null),

      communication.estimateId
        ? orm.public.Estimate.where({
            id: communication.estimateId,
          })
            .select('id', 'number')
            .first()
        : Promise.resolve(null),

      communication.invoiceId
        ? orm.public.Invoice.where({
            id: communication.invoiceId,
          })
            .select('id', 'number')
            .first()
        : Promise.resolve(null),
    ]);

    return {
      ...this.hydrateCommunication(communication),

      actor,
      job,
      estimate,
      invoice,
    };
  }
}

function getCommunicationErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 2000);
  }

  return 'Unknown email delivery error';
}
