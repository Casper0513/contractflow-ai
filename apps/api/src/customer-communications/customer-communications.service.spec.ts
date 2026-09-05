jest.mock('@contractflow/db-prisma8', () => ({
  db: {
    transaction: jest.fn(),

    raw: {
      sql: jest.fn(),
    },

    orm: {
      public: {},
    },
  },

  fromPrisma8Timestamp: jest.fn((value) =>
    value instanceof Date ? value : new Date('2026-09-04T08:00:00.000Z'),
  ),

  toPrisma8Timestamp: jest.fn((value) =>
    value instanceof Date ? value : new Date('2026-09-04T08:00:00.000Z'),
  ),

  prisma8TextParam: jest.fn((value: unknown) => value),

  prisma8TimestampParam: jest.fn((value: unknown) => value),
}));

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CommunicationCategory } from '@contractflow/db';
import { db } from '@contractflow/db-prisma8';

import { CustomerCommunicationsService } from './customer-communications.service';

function makeQuery<T>(result: T) {
  const query = {
    where: jest.fn(),

    select: jest.fn(),

    orderBy: jest.fn(),

    first: jest.fn(),

    all: jest.fn(),

    update: jest.fn(),

    delete: jest.fn(),
  };

  query.where.mockReturnValue(query);

  query.select.mockReturnValue(query);

  query.orderBy.mockReturnValue(query);

  query.first.mockResolvedValue(result);

  query.all.mockResolvedValue(result);

  query.update.mockResolvedValue(result);

  query.delete.mockResolvedValue(result);

  return query;
}

function communication(overrides: Record<string, unknown> = {}) {
  return {
    id: 'communication_1',

    organizationId: 'org_1',

    customerId: 'customer_1',

    actorUserId: 'user_1',

    jobId: null,

    estimateId: null,

    invoiceId: null,

    paymentId: null,

    channel: 'EMAIL',

    direction: 'OUTBOUND',

    category: 'GENERAL',

    status: 'FAILED',

    recipientEmail: 'customer@example.com',

    subject: 'Hello',

    textBody: 'Message',

    htmlBody: '<p>Message</p>',

    provider: 'RESEND',

    providerMessageId: null,

    errorMessage: 'Previous failure',

    sentAt: null,

    createdAt: new Date('2026-09-04T07:00:00.000Z'),

    updatedAt: new Date('2026-09-04T07:30:00.000Z'),

    ...overrides,
  };
}

