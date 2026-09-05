import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CommunicationCategory,
  InvoiceStatus,
  PaymentMethod,
  PaymentReceiptStatus,
  PaymentStatus,
} from '@contractflow/db';
import {
  db,
  fromPrisma8Timestamp,
  isPrisma8UniqueViolation,
  setPrisma8Serializable,
  toPrisma8Timestamp,
} from '@contractflow/db-prisma8';
import Stripe from 'stripe';

import type { Environment } from '../config/environment';
import { CustomerCommunicationsService } from '../customer-communications/customer-communications.service';
import { formatMoney as formatCurrencyAmount } from '../common/money/money';
type PaymentConfirmationRecord = {
  id: string;
  organizationId: string;
  customerId: string;
  invoiceId: string;

  status: PaymentStatus;
  amountCents: number;
  currency: string;
  receivedAt: Date;
  method: PaymentMethod;

  invoice: {
    id: string;
    jobId: string | null;
    number: string;
    status: InvoiceStatus;
    currency: string;
    totalCents: number;
    amountPaidCents: number;
    balanceDueCents: number;
    publicAccessToken: string | null;

    customer: {
      firstName: string | null;
      lastName: string | null;
      companyName: string | null;
      email: string | null;
    };

    organization: {
      name: string;
      legalName: string | null;
      email: string | null;
    };
  };
};

@Injectable()
export class StripePaymentService {
  private readonly stripe: Stripe;

  private readonly logger = new Logger(StripePaymentService.name);

  constructor(
    private readonly configService: ConfigService<Environment, true>,
    private readonly customerCommunicationsService: CustomerCommunicationsService,
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

    const invoice = await db.orm.public.Invoice.where({
      publicAccessToken: normalizedToken,
    })
      .select(
        'id',
        'organizationId',
        'customerId',
        'number',
        'status',
        'currency',
        'balanceDueCents',
      )
      .first();

    if (!invoice || invoice.status === InvoiceStatus.DRAFT) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === InvoiceStatus.VOIDED) {
      throw new BadRequestException('Voided invoices cannot be paid');
    }

    if (invoice.status === InvoiceStatus.PAID || invoice.balanceDueCents <= 0) {
      throw new BadRequestException('Invoice has already been paid');
    }

    const customer = await db.orm.public.Customer.where({
      id: invoice.customerId,

      organizationId: invoice.organizationId,
    })
      .select('email')
      .first();

    const webUrl = this.configService.get('WEB_URL', {
      infer: true,
    });

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',

      customer_email: customer?.email ?? undefined,

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

        /*
         * Payment fulfillment stays authoritative.
         * If this fails, Stripe should receive an error
         * and retry the webhook.
         */
        const paymentId = await this.recordSuccessfulCheckout(event, session);

        if (!paymentId) {
          return;
        }

        /*
         * Receipt delivery is intentionally separate
         * from payment fulfillment.
         *
         * A Resend outage must never cause Stripe to
         * consider an already-recorded payment failed.
         */
        await this.ensurePaymentReceiptDelivery(paymentId);

        await this.tryPaymentReceiptDelivery(paymentId);

