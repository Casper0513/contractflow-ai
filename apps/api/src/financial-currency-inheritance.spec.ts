jest.mock('./invoices/invoices.prisma8', () => ({
  createInvoiceLineItemPrisma8: jest.fn(),
  createPaymentPrisma8: jest.fn(),
  generateInvoiceNumberPrisma8: jest.fn(),
  hydrateFullInvoicePrisma8: jest.fn(),
  requireCustomerForOrganizationPrisma8: jest.fn(),
  requireInvoiceForOrganizationPrisma8: jest.fn(),
  writeInvoiceActivityPrisma8: jest.fn(),
}));

jest.mock('@contractflow/db-prisma8', () => ({
  db: {
    transaction: jest.fn(),
    orm: {
      public: {},
    },
  },
  isPrisma8UniqueViolation: jest.fn(() => false),
  setPrisma8Serializable: jest.fn(),

  toPrisma8Timestamp: jest.fn((value: unknown) => value ?? new Date()),

  fromPrisma8Timestamp: jest.fn((value: unknown) => value),

  toPrisma8Numeric: jest.fn((value: unknown) => ({
    toString: () => String(value),
  })),

  prisma8TextParam: jest.fn((value: unknown) => value),

  prisma8TimestampParam: jest.fn((value: unknown) => value),
}));

import { ConfigService } from '@nestjs/config';
import { db, setPrisma8Serializable } from '@contractflow/db-prisma8';
import { EstimateStatus, InvoiceStatus, PaymentMethod } from '@contractflow/db';

import { OrganizationMembershipService } from './auth/organization-membership.service';
import type { Environment } from './config/environment';
import { CustomerCommunicationsService } from './customer-communications/customer-communications.service';
import { EstimatesService } from './estimates/estimates.service';
import { InvoicesService } from './invoices/invoices.service';
import {
  createInvoiceLineItemPrisma8,
  createPaymentPrisma8,
  generateInvoiceNumberPrisma8,
  hydrateFullInvoicePrisma8,
  requireCustomerForOrganizationPrisma8,
  requireInvoiceForOrganizationPrisma8,
  writeInvoiceActivityPrisma8,
} from './invoices/invoices.prisma8';
import { StripePaymentService } from './payments/stripe-payment.service';

type EstimatesServiceInternals = {
  requireCustomerForOrganization(...args: unknown[]): Promise<unknown>;

  generateEstimateNumber(...args: unknown[]): Promise<string>;
};

type InvoicesServiceInternals = {
  recalculateInvoicePaymentState(...args: unknown[]): Promise<unknown>;
};

function createMembershipService(): OrganizationMembershipService {
  return {
    resolveForUser: jest.fn(),
  };
}

function createCustomerCommunicationsService(): CustomerCommunicationsService {
  return {} as CustomerCommunicationsService;
}

function createConfigService(): ConfigService<Environment, true> {
  return {
    get: jest.fn(() => 'sk_test_contractflow'),
  } as unknown as ConfigService<Environment, true>;
}

function mockMembership(membershipService: OrganizationMembershipService) {
  jest.spyOn(membershipService, 'resolveForUser').mockResolvedValue({
    id: 'membership_1',
    userId: 'user_db_1',
    organizationId: 'org_1',
    role: 'OWNER',
  } as never);
}

function mockPrisma8Transaction(client: unknown) {
  (db.transaction as unknown as jest.Mock).mockImplementation(
    async (callback: (client: unknown) => Promise<unknown>) => callback(client),
  );
}

