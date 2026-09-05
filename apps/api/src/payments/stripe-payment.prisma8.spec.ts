const mockTransaction = jest.fn();
const mockSetSerializable = jest.fn();
const mockTimestamp = jest.fn(() => 'TIMESTAMP');
const mockIsUniqueViolation = jest.fn();

const outsidePaymentFirst = jest.fn();
const outsideEventFirst = jest.fn();

jest.mock('@contractflow/db-prisma8', () => ({
  db: {
    transaction: mockTransaction,

    orm: {
      public: {
        Payment: {
          where: jest.fn(() => ({
            select: jest.fn(() => ({
              first: outsidePaymentFirst,
            })),
          })),
        },

        StripeWebhookEvent: {
          where: jest.fn(() => ({
            select: jest.fn(() => ({
              first: outsideEventFirst,
            })),
          })),
        },
      },
    },
  },

  setPrisma8Serializable: mockSetSerializable,

  toPrisma8Timestamp: mockTimestamp,

  isPrisma8UniqueViolation: mockIsUniqueViolation,
}));

import type Stripe from 'stripe';

import { BadRequestException } from '@nestjs/common';

import { StripePaymentService } from './stripe-payment.service';

type PrivateStripePaymentService = {
  recordSuccessfulCheckout(
    event: Stripe.Event,
    session: Stripe.Checkout.Session,
  ): Promise<string | null>;
};

type MockTransactionCallback = (tx: { orm: unknown }) => Promise<unknown>;

function event(id = 'evt_1'): Stripe.Event {
  return {
    id,
    type: 'checkout.session.completed',
  } as Stripe.Event;
}

function session(
  overrides: Partial<Stripe.Checkout.Session> = {},
): Stripe.Checkout.Session {
  return {
    id: 'cs_1',

    metadata: {
      invoiceId: 'invoice-1',
      organizationId: 'org-1',
    },

    amount_total: 2500,

    payment_intent: 'pi_1',

    ...overrides,
  } as Stripe.Checkout.Session;
}

function makeService() {
  const configService = {
    get: jest.fn(() => 'sk_test_contractflow'),
  };

  const communicationsService = {};

  return new StripePaymentService(
    configService as never,
    communicationsService as never,
  );
}

function privateService(
  service: StripePaymentService,
): PrivateStripePaymentService {
  return service as unknown as PrivateStripePaymentService;
}

