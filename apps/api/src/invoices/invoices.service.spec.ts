jest.mock('@contractflow/db-prisma8', () => {
  const rawBuilder = {
    affectedCount: jest.fn(),
    build: jest.fn(),
  };

  rawBuilder.affectedCount.mockReturnValue(rawBuilder);
  rawBuilder.build.mockReturnValue({
    kind: 'raw-plan',
  });

  return {
    db: {
      transaction: jest.fn(),
      orm: {
        public: {},
      },
      raw: {
        sql: jest.fn(() => rawBuilder),
      },
    },
    fromPrisma8Timestamp: jest.fn((value: unknown) => value),
    toPrisma8Timestamp: jest.fn(
      (value: unknown) => value ?? new Date('2026-09-04T16:00:00.000Z'),
    ),
    toPrisma8Numeric: jest.fn((value: unknown) => value),
    isPrisma8UniqueViolation: jest.fn(() => false),
    prisma8TextParam: jest.fn((value: unknown) => value),
    prisma8TimestampParam: jest.fn((value: unknown) => value),
  };
});

import { NotFoundException } from '@nestjs/common';
import { db } from '@contractflow/db-prisma8';

import { InvoicesService } from './invoices.service';

function makeQuery<T>(result: T) {
  const query = {
    where: jest.fn(),
    select: jest.fn(),
    first: jest.fn(),
    update: jest.fn(),
  };

  query.where.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.first.mockResolvedValue(result);
  query.update.mockResolvedValue(result);

  return query;
}

describe('InvoicesService Prisma 8 tenant isolation', () => {
  const mockedDb = db as unknown as {
    transaction: jest.Mock;
    orm: {
      public: Record<string, unknown>;
    };
  };

  const customerCommunicationsService = {};

  const configService = {
    get: jest.fn(),
  };

  const organizationMemberships = {
    resolveForUser: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    organizationMemberships.resolveForUser.mockResolvedValue({
      organizationId: 'org_1',
      userId: 'user_1',
    });

    mockedDb.orm.public = {};
  });

  function service() {
    return new InvoicesService(
      customerCommunicationsService as never,
      configService as never,
      organizationMemberships,
    );
  }

  it('rejects access to an invoice outside the active organization', async () => {
    const invoiceQuery = makeQuery(null);

    mockedDb.orm.public.Invoice = invoiceQuery;

    await expect(
      service().getByIdForUser('clerk_1', 'invoice_foreign', 'org_1'),
    ).rejects.toThrow(new NotFoundException('Invoice not found'));

    expect(invoiceQuery.where).toHaveBeenCalledWith({
      id: 'invoice_foreign',
      organizationId: 'org_1',
    });
  });

  it('rejects voiding a payment outside the active organization', async () => {
    const invoiceQuery = makeQuery({
      id: 'invoice_1',
      customerId: 'customer_1',
      jobId: null,
      sourceEstimateId: null,
      status: 'SENT',
      currency: 'CAD',
      discountCents: 0,
      taxRate: '5.0000',
      totalCents: 1000,
      amountPaidCents: 500,
      balanceDueCents: 500,
      dueDate: null,
      sentAt: null,
      viewedAt: null,
      paidAt: null,
      overdueAt: null,
    });

    const paymentQuery = makeQuery(null);

    const tx = {
      orm: {
        public: {
          Invoice: invoiceQuery,
          Payment: paymentQuery,
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (txArg: unknown) => Promise<unknown>) => callback(tx),
    );

    await expect(
      service().voidPaymentForUser(
        'clerk_1',
        'invoice_1',
        'payment_foreign',
        'org_1',
      ),
    ).rejects.toThrow(new NotFoundException('Payment not found'));

    expect(paymentQuery.where).toHaveBeenCalledWith({
      id: 'payment_foreign',
      invoiceId: 'invoice_1',
      organizationId: 'org_1',
    });
  });
});