describe('Financial currency inheritance', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('copies the organization currency onto a new estimate', async () => {
    const membershipService = createMembershipService();

    mockMembership(membershipService);

    const service = new EstimatesService(membershipService);

    const internals = service as unknown as EstimatesServiceInternals;

    jest.spyOn(internals, 'requireCustomerForOrganization').mockResolvedValue({
      id: 'customer_1',
    });

    jest
      .spyOn(internals, 'generateEstimateNumber')
      .mockResolvedValue('EST-00001');

    const estimateCreate = jest.fn().mockResolvedValue({
      id: 'estimate_1',
      organizationId: 'org_1',
      customerId: 'customer_1',
      jobId: null,
      createdByUserId: 'user_db_1',
      number: 'EST-00001',
      status: 'DRAFT',
      title: null,
      notes: null,
      terms: null,
      validUntil: null,
      subtotalCents: 1000,
      discountCents: 0,
      taxRate: '0',
      taxCents: 0,
      totalCents: 1000,
      sentAt: null,
      viewedAt: null,
      approvedAt: null,
      declinedAt: null,
      expiredAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      publicAccessCreatedAt: null,
      publicAccessToken: null,
      currency: 'JPY',
    });

    const organizationQuery = {
      where: jest.fn(),
      select: jest.fn(),
      first: jest.fn(),
    };

    organizationQuery.where.mockReturnValue(organizationQuery);
    organizationQuery.select.mockReturnValue(organizationQuery);
    organizationQuery.first.mockResolvedValue({
      currency: 'JPY',
    });

    const estimateLineItemCreate = jest.fn().mockResolvedValue({
      id: 'line_1',
    });

    const customerActivityCreate = jest.fn().mockResolvedValue({
      id: 'activity_1',
    });

    const hydratedEstimateQuery = {
      where: jest.fn(),
      select: jest.fn(),
      first: jest.fn(),
    };

    hydratedEstimateQuery.where.mockReturnValue(hydratedEstimateQuery);
    hydratedEstimateQuery.select.mockReturnValue(hydratedEstimateQuery);
    hydratedEstimateQuery.first.mockResolvedValue({
      id: 'estimate_1',
      organizationId: 'org_1',
      customerId: 'customer_1',
      jobId: null,
      createdByUserId: 'user_db_1',
      number: 'EST-00001',
      status: 'DRAFT',
      title: null,
      notes: null,
      terms: null,
      currency: 'JPY',
      validUntil: null,
      subtotalCents: 1000,
      discountCents: 0,
      taxRate: {
        toString: () => '0',
      },
      taxCents: 0,
      totalCents: 1000,
      sentAt: null,
      viewedAt: null,
      approvedAt: null,
      declinedAt: null,
      expiredAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const customerQuery = {
      where: jest.fn(),
      select: jest.fn(),
      first: jest.fn(),
    };

    customerQuery.where.mockReturnValue(customerQuery);
    customerQuery.select.mockReturnValue(customerQuery);
    customerQuery.first.mockResolvedValue({
      id: 'customer_1',
      firstName: 'Test',
      lastName: 'Customer',
      companyName: null,
      email: null,
      phone: null,
    });

    const userQuery = {
      where: jest.fn(),
      select: jest.fn(),
      first: jest.fn(),
    };

    userQuery.where.mockReturnValue(userQuery);
    userQuery.select.mockReturnValue(userQuery);
    userQuery.first.mockResolvedValue({
      id: 'user_db_1',
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
    });

    const lineItemsQuery = {
      where: jest.fn(),
      select: jest.fn(),
      orderBy: jest.fn(),
      all: jest.fn(),
    };

    lineItemsQuery.where.mockReturnValue(lineItemsQuery);
    lineItemsQuery.select.mockReturnValue(lineItemsQuery);
    lineItemsQuery.orderBy.mockReturnValue(lineItemsQuery);
    lineItemsQuery.all.mockResolvedValue([]);

    mockPrisma8Transaction({
      orm: {
        public: {
          Organization: organizationQuery,
          Estimate: {
            create: estimateCreate,
            where: jest.fn().mockReturnValue(hydratedEstimateQuery),
          },
          EstimateLineItem: {
            create: estimateLineItemCreate,
            where: jest.fn().mockReturnValue(lineItemsQuery),
          },
          Customer: customerQuery,
          User: userQuery,
          CustomerActivity: {
            create: customerActivityCreate,
          },
        },
      },
    });

    await service.createForUser(
      'clerk_user_1',
      {
        customerId: 'customer_1',
        lineItems: [
          {
            description: 'Test work',
            quantity: 1,
            unitPriceCents: 1000,
          },
        ],
      },
      'org_1',
    );

    expect(organizationQuery.where).toHaveBeenCalledWith({
      id: 'org_1',
    });

    expect(estimateCreate).toHaveBeenCalledTimes(1);

    expect(estimateCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        currency: 'JPY',
        organizationId: 'org_1',
        customerId: 'customer_1',
      }),
    );
  });

  it('copies the organization currency onto a directly created invoice', async () => {
    const membershipService = createMembershipService();

    mockMembership(membershipService);

    const service = new InvoicesService(
      createCustomerCommunicationsService(),
      createConfigService(),
      membershipService,
    );

    (requireCustomerForOrganizationPrisma8 as jest.Mock).mockResolvedValue({
      id: 'customer_1',
    });

    (generateInvoiceNumberPrisma8 as jest.Mock).mockResolvedValue('INV-00001');

    (createInvoiceLineItemPrisma8 as jest.Mock).mockResolvedValue({
      id: 'line_1',
    });

    (writeInvoiceActivityPrisma8 as jest.Mock).mockResolvedValue({
      id: 'activity_1',
    });

    const organizationQuery = {
      where: jest.fn(),
      select: jest.fn(),
      first: jest.fn(),
    };

    organizationQuery.where.mockReturnValue(organizationQuery);

    organizationQuery.select.mockReturnValue(organizationQuery);

    organizationQuery.first.mockResolvedValue({
      currency: 'AUD',
    });

    const invoiceCreate = jest.fn().mockResolvedValue({
      id: 'invoice_1',
      organizationId: 'org_1',
      customerId: 'customer_1',
      number: 'INV-00001',
      currency: 'AUD',
      totalCents: 2500,
      balanceDueCents: 2500,
    });

    (hydrateFullInvoicePrisma8 as jest.Mock).mockResolvedValue({
      id: 'invoice_1',
      organizationId: 'org_1',
      customerId: 'customer_1',
      jobId: null,
      sourceEstimateId: null,
      createdByUserId: 'user_db_1',

      number: 'INV-00001',
      status: InvoiceStatus.DRAFT,
      title: null,
      notes: null,
      terms: null,

      currency: 'AUD',

      issueDate: new Date(),
      dueDate: null,

      subtotalCents: 2500,
      discountCents: 0,
      taxRate: '0',
      taxCents: 0,
      totalCents: 2500,

      amountPaidCents: 0,
      balanceDueCents: 2500,

      sentAt: null,
      viewedAt: null,
      paidAt: null,
      overdueAt: null,
      voidedAt: null,

      createdAt: new Date(),
      updatedAt: new Date(),

      publicAccessCreatedAt: null,
      publicAccessToken: null,

      customer: {
        id: 'customer_1',
        firstName: null,
        lastName: null,
        companyName: null,
        email: null,
        phone: null,
      },

      job: null,
      sourceEstimate: null,
      createdBy: null,
      lineItems: [],
      payments: [],
      reminders: [],
    });

    const transactionClient = {
      orm: {
        public: {
          Organization: organizationQuery,

          Invoice: {
            create: invoiceCreate,
          },
        },
      },
    };

    mockPrisma8Transaction(transactionClient);

    await service.createForUser(
      'clerk_user_1',
      {
        customerId: 'customer_1',

        lineItems: [
          {
            description: 'Direct invoice item',

            quantity: 1,

            unitPriceCents: 2500,
          },
        ],
      },
      'org_1',
    );

    expect(organizationQuery.where).toHaveBeenCalledWith({
      id: 'org_1',
    });

    expect(invoiceCreate).toHaveBeenCalledTimes(1);

    expect(invoiceCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        currency: 'AUD',
        organizationId: 'org_1',
        customerId: 'customer_1',
      }),
    );
  });

  it('copies the estimate currency when converting an estimate to an invoice', async () => {
    const membershipService = createMembershipService();

    mockMembership(membershipService);

    const service = new InvoicesService(
      createCustomerCommunicationsService(),
      createConfigService(),
      membershipService,
    );

    (requireCustomerForOrganizationPrisma8 as jest.Mock).mockResolvedValue({
      id: 'customer_1',
    });

    (generateInvoiceNumberPrisma8 as jest.Mock).mockResolvedValue('INV-00002');

    (createInvoiceLineItemPrisma8 as jest.Mock).mockResolvedValue({
      id: 'line_1',
    });

    (writeInvoiceActivityPrisma8 as jest.Mock).mockResolvedValue({
      id: 'activity_1',
    });

    const estimateQuery = {
      where: jest.fn(),
      select: jest.fn(),
      first: jest.fn(),
    };

    estimateQuery.where.mockReturnValue(estimateQuery);

    estimateQuery.select.mockReturnValue(estimateQuery);

    estimateQuery.first.mockResolvedValue({
      id: 'estimate_1',
      organizationId: 'org_1',
      customerId: 'customer_1',
      jobId: null,

      number: 'EST-00001',
      status: EstimateStatus.APPROVED,

      title: 'Approved estimate',

      notes: null,
      terms: null,

      currency: 'EUR',

      subtotalCents: 5000,
      discountCents: 0,

      taxRate: {
        toString: () => '0',
      },

      taxCents: 0,
      totalCents: 5000,
    });

    const estimateLineItemQuery = {
      where: jest.fn(),
      select: jest.fn(),
      orderBy: jest.fn(),
      all: jest.fn(),
    };

    estimateLineItemQuery.where.mockReturnValue(estimateLineItemQuery);

    estimateLineItemQuery.select.mockReturnValue(estimateLineItemQuery);

    estimateLineItemQuery.orderBy.mockReturnValue(estimateLineItemQuery);

    estimateLineItemQuery.all.mockResolvedValue([
      {
        description: 'Converted work',

        quantity: {
          toString: () => '1',
        },

        unitPriceCents: 5000,

        lineTotalCents: 5000,

        sourceJobMaterialId: null,

        position: 0,
      },
    ]);

    const existingInvoiceQuery = {
      where: jest.fn(),
      select: jest.fn(),
      all: jest.fn(),
    };

    existingInvoiceQuery.where.mockReturnValue(existingInvoiceQuery);

    existingInvoiceQuery.select.mockReturnValue(existingInvoiceQuery);

    existingInvoiceQuery.all.mockResolvedValue([]);

    const invoiceCreate = jest.fn().mockResolvedValue({
      id: 'invoice_2',
      organizationId: 'org_1',
      customerId: 'customer_1',
      number: 'INV-00002',
      currency: 'EUR',
      totalCents: 5000,
      balanceDueCents: 5000,
    });

    (hydrateFullInvoicePrisma8 as jest.Mock).mockResolvedValue({
      id: 'invoice_2',
      customerId: 'customer_1',
      number: 'INV-00002',
      currency: 'EUR',
      totalCents: 5000,
      balanceDueCents: 5000,
    });

    const transactionClient = {
      orm: {
        public: {
          Estimate: estimateQuery,

          EstimateLineItem: estimateLineItemQuery,

          Invoice: {
            ...existingInvoiceQuery,

            create: invoiceCreate,
          },
        },
      },
    };

    mockPrisma8Transaction(transactionClient);

    await service.createFromEstimateForUser(
      'clerk_user_1',
      'estimate_1',
      'org_1',
    );

    expect(invoiceCreate).toHaveBeenCalledTimes(1);

    expect(invoiceCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',
        customerId: 'customer_1',
        sourceEstimateId: 'estimate_1',
        currency: 'EUR',
      }),
    );
  });

  it('copies the invoice currency onto a manually recorded payment', async () => {
    const membershipService = createMembershipService();

    mockMembership(membershipService);

    const service = new InvoicesService(
      createCustomerCommunicationsService(),
      createConfigService(),
      membershipService,
    );

    (requireInvoiceForOrganizationPrisma8 as jest.Mock).mockResolvedValue({
      id: 'invoice_1',
      customerId: 'customer_1',
      jobId: null,
      sourceEstimateId: null,

      status: InvoiceStatus.SENT,

      currency: 'CHF',

      discountCents: 0,

      taxRate: '0',

      totalCents: 2000,

      amountPaidCents: 0,

      balanceDueCents: 2000,

      dueDate: null,

      sentAt: new Date(),

      viewedAt: null,

      paidAt: null,

      overdueAt: null,
    });

    const internals = service as unknown as InvoicesServiceInternals;

    jest.spyOn(internals, 'recalculateInvoicePaymentState').mockResolvedValue({
      id: 'invoice_1',
      customerId: 'customer_1',
      number: 'INV-00001',
      currency: 'CHF',

      status: InvoiceStatus.PARTIALLY_PAID,

      totalCents: 2000,

      amountPaidCents: 500,

      balanceDueCents: 1500,
    });

    (createPaymentPrisma8 as jest.Mock).mockResolvedValue({
      id: 'payment_1',
      currency: 'CHF',
      amountCents: 500,
      method: PaymentMethod.CASH,
      receivedAt: new Date(),
    });

    (writeInvoiceActivityPrisma8 as jest.Mock).mockResolvedValue({
      id: 'activity_1',
    });

    const transactionClient = {
      orm: {
        public: {},
      },
    };

    mockPrisma8Transaction(transactionClient);

    await service.recordPaymentForUser(
      'clerk_user_1',
      'invoice_1',
      {
        amountCents: 500,

        method: PaymentMethod.CASH,
      },
      'org_1',
    );

    expect(createPaymentPrisma8).toHaveBeenCalledTimes(1);

    expect(createPaymentPrisma8).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        invoiceId: 'invoice_1',
        currency: 'CHF',
        amountCents: 500,
        method: PaymentMethod.CASH,
      }),
    );
  });

  it('copies the invoice currency onto a Stripe payment', async () => {
    const paymentCreate = jest.fn().mockResolvedValue({
      id: 'payment_1',
      amountCents: 2500,
    });

    const receiptCreate = jest.fn().mockResolvedValue({
      id: 'receipt_1',
    });

    const invoiceUpdate = jest.fn().mockResolvedValue({});

    const activityCreate = jest.fn().mockResolvedValue({
      id: 'activity_1',
    });

    const txOrm = {
      public: {
        StripeWebhookEvent: {
          create: jest.fn().mockResolvedValue({
            id: 'event_1',
          }),
        },

        Payment: {
          where: jest.fn(() => ({
            select: jest.fn(() => ({
              first: jest.fn().mockResolvedValue(null),
            })),
          })),

          create: paymentCreate,
        },

        Invoice: {
          where: jest.fn(() => ({
            select: jest.fn(() => ({
              first: jest.fn().mockResolvedValue({
                id: 'invoice_1',
                customerId: 'customer_1',
                number: 'INV-00001',
                status: 'SENT',
                currency: 'CAD',
                totalCents: 5000,
                amountPaidCents: 0,
                balanceDueCents: 5000,
              }),
            })),

            update: invoiceUpdate,
          })),
        },

        PaymentReceiptDelivery: {
          create: receiptCreate,
        },

        CustomerActivity: {
          create: activityCreate,
        },
      },
    };

    jest.mocked(setPrisma8Serializable).mockResolvedValue(undefined);

    mockPrisma8Transaction({
      orm: txOrm,
    });

    const configService = {
      get: jest.fn(() => 'sk_test_contractflow'),
    };

    const customerCommunicationsService = {};

    const service = new StripePaymentService(
      configService as never,
      customerCommunicationsService as never,
    );

    const checkoutSession = {
      id: 'cs_1',
      metadata: {
        invoiceId: 'invoice_1',
        organizationId: 'org_1',
      },
      amount_total: 2500,
      payment_status: 'paid',
      mode: 'payment',
      payment_intent: 'pi_1',
    };

    const event = {
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: {
        object: checkoutSession,
      },
    };

    const stripeCheckoutService = service as unknown as {
      recordSuccessfulCheckout(
        event: unknown,
        session: unknown,
      ): Promise<string | null>;
    };

    await stripeCheckoutService.recordSuccessfulCheckout(
      event,
      checkoutSession,
    );

    expect(paymentCreate).toHaveBeenCalledTimes(1);

    expect(paymentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',
        customerId: 'customer_1',
        invoiceId: 'invoice_1',
        currency: 'CAD',
        amountCents: 2500,
        provider: 'stripe',
        externalPaymentId: 'pi_1',
      }),
    );
  });
});