function createTransactionOrm(input?: {
  invoiceStatus?:
    | 'DRAFT'
    | 'SENT'
    | 'VIEWED'
    | 'PARTIALLY_PAID'
    | 'PAID'
    | 'OVERDUE'
    | 'VOIDED';

  totalCents?: number;
  amountPaidCents?: number;
  balanceDueCents?: number;

  existingPaymentId?: string | null;
}) {
  const invoiceStatus = input?.invoiceStatus ?? 'SENT';

  const totalCents = input?.totalCents ?? 10000;

  const amountPaidCents = input?.amountPaidCents ?? 2000;

  const balanceDueCents = input?.balanceDueCents ?? 8000;

  const webhookCreate = jest.fn().mockResolvedValue({
    id: 'webhook-1',
  });

  const existingPaymentFirst = jest.fn().mockResolvedValue(
    input?.existingPaymentId
      ? {
          id: input.existingPaymentId,
        }
      : null,
  );

  const invoiceFirst = jest.fn().mockResolvedValue({
    id: 'invoice-1',
    customerId: 'customer-1',
    number: 'INV-00012',
    status: invoiceStatus,
    currency: 'CAD',
    totalCents,
    amountPaidCents,
    balanceDueCents,
  });

  const paymentCreate = jest.fn().mockResolvedValue({
    id: 'payment-1',
    amountCents: 2500,
  });

  const receiptCreate = jest.fn().mockResolvedValue({
    id: 'delivery-1',
  });

  const invoiceUpdate = jest.fn().mockResolvedValue({});

  const activityCreate = jest.fn().mockResolvedValue({
    id: 'activity-1',
  });

  const txOrm = {
    public: {
      StripeWebhookEvent: {
        create: webhookCreate,
      },

      Payment: {
        where: jest.fn(() => ({
          select: jest.fn(() => ({
            first: existingPaymentFirst,
          })),
        })),

        create: paymentCreate,
      },

      Invoice: {
        where: jest.fn(() => ({
          select: jest.fn(() => ({
            first: invoiceFirst,
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

  return {
    txOrm,

    webhookCreate,
    existingPaymentFirst,
    invoiceFirst,
    paymentCreate,
    receiptCreate,
    invoiceUpdate,
    activityCreate,
  };
}

describe('StripePaymentService Prisma 8 checkout', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    outsidePaymentFirst.mockResolvedValue(null);

    outsideEventFirst.mockResolvedValue(null);

    mockSetSerializable.mockResolvedValue(undefined);

    mockIsUniqueViolation.mockReturnValue(false);
  });

  it('records a partial payment in one Serializable transaction', async () => {
    const service = makeService();

    const mocks = createTransactionOrm({
      totalCents: 10000,
      amountPaidCents: 2000,
      balanceDueCents: 8000,
    });

    mockTransaction.mockImplementation((callback: MockTransactionCallback) =>
      callback({
        orm: mocks.txOrm,
      }),
    );

    const result = await privateService(service).recordSuccessfulCheckout(
      event(),
      session({
        amount_total: 2500,
      }),
    );

    expect(mockSetSerializable).toHaveBeenCalledTimes(1);

    expect(mocks.webhookCreate).toHaveBeenCalledWith({
      stripeEventId: 'evt_1',
      eventType: 'checkout.session.completed',
      objectId: 'cs_1',
    });

    expect(mocks.paymentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        customerId: 'customer-1',
        invoiceId: 'invoice-1',
        amountCents: 2500,
        provider: 'stripe',
        externalPaymentId: 'pi_1',
        receivedAt: 'TIMESTAMP',
      }),
    );

    expect(mocks.receiptCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: 'payment-1',
        status: 'PENDING',
      }),
    );

    expect(mocks.invoiceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        amountPaidCents: 4500,
        balanceDueCents: 5500,
        status: 'PARTIALLY_PAID',
        paidAt: null,
      }),
    );

    expect(mocks.activityCreate).toHaveBeenCalledTimes(2);

    expect(mocks.activityCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        _type: 'PAYMENT_RECEIVED',
      }),
    );

    expect(mocks.activityCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        _type: 'INVOICE_PARTIALLY_PAID',
      }),
    );

    expect(result).toBe('payment-1');
  });

  it('marks an invoice PAID when the checkout satisfies the remaining balance', async () => {
    const service = makeService();

    const mocks = createTransactionOrm({
      totalCents: 10000,
      amountPaidCents: 7500,
      balanceDueCents: 2500,
    });

    mockTransaction.mockImplementation((callback: MockTransactionCallback) =>
      callback({
        orm: mocks.txOrm,
      }),
    );

    const result = await privateService(service).recordSuccessfulCheckout(
      event(),
      session({
        amount_total: 2500,
      }),
    );

    expect(mocks.invoiceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        amountPaidCents: 10000,
        balanceDueCents: 0,
        status: 'PAID',
        paidAt: 'TIMESTAMP',
      }),
    );

    expect(mocks.activityCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        _type: 'INVOICE_PAID',
      }),
    );

    expect(result).toBe('payment-1');
  });

  it('returns an existing payment without creating another payment', async () => {
    const service = makeService();

    const mocks = createTransactionOrm({
      existingPaymentId: 'payment-existing',
    });

    mockTransaction.mockImplementation((callback: MockTransactionCallback) =>
      callback({
        orm: mocks.txOrm,
      }),
    );

    const result = await privateService(service).recordSuccessfulCheckout(
      event(),
      session(),
    );

    expect(result).toBe('payment-existing');

    expect(mocks.paymentCreate).not.toHaveBeenCalled();

    expect(mocks.invoiceUpdate).not.toHaveBeenCalled();

    expect(mocks.activityCreate).not.toHaveBeenCalled();
  });

  it('recovers the existing payment after a unique-constraint race', async () => {
    const service = makeService();

    const uniqueError = new Error('unique race');

    mockTransaction.mockRejectedValue(uniqueError);

    mockIsUniqueViolation.mockImplementation((error) => error === uniqueError);

    outsidePaymentFirst.mockResolvedValue({
      id: 'payment-race-winner',
    });

    const result = await privateService(service).recordSuccessfulCheckout(
      event(),
      session(),
    );

    expect(mockIsUniqueViolation).toHaveBeenCalledWith(uniqueError);

    expect(result).toBe('payment-race-winner');
  });

  it('returns null when the Stripe event already exists after a unique race', async () => {
    const service = makeService();

    const uniqueError = new Error('duplicate event');

    mockTransaction.mockRejectedValue(uniqueError);

    mockIsUniqueViolation.mockReturnValue(true);

    outsidePaymentFirst.mockResolvedValue(null);

    outsideEventFirst.mockResolvedValue({
      id: 'webhook-existing',
    });

    const result = await privateService(service).recordSuccessfulCheckout(
      event(),
      session(),
    );

    expect(result).toBeNull();
  });

  it('rejects a voided invoice without creating a payment', async () => {
    const service = makeService();

    const mocks = createTransactionOrm({
      invoiceStatus: 'VOIDED',
    });

    mockTransaction.mockImplementation((callback: MockTransactionCallback) =>
      callback({
        orm: mocks.txOrm,
      }),
    );

    await expect(
      privateService(service).recordSuccessfulCheckout(event(), session()),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mocks.paymentCreate).not.toHaveBeenCalled();

    expect(mocks.invoiceUpdate).not.toHaveBeenCalled();
  });

  it('rejects a checkout with no positive paid amount before opening a transaction', async () => {
    const service = makeService();

    await expect(
      privateService(service).recordSuccessfulCheckout(
        event(),
        session({
          amount_total: 0,
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