        return;
      }

      case 'checkout.session.async_payment_failed':
        return;

      default:
        return;
    }
  }

  async processPendingReceiptDeliveries() {
    const now = new Date();

    const deliveries = await db.orm.public.PaymentReceiptDelivery.select(
      'paymentId',
      'status',
      'nextAttemptAt',
      'createdAt',
    ).all();

    const pendingDeliveries = deliveries
      .filter(
        (delivery) =>
          (delivery.status === PaymentReceiptStatus.PENDING ||
            delivery.status === PaymentReceiptStatus.FAILED) &&
          (delivery.nextAttemptAt === null ||
            fromPrisma8Timestamp(delivery.nextAttemptAt) <= now),
      )
      .sort(
        (a, b) =>
          fromPrisma8Timestamp(a.createdAt).getTime() -
          fromPrisma8Timestamp(b.createdAt).getTime(),
      )
      .slice(0, 100);

    let sent = 0;

    let failed = 0;

    let skipped = 0;

    for (const delivery of pendingDeliveries) {
      const result = await this.tryPaymentReceiptDelivery(delivery.paymentId);

      switch (result) {
        case 'sent':
          sent += 1;
          break;

        case 'failed':
          failed += 1;
          break;

        case 'skipped':
          skipped += 1;
          break;
      }
    }

    return {
      scanned: pendingDeliveries.length,

      sent,
      failed,
      skipped,
    };
  }

  private async recordSuccessfulCheckout(
    event: Stripe.Event,
    session: Stripe.Checkout.Session,
  ): Promise<string | null> {
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

    const externalPaymentId = paymentIntentId ?? session.id;

    try {
      return await db.transaction(async (tx) => {
        await setPrisma8Serializable(tx);

        await tx.orm.public.StripeWebhookEvent.create({
          stripeEventId: event.id,
          eventType: event.type,
          objectId: session.id,
        });

        const existingPayment = await tx.orm.public.Payment.where({
          provider: 'stripe',
          externalPaymentId,
        })
          .select('id')
          .first();

        if (existingPayment) {
          return existingPayment.id;
        }

        const invoice = await tx.orm.public.Invoice.where({
          id: invoiceId,
          organizationId,
        })
          .select(
            'id',
            'customerId',
            'number',
            'status',
            'currency',
            'totalCents',
            'amountPaidCents',
            'balanceDueCents',
          )
          .first();

        if (!invoice) {
          throw new NotFoundException('Invoice not found');
        }

        if (invoice.status === 'VOIDED') {
          throw new BadRequestException(
            'Cannot apply a Stripe payment to a voided invoice',
          );
        }

        const amountToApply = Math.min(amountPaid, invoice.balanceDueCents);

        if (amountToApply <= 0) {
          return null;
        }

        const now = toPrisma8Timestamp();

        const payment = await tx.orm.public.Payment.create({
          organizationId,
          customerId: invoice.customerId,
          invoiceId: invoice.id,
          recordedByUserId: null,
          status: 'RECORDED',
          method: 'CREDIT_CARD',
          currency: invoice.currency,
          amountCents: amountToApply,
          reference: externalPaymentId,
          notes: 'Paid online through Stripe Checkout',
          provider: 'stripe',
          externalPaymentId,
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: paymentIntentId ?? null,
          receivedAt: now,
          updatedAt: now,
        });

        await tx.orm.public.PaymentReceiptDelivery.create({
          paymentId: payment.id,
          status: 'PENDING',
          updatedAt: now,
        });

        const nextAmountPaidCents = invoice.amountPaidCents + amountToApply;

        const nextBalanceDueCents = Math.max(
          invoice.totalCents - nextAmountPaidCents,
          0,
        );

        const nextStatus =
          nextBalanceDueCents === 0 ? 'PAID' : 'PARTIALLY_PAID';

        await tx.orm.public.Invoice.where({
          id: invoice.id,
        }).update({
          amountPaidCents: nextAmountPaidCents,
          balanceDueCents: nextBalanceDueCents,
          status: nextStatus,
          paidAt: nextStatus === 'PAID' ? now : null,
          updatedAt: now,
        });

        await tx.orm.public.CustomerActivity.create({
          organizationId,
          customerId: invoice.customerId,
          actorUserId: null,
          _type: 'PAYMENT_RECEIVED',
          title: 'Online payment received',
          description: `${formatMoney(
            amountToApply,
            invoice.currency,
          )} was received through Stripe for ${invoice.number}.`,
          metadata: {
            paymentId: payment.id,
            invoiceId: invoice.id,
            invoiceNumber: invoice.number,
            stripeEventId: event.id,
            stripeCheckoutSessionId: session.id,
            stripePaymentIntentId: paymentIntentId ?? null,
            amountCents: amountToApply,
            status: nextStatus,
            source: 'stripe_checkout',
          },
        });

        if (nextStatus === 'PAID') {
          await tx.orm.public.CustomerActivity.create({
            organizationId,
            customerId: invoice.customerId,
            actorUserId: null,
            _type: 'INVOICE_PAID',
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
          });
        } else {
          await tx.orm.public.CustomerActivity.create({
            organizationId,
            customerId: invoice.customerId,
            actorUserId: null,
            _type: 'INVOICE_PARTIALLY_PAID',
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
          });
        }

        return payment.id;
      });
    } catch (error) {
      if (isPrisma8UniqueViolation(error)) {
        const duplicatePayment = await db.orm.public.Payment.where({
          provider: 'stripe',
          externalPaymentId,
        })
          .select('id')
          .first();

        if (duplicatePayment) {
          return duplicatePayment.id;
        }

        const duplicateEvent = await db.orm.public.StripeWebhookEvent.where({
          stripeEventId: event.id,
        })
          .select('id')
          .first();

        if (duplicateEvent) {
          return null;
        }
      }

      throw error;
    }
  }

  private async ensurePaymentReceiptDelivery(paymentId: string): Promise<void> {
    const existing = await db.orm.public.PaymentReceiptDelivery.where({
      paymentId,
    })
      .select('id')
      .first();

    if (existing) {
      return;
    }

    const now = toPrisma8Timestamp();

    try {
      await db.orm.public.PaymentReceiptDelivery.create({
        paymentId,

        status: PaymentReceiptStatus.PENDING,

        updatedAt: now,
      });
    } catch (error) {
      /*
       * Another worker may have created the same
       * payment-delivery row between our read and create.
       *
       * The unique constraint is the authoritative
       * idempotency guard.
       */
      if (isPrisma8UniqueViolation(error)) {
        return;
      }

      throw error;
    }
  }

  private async tryPaymentReceiptDelivery(
    paymentId: string,
  ): Promise<'sent' | 'failed' | 'skipped'> {
    const delivery = await db.orm.public.PaymentReceiptDelivery.where({
      paymentId,
    })
      .select('id', 'status', 'attempts', 'sentAt', 'nextAttemptAt')
      .first();

    if (!delivery) {
      return 'skipped';
    }

    if (delivery.status === PaymentReceiptStatus.SENT || delivery.sentAt) {
      return 'skipped';
    }

    const now = new Date();

    if (
      delivery.nextAttemptAt &&
      fromPrisma8Timestamp(delivery.nextAttemptAt) > now
    ) {
      return 'skipped';
    }

    const attemptNumber = delivery.attempts + 1;

    await db.orm.public.PaymentReceiptDelivery.where({
      id: delivery.id,
    }).update({
      attempts: attemptNumber,

      lastAttemptAt: toPrisma8Timestamp(now),

      updatedAt: toPrisma8Timestamp(now),
    });

    try {
      const result = await this.sendPaymentConfirmation(paymentId);

      if (result === 'skipped') {
        /*
         * Missing customer email is not a transient
         * provider failure. Mark as sent/completed so
         * we do not retry forever.
         */
        await db.orm.public.PaymentReceiptDelivery.where({
          id: delivery.id,
        }).update({
          status: PaymentReceiptStatus.SENT,

          sentAt: toPrisma8Timestamp(now),

          nextAttemptAt: null,

          lastError: null,

          updatedAt: toPrisma8Timestamp(now),
        });

        return 'skipped';
      }

      const sentAt = new Date();

      await db.orm.public.PaymentReceiptDelivery.where({
        id: delivery.id,
      }).update({
        status: PaymentReceiptStatus.SENT,

        sentAt: toPrisma8Timestamp(sentAt),

        nextAttemptAt: null,

        lastError: null,

        updatedAt: toPrisma8Timestamp(sentAt),
      });

      this.logger.log(`Payment receipt sent payment=${paymentId}`);

      return 'sent';
    } catch (error) {
      const message = getErrorMessage(error);

      const nextAttemptAt = getNextReceiptAttemptAt(attemptNumber);

      await db.orm.public.PaymentReceiptDelivery.where({
        id: delivery.id,
      }).update({
        status: PaymentReceiptStatus.FAILED,

        nextAttemptAt: toPrisma8Timestamp(nextAttemptAt),

        lastError: message.slice(0, 2000),

        updatedAt: toPrisma8Timestamp(),
      });

      /*
       * Payment fulfillment has already committed,
       * so a mail-provider outage must not turn the
       * Stripe webhook into a 500 response.
       */
      this.logger.error(
        [
          'Payment receipt delivery failed',
          `payment=${paymentId}`,
          `attempt=${attemptNumber}`,
          `nextAttempt=${nextAttemptAt.toISOString()}`,
          `error=${message}`,
        ].join(' '),
      );

      return 'failed';
    }
  }

  private async sendPaymentConfirmation(
    paymentId: string,
  ): Promise<'sent' | 'skipped'> {
    const paymentBase = await db.orm.public.Payment.where({
      id: paymentId,
    })
      .select(
        'id',
        'organizationId',
        'customerId',
        'invoiceId',
        'status',
        'amountCents',
        'currency',
        'receivedAt',
        'method',
      )
      .first();

    if (!paymentBase) {
      throw new NotFoundException('Payment not found');
    }

    if (paymentBase.status !== PaymentStatus.RECORDED) {
      return 'skipped';
    }

    const invoice = await db.orm.public.Invoice.where({
      id: paymentBase.invoiceId,

      organizationId: paymentBase.organizationId,
    })
      .select(
        'id',
        'jobId',
        'number',
        'status',
        'currency',
        'totalCents',
        'amountPaidCents',
        'balanceDueCents',
        'publicAccessToken',
        'customerId',
      )
      .first();

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const customer = await db.orm.public.Customer.where({
      id: paymentBase.customerId,

      organizationId: paymentBase.organizationId,
    })
      .select('firstName', 'lastName', 'companyName', 'email')
      .first();

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const organization = await db.orm.public.Organization.where({
      id: paymentBase.organizationId,
    })
      .select('name', 'legalName', 'email')
      .first();

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const payment: PaymentConfirmationRecord = {
      ...paymentBase,

      receivedAt: new Date(paymentBase.receivedAt.toString()),

      invoice: {
        id: invoice.id,

        jobId: invoice.jobId,

        number: invoice.number,

        status: invoice.status,

        currency: invoice.currency,

        totalCents: invoice.totalCents,

        amountPaidCents: invoice.amountPaidCents,

        balanceDueCents: invoice.balanceDueCents,

        publicAccessToken: invoice.publicAccessToken,

        customer,

        organization,
      },
    };

    const customerEmail = payment.invoice.customer.email?.trim();

    if (!customerEmail) {
      this.logger.warn(
        `Payment receipt skipped because customer has no email payment=${paymentId}`,
      );

      return 'skipped';
    }

    const customerName = getCustomerName(payment.invoice.customer);

    const businessName =
      payment.invoice.organization.legalName ||
      payment.invoice.organization.name;

    const webUrl = this.configService.get('WEB_URL', {
      infer: true,
    });

    const publicInvoiceUrl = payment.invoice.publicAccessToken
      ? new URL(`/i/${payment.invoice.publicAccessToken}`, webUrl).toString()
      : null;

    const paidInFull =
      payment.invoice.status === InvoiceStatus.PAID ||
      payment.invoice.balanceDueCents <= 0;

    const emailSubject = paidInFull
      ? `Payment received — ${payment.invoice.number} is paid in full`
      : `Payment received for ${payment.invoice.number}`;

    const emailHtml = this.buildPaymentConfirmationEmailHtml({
      payment,
      businessName,
      customerName,
      publicInvoiceUrl,
      paidInFull,
    });

    const emailText = this.buildPaymentConfirmationEmailText({
      payment,
      businessName,
      customerName,
      publicInvoiceUrl,
      paidInFull,
    });

    await this.customerCommunicationsService.sendEmail({
      organizationId: payment.organizationId,

      customerId: payment.customerId,

      actorUserId: null,

      category: CommunicationCategory.PAYMENT,

      recipientEmail: customerEmail,

      subject: emailSubject,

      htmlBody: emailHtml,

      textBody: emailText,

      paymentId: payment.id,

      invoiceId: payment.invoiceId,

      jobId: payment.invoice.jobId,

      replyTo: payment.invoice.organization.email ?? undefined,

      idempotencyKey: `payment-confirmation/${payment.id}`,
    });

    return 'sent';
  }

  private buildPaymentConfirmationEmailHtml({
    payment,
    businessName,
    customerName,
    publicInvoiceUrl,
    paidInFull,
  }: {
    payment: PaymentConfirmationRecord;
    businessName: string;
    customerName: string;
    publicInvoiceUrl: string | null;
    paidInFull: boolean;
  }): string {
    const invoice = payment.invoice;

    const heading = paidInFull
      ? 'Payment received — thank you'
      : 'Payment received';

    const message = paidInFull
      ? `Your payment has been received and invoice ${invoice.number} is now paid in full.`
      : `Your payment has been received and applied to invoice ${invoice.number}.`;

    return `
      <!doctype html>
      <html>
        <body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;">
                  <tr>
                    <td style="padding:32px;">
                      <p style="margin:0 0 8px;font-size:14px;color:#71717a;">
                        ${escapeHtml(businessName)}
                      </p>

                      <h1 style="margin:0;font-size:24px;line-height:1.3;">
                        ${escapeHtml(heading)}
                      </h1>

                      <p style="margin:24px 0 0;line-height:1.6;color:#52525b;">
                        Hi ${escapeHtml(customerName)},
                      </p>

                      <p style="margin:12px 0 0;line-height:1.6;color:#52525b;">
                        ${escapeHtml(message)}
                      </p>

                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;border-collapse:collapse;">
                        <tr>
                          <td style="padding:10px 0;color:#71717a;">
                            Invoice
                          </td>

                          <td align="right" style="padding:10px 0;font-weight:700;">
                            ${escapeHtml(invoice.number)}
                          </td>
                        </tr>

                        <tr>
                          <td style="padding:10px 0;color:#71717a;border-top:1px solid #e4e4e7;">
                            Payment received
                          </td>

                          <td align="right" style="padding:10px 0;font-weight:700;border-top:1px solid #e4e4e7;">
                            ${escapeHtml(
                              formatMoney(
                                payment.amountCents,
                                payment.currency,
                              ),
                            )}
                          </td>
                        </tr>

                        <tr>
                          <td style="padding:10px 0;color:#71717a;border-top:1px solid #e4e4e7;">
                            Payment date
                          </td>

                          <td align="right" style="padding:10px 0;font-weight:700;border-top:1px solid #e4e4e7;">
                            ${escapeHtml(formatDate(payment.receivedAt))}
                          </td>
                        </tr>

                        <tr>
                          <td style="padding:10px 0;color:#71717a;border-top:1px solid #e4e4e7;">
                            Total paid
                          </td>

                          <td align="right" style="padding:10px 0;font-weight:700;border-top:1px solid #e4e4e7;">
                            ${escapeHtml(
                              formatMoney(
                                invoice.amountPaidCents,
                                invoice.currency,
                              ),
                            )}
                          </td>
                        </tr>

                        <tr>
                          <td style="padding:10px 0;color:#71717a;border-top:1px solid #e4e4e7;">
                            Balance remaining
                          </td>

                          <td align="right" style="padding:10px 0;font-weight:700;border-top:1px solid #e4e4e7;">
                            ${escapeHtml(
                              formatMoney(
                                invoice.balanceDueCents,
                                invoice.currency,
                              ),
                            )}
                          </td>
                        </tr>
                      </table>

                      ${
                        paidInFull
                          ? `
                            <div style="margin-top:24px;padding:14px 16px;border:1px solid #bbf7d0;background:#f0fdf4;border-radius:8px;color:#166534;">
                              <strong>Paid in full</strong>

                              <div style="margin-top:4px;font-size:14px;">
                                No balance remains on this invoice.
                              </div>
                            </div>
                          `
                          : `
                            <div style="margin-top:24px;padding:14px 16px;border:1px solid #fde68a;background:#fffbeb;border-radius:8px;color:#92400e;">
                              <strong>Remaining balance</strong>

                              <div style="margin-top:4px;font-size:14px;">
                                ${escapeHtml(
                                  formatMoney(
                                    invoice.balanceDueCents,
                                    invoice.currency,
                                  ),
                                )} remains outstanding.
                              </div>
                            </div>
                          `
                      }

                      ${
                        publicInvoiceUrl
                          ? `
                            <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:28px;">
                              <tr>
                                <td style="border-radius:8px;background:#18181b;">
                                  <a
                                    href="${escapeHtml(publicInvoiceUrl)}"
                                    style="display:inline-block;padding:12px 20px;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;"
                                  >
                                    View Invoice
                                  </a>
                                </td>
                              </tr>
                            </table>
                          `
                          : ''
                      }

                      <p style="margin:28px 0 0;line-height:1.6;color:#71717a;font-size:13px;">
                        Thank you for your payment.
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

  private buildPaymentConfirmationEmailText({
    payment,
    businessName,
    customerName,
    publicInvoiceUrl,
    paidInFull,
  }: {
    payment: PaymentConfirmationRecord;
    businessName: string;
    customerName: string;
    publicInvoiceUrl: string | null;
    paidInFull: boolean;
  }): string {
    const invoice = payment.invoice;

    return [
      businessName,

      '',

      paidInFull ? 'Payment received — thank you' : 'Payment received',

      '',

      `Hi ${customerName},`,

      '',

      paidInFull
        ? `Your payment has been received and invoice ${invoice.number} is now paid in full.`
        : `Your payment has been received and applied to invoice ${invoice.number}.`,

      '',

      `Invoice: ${invoice.number}`,

      `Payment received: ${formatMoney(payment.amountCents, payment.currency)}`,

      `Payment date: ${formatDate(payment.receivedAt)}`,

      `Total paid: ${formatMoney(invoice.amountPaidCents, invoice.currency)}`,

      `Balance remaining: ${formatMoney(
        invoice.balanceDueCents,
        invoice.currency,
      )}`,

      ...(publicInvoiceUrl ? ['', `View invoice: ${publicInvoiceUrl}`] : []),

      '',

      'Thank you for your payment.',
    ].join('\n');
  }

  private validateToken(token: string): void {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      throw new BadRequestException('Invalid invoice access token');
    }
  }
}

function getNextReceiptAttemptAt(attemptNumber: number): Date {
  const delaysInMinutes = [15, 30, 60, 120, 240, 480, 720, 1440];

  const index = Math.min(
    Math.max(attemptNumber - 1, 0),
    delaysInMinutes.length - 1,
  );

  const delay = delaysInMinutes[index] ?? 1440;

  return new Date(Date.now() + delay * 60_000);
}

function getCustomerName(customer: {
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
}): string {
  const name = [customer.firstName, customer.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();

  return name || customer.companyName || 'there';
}

function formatMoney(cents: number, currency: string): string {
  return formatCurrencyAmount(cents, currency, 'en-CA');
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Unknown payment receipt delivery error';
}
