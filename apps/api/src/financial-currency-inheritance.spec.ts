import { ConfigService } from '@nestjs/config';
import {
  EstimateStatus,
  InvoiceStatus,
  PaymentMethod,
  prisma,
} from '@contractflow/db';
import Stripe from 'stripe';

import { ActivityService } from './activity/activity.service';
import { OrganizationMembershipService } from './auth/organization-membership.service';
import type { Environment } from './config/environment';
import { CustomerCommunicationsService } from './customer-communications/customer-communications.service';
import { EstimatesService } from './estimates/estimates.service';
import { InvoicesService } from './invoices/invoices.service';
import { StripePaymentService } from './payments/stripe-payment.service';

type TransactionHost = {
  $transaction(
    callback: (client: unknown) => Promise<unknown>,
  ): Promise<unknown>;
};

type EstimatesServiceInternals = {
  requireCustomerForOrganization(...args: unknown[]): Promise<unknown>;

  generateEstimateNumber(...args: unknown[]): Promise<string>;
};

type InvoicesServiceInternals = {
  requireCustomerForOrganization(...args: unknown[]): Promise<unknown>;

  generateInvoiceNumber(...args: unknown[]): Promise<string>;

  requireInvoiceForOrganization(...args: unknown[]): Promise<unknown>;

  recalculateInvoicePaymentState(...args: unknown[]): Promise<unknown>;
};

type StripePaymentServiceInternals = {
  ensurePaymentReceiptDelivery(paymentId: string): Promise<void>;

  tryPaymentReceiptDelivery(
    paymentId: string,
  ): Promise<'sent' | 'failed' | 'skipped'>;
};

function createMembershipService(): OrganizationMembershipService {
  return {
    resolveForUser: jest.fn(),
  };
}

