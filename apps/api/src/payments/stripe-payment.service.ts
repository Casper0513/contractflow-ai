import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CustomerActivityType,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  prisma,
} from '@contractflow/db';
import Stripe from 'stripe';

import { ActivityService } from '../activity/activity.service';
import type { Environment } from '../config/environment';

@Injectable()
export class StripePaymentService {
  private readonly stripe: Stripe;

  constructor(
    private readonly configService: ConfigService<Environment, true>,
    private readonly activityService: ActivityService,
  ) {
    this.stripe = new Stripe(
      this.configService.get('STRIPE_SECRET_KEY', {
        infer: true,
      }),
    );
  }

  async createCheckoutForPublicInvoice(token: string) {
    const normalizedToken = token.trim();

    this.validateToken(normalizedToken);

    const invoice = await prisma.invoice.findUnique({
      where: {
        publicAccessToken: normalizedToken,
      },
      select: {
        id: true,
        organizationId: true,
        customerId: true,
        number: true,
        status: true,
        currency: true,
        balanceDueCents: true,
        customer: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!invoice || invoice.status === InvoiceStatus.DRAFT) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === InvoiceStatus.VOIDED) {
      throw new BadRequestException('Voided invoices cannot be paid');
    }

    if (invoice.status === InvoiceStatus.PAID || invoice.balanceDueCents <= 0) {
      throw new BadRequestException('Invoice has already been paid');
    }

    const webUrl = this.configService.get('WEB_URL', {
      infer: true,
    });

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',

      customer_email: invoice.customer.email ?? undefined,

      success_url: `${webUrl}/i/${normalizedToken}?payment=success`,
      cancel_url: `${webUrl}/i/${normalizedToken}?payment=cancelled`,

      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: invoice.currency.toLowerCase(),
            unit_amount: invoice.balanceDueCents,
            product_data: {
              name: `Invoice ${invoice.number}`,
            },
          },
        },
      ],

      metadata: {
        invoiceId: invoice.id,
        organizationId: invoice.organizationId,
        customerId: invoice.customerId,
        invoiceNumber: invoice.number,
      },

      payment_intent_data: {
        metadata: {
          invoiceId: invoice.id,
          organizationId: invoice.organizationId,
          customerId: invoice.customerId,
          invoiceNumber: invoice.number,
        },
      },
    });

    if (!session.url) {
      throw new BadRequestException('Stripe did not return a Checkout URL');
    }

    return {
      url: session.url,
    };
  }

  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const webhookSecret = this.configService.get('STRIPE_WEBHOOK_SECRET', {
      infer: true,
    });

    return this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret,
    );
  }

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object;

        if (session.payment_status !== 'paid') {
          return;
        }

        await this.recordSuccessfulCheckout(event, session);

        return;
      }

      case 'checkout.session.async_payment_failed':
        return;

      default:
        return;
    }
  }

  private async recordSuccessfulCheckout(
    event: Stripe.Event,
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const invoiceId = session.metadata?.invoiceId;
    const organizationId = session.metadata?.organizationId;

    if (!invoiceId || !organizationId) {
      throw new BadRequestException(
        'Stripe Checkout Session is missing ContractFlow metadata',
      );
    }

    const amountPaid = session.amount_total;

    if (amountPaid === null || amountPaid <= 0) {
      throw new BadRequestException(
        'Stripe Checkout Session has no paid amount',
      );
    }

    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;

    /*
     * PaymentIntent is preferred because it represents the actual Stripe
     * payment. Fall back to the Checkout Session ID if Stripe does not
     * provide a PaymentIntent.
     */
    const externalPaymentId = paymentIntentId ?? session.id;

    try {
      await prisma.$transaction(
        async (tx) => {
          /*
           * Barrier #1: webhook-event idempotency.
           *
           * stripeEventId has a database UNIQUE constraint. Once this
           * transaction commits, the same Stripe event cannot be processed
           * again.
           *
           * Because this insert participates in the same transaction as the
           * payment/invoice changes, a later failure rolls this insert back.
           */
          await tx.stripeWebhookEvent.create({
            data: {
              stripeEventId: event.id,
              eventType: event.type,
              objectId: session.id,
            },
          });

          /*
           * Barrier #2: payment idempotency.
           *
           * Different Stripe webhook events can describe the same underlying
           * payment. The database UNIQUE constraint on
           * [provider, externalPaymentId] protects against creating the same
           * Stripe payment twice.
           */
          const existingPayment = await tx.payment.findFirst({
            where: {
              provider: 'stripe',
              externalPaymentId,
            },
            select: {
              id: true,
            },
          });

          if (existingPayment) {
            return;
          }

          const invoice = await tx.invoice.findFirst({
            where: {
              id: invoiceId,
              organizationId,
            },
            select: {
              id: true,
              customerId: true,
              number: true,
              status: true,
              currency: true,
              totalCents: true,
              amountPaidCents: true,
              balanceDueCents: true,
            },
          });

          if (!invoice) {
            throw new NotFoundException('Invoice not found');
          }

          if (invoice.status === InvoiceStatus.VOIDED) {
            throw new BadRequestException(
              'Cannot apply a Stripe payment to a voided invoice',
            );
          }

          /*
           * A second Checkout Session could have been created before the
           * first payment completed. Never apply more than the invoice's
           * current outstanding balance.
           */
          const amountToApply = Math.min(amountPaid, invoice.balanceDueCents);

          if (amountToApply <= 0) {
            return;
          }

          const payment = await tx.payment.create({
            data: {
              organizationId,
              customerId: invoice.customerId,
              invoiceId: invoice.id,
              recordedByUserId: null,

              status: PaymentStatus.RECORDED,
              method: PaymentMethod.CREDIT_CARD,

              amountCents: amountToApply,

              reference: externalPaymentId,
              notes: 'Paid online through Stripe Checkout',

              provider: 'stripe',
              externalPaymentId,
              stripeCheckoutSessionId: session.id,
              stripePaymentIntentId: paymentIntentId ?? null,

              receivedAt: new Date(),
            },
            select: {
              id: true,
              amountCents: true,
            },
          });

          const nextAmountPaidCents = invoice.amountPaidCents + amountToApply;

          const nextBalanceDueCents = Math.max(
            invoice.totalCents - nextAmountPaidCents,
            0,
          );

          const nextStatus =
            nextBalanceDueCents === 0
              ? InvoiceStatus.PAID
              : InvoiceStatus.PARTIALLY_PAID;

          const now = new Date();

          await tx.invoice.update({
            where: {
              id: invoice.id,
            },
            data: {
              amountPaidCents: nextAmountPaidCents,
              balanceDueCents: nextBalanceDueCents,
              status: nextStatus,
              paidAt: nextStatus === InvoiceStatus.PAID ? now : null,
            },
          });

          await this.activityService.recordCustomerActivity(
            {
              organizationId,
              customerId: invoice.customerId,
              actorUserId: null,

              type: CustomerActivityType.PAYMENT_RECEIVED,

              title: 'Online payment received',

              description: `${formatMoney(
                payment.amountCents,
                invoice.currency,
              )} was received through Stripe for ${invoice.number}.`,

              metadata: {
                paymentId: payment.id,
                invoiceId: invoice.id,
                invoiceNumber: invoice.number,

                stripeEventId: event.id,
                stripeCheckoutSessionId: session.id,
                stripePaymentIntentId: paymentIntentId ?? null,

                amountCents: payment.amountCents,
                status: nextStatus,
                source: 'stripe_checkout',
              },
            },
            tx,
          );

          if (nextStatus === InvoiceStatus.PAID) {
            await this.activityService.recordCustomerActivity(
              {
                organizationId,
                customerId: invoice.customerId,
                actorUserId: null,

                type: CustomerActivityType.INVOICE_PAID,

                title: 'Invoice paid',

                description: `${invoice.number} was paid in full online.`,

                metadata: {
                  invoiceId: invoice.id,
                  invoiceNumber: invoice.number,

                  stripeEventId: event.id,
                  stripeCheckoutSessionId: session.id,
                  stripePaymentIntentId: paymentIntentId ?? null,

                  source: 'stripe_checkout',
                },
              },
              tx,
            );
          } else {
            await this.activityService.recordCustomerActivity(
              {
                organizationId,
                customerId: invoice.customerId,
                actorUserId: null,

                type: CustomerActivityType.INVOICE_PARTIALLY_PAID,

                title: 'Invoice partially paid',

                description: `${invoice.number} has a remaining balance after an online payment.`,

                metadata: {
                  invoiceId: invoice.id,
                  invoiceNumber: invoice.number,
                  balanceDueCents: nextBalanceDueCents,

                  stripeEventId: event.id,
                  stripeCheckoutSessionId: session.id,
                  stripePaymentIntentId: paymentIntentId ?? null,

                  source: 'stripe_checkout',
                },
              },
              tx,
            );
          }
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      /*
       * P2002 means one of our UNIQUE constraints rejected the insert.
       *
       * We only swallow the error after checking the database to determine
       * that this webhook event or Stripe payment was already committed.
       * Other unique-constraint failures continue upward.
       */
      if (isPrismaUniqueConstraintError(error)) {
        const duplicateEvent = await prisma.stripeWebhookEvent.findUnique({
          where: {
            stripeEventId: event.id,
          },
          select: {
            id: true,
          },
        });

        if (duplicateEvent) {
          return;
        }

        const duplicatePayment = await prisma.payment.findFirst({
          where: {
            provider: 'stripe',
            externalPaymentId,
          },
          select: {
            id: true,
          },
        });

        if (duplicatePayment) {
          return;
        }
      }

      throw error;
    }
  }

  private validateToken(token: string): void {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      throw new BadRequestException('Invalid invoice access token');
    }
  }
}

function isPrismaUniqueConstraintError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}
