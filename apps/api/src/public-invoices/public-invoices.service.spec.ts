import { BadRequestException, NotFoundException } from '@nestjs/common';

jest.mock('@contractflow/db-prisma8', () => ({
  db: {
    transaction: jest.fn(),
    orm: {
      public: {},
    },
    raw: {
      sql: jest.fn(),
    },
  },

  fromPrisma8Timestamp: jest.fn((value) => {
    if (value instanceof Date) {
      return value;
    }

    return new Date('2026-01-01T00:00:00.000Z');
  }),

  prisma8TimestampParam: jest.fn((value: unknown) => value),

  toPrisma8Timestamp: jest.fn(() => new Date('2026-01-02T12:00:00.000Z')),
}));

jest.mock('@contractflow/invoice-pdf', () => ({
  createInvoicePdf: jest.fn(() => Promise.resolve(Buffer.from('pdf'))),
}));

import { db } from '@contractflow/db-prisma8';

import { createInvoicePdf } from '@contractflow/invoice-pdf';

import { PublicInvoicesService } from './public-invoices.service';

const VALID_TOKEN = 'A'.repeat(43);

function makeQuery<T>(result: T) {
  const query = {
    where: jest.fn(),
    select: jest.fn(),
    orderBy: jest.fn(),
    first: jest.fn(),
    all: jest.fn(),
  };

  query.where.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.orderBy.mockReturnValue(query);
  query.first.mockResolvedValue(result);
  query.all.mockResolvedValue(result);

  return query;
}