function createActivityService(): ActivityService {
  return {
    recordCustomerActivity: jest.fn().mockResolvedValue(undefined),
  } as unknown as ActivityService;
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

function mockTransaction(client: unknown) {
  const transactionHost = prisma as unknown as TransactionHost;

  jest
    .spyOn(transactionHost, '$transaction')
    .mockImplementation(async (callback) => callback(client));
}

describe('Financial currency inheritance', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('copies the organization currency onto a new estimate', async () => {
    const activityService = createActivityService();
    const membershipService = createMembershipService();

    mockMembership(membershipService);

    const service = new EstimatesService(activityService, membershipService);

    const internals = service as unknown as EstimatesServiceInternals;

    jest.spyOn(internals, 'requireCustomerForOrganization').mockResolvedValue({
      id: 'customer_1',
    });

    jest
      .spyOn(internals, 'generateEstimateNumber')
      .mockResolvedValue('EST-00001');

    const estimateCreate = jest
      .fn<Promise<unknown>, [unknown]>()
      .mockResolvedValue({
        id: 'estimate_1',
        organizationId: 'org_1',
        customerId: 'customer_1',
        number: 'EST-00001',
        currency: 'JPY',
        totalCents: 1000,
      });

    const transactionClient = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({
          currency: 'JPY',
        }),
      },

      estimate: {
        create: estimateCreate,
      },
    };

    mockTransaction(transactionClient);

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

    expect(transactionClient.organization.findUnique).toHaveBeenCalledWith({
      where: {
        id: 'org_1',
      },
      select: {
        currency: true,
      },
    });

    expect(estimateCreate).toHaveBeenCalledTimes(1);
    expect(estimateCreate.mock.calls[0]?.[0]).toMatchObject({
      data: {
        currency: 'JPY',
      },
    });
  });

  it('copies the organization currency onto a directly created invoice', async () => {
    const activityService = createActivityService();
    const membershipService = createMembershipService();

    mockMembership(membershipService);

    const service = new InvoicesService(
      activityService,
      createCustomerCommunicationsService(),
      createConfigService(),
      membershipService,
    );

    const internals = service as unknown as InvoicesServiceInternals;

    jest.spyOn(internals, 'requireCustomerForOrganization').mockResolvedValue({
      id: 'customer_1',
    });

    jest
      .spyOn(internals, 'generateInvoiceNumber')
      .mockResolvedValue('INV-00001');

    const invoiceCreate = jest
      .fn<Promise<unknown>, [unknown]>()
      .mockResolvedValue({
        id: 'invoice_1',
        organizationId: 'org_1',
        customerId: 'customer_1',
        number: 'INV-00001',
        currency: 'AUD',
        totalCents: 2500,
        balanceDueCents: 2500,
      });

    const transactionClient = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({
          currency: 'AUD',
        }),
      },

      invoice: {
        create: invoiceCreate,
      },
    };

    mockTransaction(transactionClient);

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

    expect(invoiceCreate).toHaveBeenCalledTimes(1);
    expect(invoiceCreate.mock.calls[0]?.[0]).toMatchObject({
      data: {
        currency: 'AUD',
      },
    });
  });

  it('copies the estimate currency when converting an estimate to an invoice', async () => {
    const activityService = createActivityService();
    const membershipService = createMembershipService();

    mockMembership(membershipService);

    const service = new InvoicesService(
      activityService,
      createCustomerCommunicationsService(),
      createConfigService(),
      membershipService,
    );

    const internals = service as unknown as InvoicesServiceInternals;

    jest.spyOn(internals, 'requireCustomerForOrganization').mockResolvedValue({
      id: 'customer_1',
    });

    jest
      .spyOn(internals, 'generateInvoiceNumber')
      .mockResolvedValue('INV-00002');

    const invoiceCreate = jest
      .fn<Promise<unknown>, [unknown]>()
      .mockResolvedValue({
        id: 'invoice_2',
        organizationId: 'org_1',
        customerId: 'customer_1',
        number: 'INV-00002',
        currency: 'EUR',
        totalCents: 5000,
        balanceDueCents: 5000,
      });

    const transactionClient = {
      estimate: {
        findFirst: jest.fn().mockResolvedValue({
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
          taxRate: 0,
          taxCents: 0,
          totalCents: 5000,

          lineItems: [
            {
              description: 'Converted work',
              quantity: 1,
              unitPriceCents: 5000,
              lineTotalCents: 5000,
              sourceJobMaterialId: null,
              position: 0,
            },
          ],
        }),
      },

      invoice: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: invoiceCreate,
      },

      jobMaterial: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    mockTransaction(transactionClient);

    await service.createFromEstimateForUser(
      'clerk_user_1',
      'estimate_1',
      'org_1',
    );

    expect(invoiceCreate).toHaveBeenCalledTimes(1);
    expect(invoiceCreate.mock.calls[0]?.[0]).toMatchObject({
      data: {
        sourceEstimateId: 'estimate_1',
        currency: 'EUR',
      },
    });
  });

  it('copies the invoice currency onto a manually recorded payment', async () => {
    const activityService = createActivityService();
    const membershipService = createMembershipService();

    mockMembership(membershipService);

    const service = new InvoicesService(
      activityService,
      createCustomerCommunicationsService(),
      createConfigService(),
      membershipService,
    );

    const internals = service as unknown as InvoicesServiceInternals;

    jest.spyOn(internals, 'requireInvoiceForOrganization').mockResolvedValue({
      id: 'invoice_1',
      customerId: 'customer_1',
      jobId: null,
      sourceEstimateId: null,

      status: InvoiceStatus.SENT,
      currency: 'CHF',

      discountCents: 0,
      taxRate: 0,

      totalCents: 2000,
      amountPaidCents: 0,
      balanceDueCents: 2000,

      dueDate: null,
      sentAt: new Date(),
      viewedAt: null,
      paidAt: null,
      overdueAt: null,
    });

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

    const paymentCreate = jest
      .fn<Promise<unknown>, [unknown]>()
      .mockResolvedValue({
        id: 'payment_1',
        currency: 'CHF',
        amountCents: 500,
        method: PaymentMethod.CASH,
        receivedAt: new Date(),
      });

    const transactionClient = {
      payment: {
        create: paymentCreate,
      },
    };

    mockTransaction(transactionClient);

    await service.recordPaymentForUser(
      'clerk_user_1',
      'invoice_1',
      {
        amountCents: 500,
        method: PaymentMethod.CASH,
      },
      'org_1',
    );

    expect(paymentCreate).toHaveBeenCalledTimes(1);
    expect(paymentCreate.mock.calls[0]?.[0]).toMatchObject({
      data: {
        invoiceId: 'invoice_1',
        currency: 'CHF',
        amountCents: 500,
      },
    });
  });

  it('copies the invoice currency onto a Stripe payment', async () => {
    const activityService = createActivityService();

    const service = new StripePaymentService(
      createConfigService(),
      activityService,
      createCustomerCommunicationsService(),
    );

    const internals = service as unknown as StripePaymentServiceInternals;

    jest
      .spyOn(internals, 'ensurePaymentReceiptDelivery')
      .mockResolvedValue(undefined);

    jest
      .spyOn(internals, 'tryPaymentReceiptDelivery')
      .mockResolvedValue('sent');

    const paymentCreate = jest
      .fn<Promise<unknown>, [unknown]>()
      .mockResolvedValue({
        id: 'payment_stripe_1',
        amountCents: 3200,
      });

    const transactionClient = {
      stripeWebhookEvent: {
        create: jest.fn().mockResolvedValue({
          id: 'webhook_event_1',
        }),
      },

      payment: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: paymentCreate,
      },

      invoice: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'invoice_1',
          customerId: 'customer_1',
          number: 'INV-00001',

          status: InvoiceStatus.SENT,
          currency: 'GBP',

          totalCents: 3200,
          amountPaidCents: 0,
          balanceDueCents: 3200,
        }),

        update: jest.fn().mockResolvedValue({
          id: 'invoice_1',
        }),
      },
    };

    mockTransaction(transactionClient);

    const session = {
      id: 'cs_test_1',
      object: 'checkout.session',

      payment_status: 'paid',
      amount_total: 3200,
      payment_intent: 'pi_test_1',

      metadata: {
        invoiceId: 'invoice_1',
        organizationId: 'org_1',
      },
    } as unknown as Stripe.Checkout.Session;

    const event = {
      id: 'evt_test_1',
      object: 'event',

      type: 'checkout.session.completed',

      data: {
        object: session,
      },
    } as unknown as Stripe.Event;

    await service.handleWebhookEvent(event);

    expect(paymentCreate).toHaveBeenCalledTimes(1);
    expect(paymentCreate.mock.calls[0]?.[0]).toMatchObject({
      data: {
        invoiceId: 'invoice_1',
        provider: 'stripe',
        currency: 'GBP',
        amountCents: 3200,
      },
    });
  });
});
