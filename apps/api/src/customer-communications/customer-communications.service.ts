import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CommunicationCategory,
  CommunicationChannel,
  CommunicationDirection,
  CommunicationStatus,
  prisma,
} from '@contractflow/db';

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

@Injectable()
export class CustomerCommunicationsService {
  constructor(private readonly emailService: EmailService) {}

  async sendEmail(input: SendCustomerCommunicationInput) {
    await this.requireCustomer(input.organizationId, input.customerId);

    const communication = await prisma.customerCommunication.create({
      data: {
        organizationId: input.organizationId,
        customerId: input.customerId,
        actorUserId: input.actorUserId ?? null,

        jobId: input.jobId ?? null,
        estimateId: input.estimateId ?? null,
        invoiceId: input.invoiceId ?? null,
        paymentId: input.paymentId ?? null,

        channel: CommunicationChannel.EMAIL,
        direction: CommunicationDirection.OUTBOUND,
        category: input.category,
        status: CommunicationStatus.PENDING,

        recipientEmail: input.recipientEmail,
        subject: input.subject,
        htmlBody: input.htmlBody,
        textBody: input.textBody,

        provider: 'RESEND',
      },
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

      return prisma.customerCommunication.update({
        where: {
          id: communication.id,
        },

        data: {
          status: CommunicationStatus.SENT,
          providerMessageId: delivery.id,
          sentAt: new Date(),
          errorMessage: null,
        },
      });
    } catch (error) {
      await prisma.customerCommunication.update({
        where: {
          id: communication.id,
        },

        data: {
          status: CommunicationStatus.FAILED,
          errorMessage: getCommunicationErrorMessage(error),
        },
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

    const communication = await prisma.customerCommunication.findFirst({
      where: {
        id: communicationId,
        organizationId,
        customerId,
      },

      select: {
        id: true,

        channel: true,
        direction: true,
        category: true,
        status: true,

        recipientEmail: true,
        subject: true,
        htmlBody: true,
        textBody: true,

        updatedAt: true,
      },
    });

    if (!communication) {
      throw new NotFoundException('Communication not found');
    }

    if (
      communication.channel !== CommunicationChannel.EMAIL ||
      communication.direction !== CommunicationDirection.OUTBOUND
    ) {
      throw new BadRequestException(
        'Only outbound email communications can be retried',
      );
    }

    if (communication.category !== CommunicationCategory.GENERAL) {
      throw new BadRequestException(
        'This communication must be retried from its original workflow',
      );
    }

    if (communication.status !== CommunicationStatus.FAILED) {
      throw new BadRequestException(
        'Only failed communications can be retried',
      );
    }

    const organization = await prisma.organization.findUnique({
      where: {
        id: organizationId,
      },

      select: {
        email: true,
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    /*
     * Atomically claim this failed communication.
     *
     * If two retry requests race, only one can
     * transition FAILED -> PENDING.
     */
    const claimed = await prisma.customerCommunication.updateMany({
      where: {
        id: communication.id,
        organizationId,
        customerId,
        status: CommunicationStatus.FAILED,
      },

      data: {
        status: CommunicationStatus.PENDING,
        errorMessage: null,
        providerMessageId: null,
        sentAt: null,
      },
    });

    if (claimed.count !== 1) {
      throw new ConflictException('Communication is already being retried');
    }

    /*
     * The previous updatedAt value makes this
     * idempotency key stable for this retry attempt.
     *
     * If the attempt fails, updatedAt changes again,
     * so a later retry receives a new key.
     */
    const idempotencyKey =
      `customer-communication-retry/` +
      `${communication.id}/` +
      communication.updatedAt.toISOString();

    try {
      const delivery = await this.emailService.send({
        to: communication.recipientEmail,
        subject: communication.subject,
        html: communication.htmlBody,
        text: communication.textBody,
        replyTo: organization.email ?? undefined,
        idempotencyKey,
      });

      return prisma.customerCommunication.update({
        where: {
          id: communication.id,
        },

        data: {
          status: CommunicationStatus.SENT,
          provider: 'RESEND',
          providerMessageId: delivery.id,
          sentAt: new Date(),
          errorMessage: null,
        },
      });
    } catch (error) {
      await prisma.customerCommunication.update({
        where: {
          id: communication.id,
        },

        data: {
          status: CommunicationStatus.FAILED,
          errorMessage: getCommunicationErrorMessage(error),
        },
      });

      throw error;
    }
  }

  async listForCustomer(organizationId: string, customerId: string) {
    await this.requireCustomer(organizationId, customerId);

    return prisma.customerCommunication.findMany({
      where: {
        organizationId,
        customerId,
      },

      orderBy: {
        createdAt: 'desc',
      },

      select: {
        id: true,

        channel: true,
        direction: true,
        category: true,
        status: true,

        recipientEmail: true,
        subject: true,
        textBody: true,

        provider: true,
        providerMessageId: true,
        errorMessage: true,

        jobId: true,
        estimateId: true,
        invoiceId: true,
        paymentId: true,

        sentAt: true,
        createdAt: true,
        updatedAt: true,

        actor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },

        job: {
          select: {
            id: true,
            name: true,
          },
        },

        estimate: {
          select: {
            id: true,
            number: true,
          },
        },

        invoice: {
          select: {
            id: true,
            number: true,
          },
        },
      },
    });
  }

  private async requireCustomer(organizationId: string, customerId: string) {
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        organizationId,
      },

      select: {
        id: true,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }
}

function getCommunicationErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 2000);
  }

  return 'Unknown email delivery error';
}