describe('PublicInvoicesService Prisma 8', () => {
  const mockedDb = db as unknown as {
    transaction: jest.Mock;
    raw: {
      sql: jest.Mock;
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects an invalid token before starting a transaction', async () => {
    const service = new PublicInvoicesService();

    await expect(service.getByToken('bad')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(mockedDb.transaction).not.toHaveBeenCalled();
  });

  it('returns NotFoundException when public invoice does not exist', async () => {
    const invoiceQuery = makeQuery(null);

    const tx = {
      orm: {
        public: {
          Invoice: invoiceQuery,
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new PublicInvoicesService();

    await expect(service.getByToken(VALID_TOKEN)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('hides DRAFT invoices', async () => {
    const invoiceQuery = makeQuery({
      id: 'invoice_1',
      organizationId: 'org_1',
      customerId: 'customer_1',
      number: 'INV-0001',
      status: 'DRAFT',
    });

    const tx = {
      orm: {
        public: {
          Invoice: invoiceQuery,
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new PublicInvoicesService();

    await expect(service.getByToken(VALID_TOKEN)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('records exactly one INVOICE_VIEWED activity when SENT -> VIEWED succeeds', async () => {
    const initialInvoiceQuery = makeQuery({
      id: 'invoice_1',
      organizationId: 'org_1',
      customerId: 'customer_1',
      number: 'INV-0001',
      status: 'SENT',
    });

    const fullInvoiceQuery = makeQuery({
      id: 'invoice_1',
      organizationId: 'org_1',
      customerId: 'customer_1',
      jobId: null,
      sourceEstimateId: null,
      number: 'INV-0001',
      status: 'VIEWED',
      title: null,
      notes: null,
      terms: null,
      currency: 'CAD',
      issueDate: new Date(),
      dueDate: null,
      subtotalCents: 1000,
      discountCents: 0,
      taxRate: '0.0500',
      taxCents: 50,
      totalCents: 1050,
      amountPaidCents: 0,
      balanceDueCents: 1050,
      sentAt: new Date(),
      viewedAt: new Date(),
      paidAt: null,
      overdueAt: null,
      voidedAt: null,
    });

    let invoiceFirstCall = 0;

    const invoiceModel = {
      where: jest.fn(),
    };

    invoiceModel.where.mockImplementation(() => {
      invoiceFirstCall += 1;

      return invoiceFirstCall === 1 ? initialInvoiceQuery : fullInvoiceQuery;
    });

    const activityCreate = jest.fn();

    const customerQuery = makeQuery({
      firstName: 'Jane',
      lastName: 'Doe',
      companyName: null,
      email: 'jane@example.com',
      phone: null,
    });

    const organizationQuery = makeQuery({
      name: 'ContractFlow',
      legalName: null,
      email: null,
      phone: null,
      addressLine1: null,
      addressLine2: null,
      city: null,
      province: null,
      postalCode: null,
      country: 'CA',
      taxNumber: null,
      website: null,
      logoUrl: null,
      timezone: 'America/Edmonton',
      currency: 'CAD',
    });

    const lineItemsQuery = makeQuery([]);

    const paymentsQuery = makeQuery([]);

    const execute = jest.fn().mockResolvedValue({
      affectedRows: 1,
    });

    const tx = {
      execute,
      orm: {
        public: {
          Invoice: invoiceModel,
          Customer: customerQuery,
          Organization: organizationQuery,
          Job: makeQuery(null),
          Estimate: makeQuery(null),
          InvoiceLineItem: lineItemsQuery,
          Payment: paymentsQuery,
          CustomerActivity: {
            create: activityCreate,
          },
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    mockedDb.raw.sql.mockReturnValue({
      affectedCount: jest.fn().mockReturnValue({
        build: jest.fn().mockReturnValue('plan'),
      }),
    });

    const service = new PublicInvoicesService();

    const invoice = await service.getByToken(VALID_TOKEN);

    expect(execute).toHaveBeenCalledWith('plan');

    expect(activityCreate).toHaveBeenCalledTimes(1);

    const activityCreateCalls = activityCreate.mock.calls as Array<
      [
        {
          organizationId?: string;
          customerId?: string;
          actorUserId?: string | null;
          _type?: string;
          metadata?: unknown;
        },
      ]
    >;
    const activityCreateArg = activityCreateCalls[0]?.[0];

    expect(activityCreateArg).toMatchObject({
      organizationId: 'org_1',
      customerId: 'customer_1',
      actorUserId: null,
      _type: 'INVOICE_VIEWED',
    });

    expect(activityCreateArg?.metadata).toMatchObject({
      invoiceId: 'invoice_1',
      previousStatus: 'SENT',
      status: 'VIEWED',
      source: 'public_invoice_portal',
    });

    expect(invoice.status).toBe('VIEWED');
  });

  it('does not create duplicate activity when atomic update affects zero rows', async () => {
    const initialInvoiceQuery = makeQuery({
      id: 'invoice_1',
      organizationId: 'org_1',
      customerId: 'customer_1',
      number: 'INV-0001',
      status: 'SENT',
    });

    const fullInvoiceQuery = makeQuery({
      id: 'invoice_1',
      organizationId: 'org_1',
      customerId: 'customer_1',
      jobId: null,
      sourceEstimateId: null,
      number: 'INV-0001',
      status: 'VIEWED',
      title: null,
      notes: null,
      terms: null,
      currency: 'CAD',
      issueDate: new Date(),
      dueDate: null,
      subtotalCents: 1000,
      discountCents: 0,
      taxRate: '0.0500',
      taxCents: 50,
      totalCents: 1050,
      amountPaidCents: 0,
      balanceDueCents: 1050,
      sentAt: new Date(),
      viewedAt: new Date(),
      paidAt: null,
      overdueAt: null,
      voidedAt: null,
    });

    let invoiceFirstCall = 0;

    const invoiceModel = {
      where: jest.fn(),
    };

    invoiceModel.where.mockImplementation(() => {
      invoiceFirstCall += 1;

      return invoiceFirstCall === 1 ? initialInvoiceQuery : fullInvoiceQuery;
    });

    const activityCreate = jest.fn();

    const tx = {
      execute: jest.fn().mockResolvedValue({
        affectedRows: 0,
      }),

      orm: {
        public: {
          Invoice: invoiceModel,

          Customer: makeQuery({
            firstName: 'Jane',
            lastName: null,
            companyName: null,
            email: null,
            phone: null,
          }),

          Organization: makeQuery({
            name: 'ContractFlow',
            legalName: null,
            email: null,
            phone: null,
            addressLine1: null,
            addressLine2: null,
            city: null,
            province: null,
            postalCode: null,
            country: 'CA',
            taxNumber: null,
            website: null,
            logoUrl: null,
            timezone: 'America/Edmonton',
            currency: 'CAD',
          }),

          Job: makeQuery(null),

          Estimate: makeQuery(null),

          InvoiceLineItem: makeQuery([]),

          Payment: makeQuery([]),

          CustomerActivity: {
            create: activityCreate,
          },
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    mockedDb.raw.sql.mockReturnValue({
      affectedCount: jest.fn().mockReturnValue({
        build: jest.fn().mockReturnValue('plan'),
      }),
    });

    const service = new PublicInvoicesService();

    await service.getByToken(VALID_TOKEN);

    expect(activityCreate).not.toHaveBeenCalled();
  });

  it('reconstructs public invoice relations and converts payment timestamps', async () => {
    const initialInvoiceQuery = makeQuery({
      id: 'invoice_1',
      organizationId: 'org_1',
      customerId: 'customer_1',
      number: 'INV-0001',
      status: 'VIEWED',
    });

    const fullInvoiceQuery = makeQuery({
      id: 'invoice_1',
      organizationId: 'org_1',
      customerId: 'customer_1',
      jobId: 'job_1',
      sourceEstimateId: 'estimate_1',
      number: 'INV-0001',
      status: 'VIEWED',
      title: 'Kitchen',
      notes: 'Notes',
      terms: 'Terms',
      currency: 'CAD',
      issueDate: new Date(),
      dueDate: new Date(),
      subtotalCents: 1000,
      discountCents: 0,
      taxRate: '0.0500',
      taxCents: 50,
      totalCents: 1050,
      amountPaidCents: 500,
      balanceDueCents: 550,
      sentAt: new Date(),
      viewedAt: new Date(),
      paidAt: null,
      overdueAt: null,
      voidedAt: null,
    });

    let invoiceFirstCall = 0;

    const invoiceModel = {
      where: jest.fn(),
    };

    invoiceModel.where.mockImplementation(() => {
      invoiceFirstCall += 1;

      return invoiceFirstCall === 1 ? initialInvoiceQuery : fullInvoiceQuery;
    });

    const lineItemsQuery = makeQuery([
      {
        description: 'Labour',
        quantity: '2.0000',
        unitPriceCents: 500,
        lineTotalCents: 1000,
        position: 0,
      },
    ]);

    const paymentsQuery = makeQuery([
      {
        method: 'E_TRANSFER',
        amountCents: 500,
        receivedAt: new Date(),
      },
    ]);

    const tx = {
      orm: {
        public: {
          Invoice: invoiceModel,

          Customer: makeQuery({
            firstName: 'Jane',
            lastName: 'Doe',
            companyName: 'Doe Contracting',
            email: 'jane@example.com',
            phone: '555-0100',
          }),

          Organization: makeQuery({
            name: 'ContractFlow',
            legalName: 'ContractFlow Inc.',
            email: 'office@example.com',
            phone: '555-0101',
            addressLine1: '1 Main St',
            addressLine2: null,
            city: 'Edmonton',
            province: 'AB',
            postalCode: 'T5J 0N3',
            country: 'CA',
            taxNumber: 'GST123',
            website: 'example.com',
            logoUrl: null,
            timezone: 'America/Edmonton',
            currency: 'CAD',
          }),

          Job: makeQuery({
            name: 'Kitchen Reno',
          }),

          Estimate: makeQuery({
            number: 'EST-0001',
          }),

          InvoiceLineItem: lineItemsQuery,

          Payment: paymentsQuery,
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new PublicInvoicesService();

    const result = await service.getByToken(VALID_TOKEN);

    expect(result.customer.firstName).toBe('Jane');

    expect(result.job).toEqual({
      name: 'Kitchen Reno',
    });

    expect(result.sourceEstimate).toEqual({
      number: 'EST-0001',
    });

    expect(result.organization.currency).toBe('CAD');

    expect(result.lineItems).toHaveLength(1);

    expect(result.payments).toHaveLength(1);

    expect(result.issueDate).toBeInstanceOf(Date);

    expect(result.payments[0]?.receivedAt).toBeInstanceOf(Date);

    expect(paymentsQuery.where).toHaveBeenCalledWith({
      invoiceId: 'invoice_1',
      status: 'RECORDED',
    });

    expect(paymentsQuery.orderBy).toHaveBeenCalled();
  });

  it('getPdfByToken reuses getByToken', async () => {
    const service = new PublicInvoicesService();

    const getByToken = jest.spyOn(service, 'getByToken');

    getByToken.mockResolvedValue({
      number: 'INV-0001',
      status: 'VIEWED',
      title: null,
      currency: 'CAD',
      issueDate: new Date(),
      dueDate: null,
      subtotalCents: 1000,
      discountCents: 0,
      taxRate: '0.0500' as never,
      taxCents: 50,
      totalCents: 1050,
      amountPaidCents: 0,
      balanceDueCents: 1050,
      notes: null,
      terms: null,

      customer: {
        firstName: 'Jane',
        lastName: null,
        companyName: null,
        email: null,
        phone: null,
      },

      job: null,

      sourceEstimate: null,

      organization: {
        name: 'ContractFlow',
        legalName: null,
        email: null,
        phone: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        province: null,
        postalCode: null,
        country: 'CA',
        taxNumber: null,
        website: null,
        logoUrl: null,
        timezone: 'America/Edmonton',
        currency: 'CAD',
      },

      lineItems: [],

      payments: [],

      sentAt: null,
      viewedAt: null,
      paidAt: null,
      overdueAt: null,
      voidedAt: null,
    });

    await service.getPdfByToken(VALID_TOKEN);

    expect(getByToken).toHaveBeenCalledWith(VALID_TOKEN);

    expect(createInvoicePdf).toHaveBeenCalledTimes(1);
  });
});