describe('CustomerCommunicationsService Prisma 8', () => {
  const mockedDb = db as unknown as {
    transaction: jest.Mock;

    raw: {
      sql: jest.Mock;
    };

    orm: {
      public: Record<string, unknown>;
    };
  };

  const emailService = {
    send: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends an email and marks the communication SENT', async () => {
    const customerQuery = makeQuery({
      id: 'customer_1',
    });

    const created = communication({
      status: 'PENDING',

      providerMessageId: null,

      errorMessage: null,
    });

    const sent = communication({
      status: 'SENT',

      providerMessageId: 'msg_1',

      errorMessage: null,

      sentAt: new Date('2026-09-04T08:00:00.000Z'),
    });

    const create = jest.fn().mockResolvedValue(created);

    const updateQuery = makeQuery(sent);

    let whereCalls = 0;

    const communicationModel = {
      create,

      where: jest.fn(),
    };

    communicationModel.where.mockImplementation(() => {
      whereCalls += 1;

      if (whereCalls === 1) {
        return updateQuery;
      }

      return makeQuery(sent);
    });

    mockedDb.orm.public = {
      Customer: customerQuery,

      CustomerCommunication: communicationModel,
    };

    emailService.send.mockResolvedValue({
      id: 'msg_1',
    });

    const service = new CustomerCommunicationsService(emailService);

    const result = await service.sendEmail({
      organizationId: 'org_1',

      customerId: 'customer_1',

      actorUserId: 'user_1',

      category: CommunicationCategory.GENERAL,

      recipientEmail: 'customer@example.com',

      subject: 'Hello',

      htmlBody: '<p>Message</p>',

      textBody: 'Message',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'PENDING',

        channel: 'EMAIL',

        direction: 'OUTBOUND',

        provider: 'RESEND',
      }),
    );

    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'customer@example.com',

        subject: 'Hello',
      }),
    );

    expect(updateQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'SENT',

        providerMessageId: 'msg_1',

        errorMessage: null,
      }),
    );

    expect(result.status).toBe('SENT');
  });

  it('marks the communication FAILED when delivery throws', async () => {
    const customerQuery = makeQuery({
      id: 'customer_1',
    });

    const created = communication({
      status: 'PENDING',

      errorMessage: null,
    });

    const create = jest.fn().mockResolvedValue(created);

    const updateQuery = makeQuery(created);

    const communicationModel = {
      create,

      where: jest.fn().mockReturnValue(updateQuery),
    };

    mockedDb.orm.public = {
      Customer: customerQuery,

      CustomerCommunication: communicationModel,
    };

    emailService.send.mockRejectedValue(new Error('Provider unavailable'));

    const service = new CustomerCommunicationsService(emailService);

    await expect(
      service.sendEmail({
        organizationId: 'org_1',

        customerId: 'customer_1',

        category: CommunicationCategory.GENERAL,

        recipientEmail: 'customer@example.com',

        subject: 'Hello',

        htmlBody: '<p>Message</p>',

        textBody: 'Message',
      }),
    ).rejects.toThrow('Provider unavailable');

    expect(updateQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'FAILED',

        errorMessage: 'Provider unavailable',
      }),
    );
  });

  it('retries a failed GENERAL email and marks it SENT', async () => {
    const failed = communication();

    const sent = communication({
      status: 'SENT',

      providerMessageId: 'msg_retry_1',

      errorMessage: null,

      sentAt: new Date('2026-09-04T08:00:00.000Z'),
    });

    const customerQuery = makeQuery({
      id: 'customer_1',
    });

    const organizationQuery = makeQuery({
      email: 'office@example.com',
    });

    let whereCalls = 0;

    const communicationModel = {
      where: jest.fn(),
    };

    communicationModel.where.mockImplementation(() => {
      whereCalls += 1;

      if (whereCalls === 1) {
        return makeQuery(failed);
      }

      if (whereCalls === 2) {
        return {
          update: jest.fn(),
        };
      }

      return makeQuery(sent);
    });

    mockedDb.orm.public = {
      Customer: customerQuery,

      CustomerCommunication: communicationModel,

      Organization: organizationQuery,
    };

    const builtPlan = {
      kind: 'claim-plan',
    };

    mockedDb.raw.sql.mockReturnValue({
      affectedCount: jest.fn().mockReturnValue({
        build: jest.fn().mockReturnValue(builtPlan),
      }),
    });

    mockedDb.transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          execute: jest.fn().mockResolvedValue({
            affectedRows: 1,
          }),
        }),
    );

    emailService.send.mockResolvedValue({
      id: 'msg_retry_1',
    });

    const service = new CustomerCommunicationsService(emailService);

    const result = await service.retryFailedGeneralEmail(
      'org_1',
      'customer_1',
      'communication_1',
    );

    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'customer@example.com',

        replyTo: 'office@example.com',

        idempotencyKey:
          'customer-communication-retry/communication_1/2026-09-04T07:30:00.000Z',
      }),
    );

    expect(result.status).toBe('SENT');
  });

  it('throws ConflictException when the atomic retry claim loses the race', async () => {
    const failed = communication();

    mockedDb.orm.public = {
      Customer: makeQuery({
        id: 'customer_1',
      }),

      CustomerCommunication: makeQuery(failed),

      Organization: makeQuery({
        email: 'office@example.com',
      }),
    };

    mockedDb.raw.sql.mockReturnValue({
      affectedCount: jest.fn().mockReturnValue({
        build: jest.fn().mockReturnValue({
          kind: 'claim-plan',
        }),
      }),
    });

    mockedDb.transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          execute: jest.fn().mockResolvedValue({
            affectedRows: 0,
          }),
        }),
    );

    const service = new CustomerCommunicationsService(emailService);

    await expect(
      service.retryFailedGeneralEmail('org_1', 'customer_1', 'communication_1'),
    ).rejects.toThrow(
      new ConflictException('Communication is already being retried'),
    );

    expect(emailService.send).not.toHaveBeenCalled();
  });

  it('rejects retry when the communication category is not GENERAL', async () => {
    mockedDb.orm.public = {
      Customer: makeQuery({
        id: 'customer_1',
      }),

      CustomerCommunication: makeQuery(
        communication({
          category: 'INVOICE',
        }),
      ),
    };

    const service = new CustomerCommunicationsService(emailService);

    await expect(
      service.retryFailedGeneralEmail('org_1', 'customer_1', 'communication_1'),
    ).rejects.toThrow(
      new BadRequestException(
        'This communication must be retried from its original workflow',
      ),
    );
  });

  it('rejects retry when the communication is not FAILED', async () => {
    mockedDb.orm.public = {
      Customer: makeQuery({
        id: 'customer_1',
      }),

      CustomerCommunication: makeQuery(
        communication({
          status: 'SENT',
        }),
      ),
    };

    const service = new CustomerCommunicationsService(emailService);

    await expect(
      service.retryFailedGeneralEmail('org_1', 'customer_1', 'communication_1'),
    ).rejects.toThrow(
      new BadRequestException('Only failed communications can be retried'),
    );
  });

  it('hydrates list relations explicitly', async () => {
    const listed = communication({
      actorUserId: 'user_1',

      jobId: 'job_1',

      estimateId: 'estimate_1',

      invoiceId: 'invoice_1',
    });

    mockedDb.orm.public = {
      Customer: makeQuery({
        id: 'customer_1',
      }),

      CustomerCommunication: makeQuery([listed]),

      User: makeQuery({
        id: 'user_1',

        firstName: 'Owner',

        lastName: 'User',

        email: 'owner@example.com',
      }),

      Job: makeQuery({
        id: 'job_1',

        name: 'Kitchen Remodel',
      }),

      Estimate: makeQuery({
        id: 'estimate_1',

        number: 'EST-1001',
      }),

      Invoice: makeQuery({
        id: 'invoice_1',

        number: 'INV-1001',
      }),
    };

    const service = new CustomerCommunicationsService(emailService);

    const result = await service.listForCustomer('org_1', 'customer_1');

    expect(result).toHaveLength(1);

    expect(result[0]).toMatchObject({
      actor: {
        id: 'user_1',
      },

      job: {
        id: 'job_1',
      },

      estimate: {
        id: 'estimate_1',
      },

      invoice: {
        id: 'invoice_1',
      },
    });

    expect(result[0]?.createdAt).toBeInstanceOf(Date);
  });

  it('throws Customer not found for an invalid customer', async () => {
    mockedDb.orm.public = {
      Customer: makeQuery(null),
    };

    const service = new CustomerCommunicationsService(emailService);

    await expect(
      service.listForCustomer('org_1', 'missing_customer'),
    ).rejects.toThrow(new NotFoundException('Customer not found'));
  });
});
