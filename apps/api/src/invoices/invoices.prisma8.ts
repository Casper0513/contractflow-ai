import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, PaymentStatus } from '@contractflow/db';
import {
  type DatabaseTransaction,
  db,
  fromPrisma8Timestamp,
  prisma8TextParam,
  prisma8TimestampParam,
  toPrisma8Numeric,
  toPrisma8Timestamp,
} from '@contractflow/db-prisma8';

export type InvoiceOrmSource = typeof db.orm;

export type InvoiceActivityType =
  | 'INVOICE_CREATED'
  | 'INVOICE_UPDATED'
  | 'INVOICE_SENT'
  | 'INVOICE_VIEWED'
  | 'INVOICE_PARTIALLY_PAID'
  | 'INVOICE_PAID'
  | 'INVOICE_OVERDUE'
  | 'INVOICE_VOIDED'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_VOIDED';

type CustomerActivityCreateInput = Parameters<
  DatabaseTransaction['orm']['public']['CustomerActivity']['create']
>[0];

export type InvoiceActivityMetadata = CustomerActivityCreateInput['metadata'];

export async function requireInvoiceForOrganizationPrisma8(
  organizationId: string,
  invoiceId: string,
  orm: InvoiceOrmSource = db.orm,
) {
  const invoice = await orm.public.Invoice.where({
    id: invoiceId,
    organizationId,
  })
    .select(
      'id',
      'customerId',
      'jobId',
      'sourceEstimateId',

      'status',
      'currency',

      'discountCents',
      'taxRate',

      'totalCents',
      'amountPaidCents',
      'balanceDueCents',

      'dueDate',

      'sentAt',
      'viewedAt',
      'paidAt',
      'overdueAt',
    )
    .first();

  if (!invoice) {
    throw new NotFoundException('Invoice not found');
  }

  return {
    ...invoice,

    status: invoice.status,

    taxRate: invoice.taxRate.toString(),

    dueDate:
      invoice.dueDate === null ? null : fromPrisma8Timestamp(invoice.dueDate),

    sentAt:
      invoice.sentAt === null ? null : fromPrisma8Timestamp(invoice.sentAt),

    viewedAt:
      invoice.viewedAt === null ? null : fromPrisma8Timestamp(invoice.viewedAt),

    paidAt:
      invoice.paidAt === null ? null : fromPrisma8Timestamp(invoice.paidAt),

    overdueAt:
      invoice.overdueAt === null
        ? null
        : fromPrisma8Timestamp(invoice.overdueAt),
  };
}

export async function requireCustomerForOrganizationPrisma8(
  organizationId: string,
  customerId: string,
  orm: InvoiceOrmSource = db.orm,
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

export async function requireJobForCustomerPrisma8(
  organizationId: string,
  customerId: string,
  jobId: string,
  orm: InvoiceOrmSource = db.orm,
) {
  const job = await orm.public.Job.where({
    id: jobId,
    organizationId,
    customerId,
  })
    .select('id', 'currency')
    .first();

  if (!job) {
    throw new NotFoundException('Job not found for this customer');
  }

  return job;
}

export async function hydrateFullInvoicePrisma8(
  organizationId: string,
  invoiceId: string,
  orm: InvoiceOrmSource = db.orm,
) {
  const invoice = await orm.public.Invoice.where({
    id: invoiceId,
    organizationId,
  })
    .select(
      'id',
      'organizationId',
      'customerId',
      'jobId',
      'sourceEstimateId',
      'createdByUserId',

      'number',
      'status',
      'title',

      'notes',
      'terms',

      'currency',

      'issueDate',
      'dueDate',

      'subtotalCents',
      'discountCents',
      'taxRate',
      'taxCents',
      'totalCents',

      'amountPaidCents',
      'balanceDueCents',

      'sentAt',
      'viewedAt',
      'paidAt',
      'overdueAt',
      'voidedAt',

      'createdAt',
      'updatedAt',

      'publicAccessCreatedAt',
      'publicAccessToken',
    )
    .first();

  if (!invoice) {
    throw new NotFoundException('Invoice not found');
  }

  const customer = await orm.public.Customer.where({
    id: invoice.customerId,

    organizationId,
  })
    .select('id', 'firstName', 'lastName', 'companyName', 'email', 'phone')
    .first();

  if (!customer) {
    throw new NotFoundException('Customer not found');
  }

  const job =
    invoice.jobId === null
      ? null
      : await orm.public.Job.where({
          id: invoice.jobId,

          organizationId,
        })
          .select('id', 'name', 'status')
          .first();

  const sourceEstimate =
    invoice.sourceEstimateId === null
      ? null
      : await orm.public.Estimate.where({
          id: invoice.sourceEstimateId,

          organizationId,
        })
          .select('id', 'number', 'status', 'title', 'totalCents')
          .first();

  const createdBy =
    invoice.createdByUserId === null
      ? null
      : await orm.public.User.where({
          id: invoice.createdByUserId,
        })
          .select('id', 'firstName', 'lastName', 'email')
          .first();

  const lineItems = await orm.public.InvoiceLineItem.where({
    invoiceId,
  })
    .select(
      'id',
      'sourceJobMaterialId',
      'description',
      'quantity',
      'unitPriceCents',
      'lineTotalCents',
      'position',
      'createdAt',
      'updatedAt',
    )
    .orderBy((model) => model.position.asc())
    .all();

  const payments = await orm.public.Payment.where({
    organizationId,
    invoiceId,
  })
    .select(
      'id',
      'recordedByUserId',
      'status',
      'method',
      'amountCents',
      'reference',
      'notes',
      'receivedAt',
      'voidedAt',
      'createdAt',
      'updatedAt',
    )
    .orderBy((model) => model.receivedAt.desc())
    .all();

  const hydratedPayments = [];

  for (const payment of payments) {
    const recordedBy =
      payment.recordedByUserId === null
        ? null
        : await orm.public.User.where({
            id: payment.recordedByUserId,
          })
            .select('id', 'firstName', 'lastName', 'email')
            .first();

    hydratedPayments.push({
      id: payment.id,

      status: payment.status,

      method: payment.method,

      amountCents: payment.amountCents,

      reference: payment.reference,

      notes: payment.notes,

      receivedAt: fromPrisma8Timestamp(payment.receivedAt),

      voidedAt:
        payment.voidedAt === null
          ? null
          : fromPrisma8Timestamp(payment.voidedAt),

      createdAt: fromPrisma8Timestamp(payment.createdAt),

      updatedAt: fromPrisma8Timestamp(payment.updatedAt),

      recordedBy,
    });
  }

  const reminders = await orm.public.InvoiceReminder.where({
    invoiceId,
  })
    .select('id', '_type', 'scheduledFor', 'sentAt', 'createdAt', 'updatedAt')
    .orderBy((model) => model.scheduledFor.asc())
    .all();

  return {
    id: invoice.id,

    organizationId: invoice.organizationId,

    customerId: invoice.customerId,

    jobId: invoice.jobId,

    sourceEstimateId: invoice.sourceEstimateId,

    createdByUserId: invoice.createdByUserId,

    number: invoice.number,

    status: invoice.status,

    title: invoice.title,

    notes: invoice.notes,

    terms: invoice.terms,

    currency: invoice.currency,

    issueDate: fromPrisma8Timestamp(invoice.issueDate),

    dueDate:
      invoice.dueDate === null ? null : fromPrisma8Timestamp(invoice.dueDate),

    subtotalCents: invoice.subtotalCents,

    discountCents: invoice.discountCents,

    taxRate: invoice.taxRate,

    taxCents: invoice.taxCents,

    totalCents: invoice.totalCents,

    amountPaidCents: invoice.amountPaidCents,

    balanceDueCents: invoice.balanceDueCents,

    sentAt:
      invoice.sentAt === null ? null : fromPrisma8Timestamp(invoice.sentAt),

    viewedAt:
      invoice.viewedAt === null ? null : fromPrisma8Timestamp(invoice.viewedAt),

    paidAt:
      invoice.paidAt === null ? null : fromPrisma8Timestamp(invoice.paidAt),

    overdueAt:
      invoice.overdueAt === null
        ? null
        : fromPrisma8Timestamp(invoice.overdueAt),

    voidedAt:
      invoice.voidedAt === null ? null : fromPrisma8Timestamp(invoice.voidedAt),

    createdAt: fromPrisma8Timestamp(invoice.createdAt),

    updatedAt: fromPrisma8Timestamp(invoice.updatedAt),

    publicAccessCreatedAt:
      invoice.publicAccessCreatedAt === null
        ? null
        : fromPrisma8Timestamp(invoice.publicAccessCreatedAt),

    publicAccessToken: invoice.publicAccessToken,

    customer,
    job,
    sourceEstimate,
    createdBy,

    lineItems: lineItems.map((lineItem) => ({
      id: lineItem.id,

      sourceJobMaterialId: lineItem.sourceJobMaterialId,

      description: lineItem.description,

      quantity: lineItem.quantity,

      unitPriceCents: lineItem.unitPriceCents,

      lineTotalCents: lineItem.lineTotalCents,

      position: lineItem.position,

      createdAt: fromPrisma8Timestamp(lineItem.createdAt),

      updatedAt: fromPrisma8Timestamp(lineItem.updatedAt),
    })),

    payments: hydratedPayments,

    reminders: reminders.map((reminder) => ({
      id: reminder.id,

      type: reminder._type,

      scheduledFor: fromPrisma8Timestamp(reminder.scheduledFor),

      sentAt:
        reminder.sentAt === null ? null : fromPrisma8Timestamp(reminder.sentAt),

      createdAt: fromPrisma8Timestamp(reminder.createdAt),

      updatedAt: fromPrisma8Timestamp(reminder.updatedAt),
    })),
  };
}

export async function generateInvoiceNumberPrisma8(
  organizationId: string,
  tx: DatabaseTransaction,
) {
  /*
   * Preserve Prisma 7's atomic increment semantics.
   *
   * We CAS nextInvoiceNumber rather than doing
   * a read followed by an unconditional update.
   */
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const organization = await tx.orm.public.Organization.where({
      id: organizationId,
    })
      .select('nextInvoiceNumber')
      .first();

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const sequence = organization.nextInvoiceNumber;

    const next = sequence + 1;

    const now = toPrisma8Timestamp();

    const plan = db.raw.sql`
        UPDATE "Organization"
        SET
          "nextInvoiceNumber" = ${next},
          "updatedAt" = ${prisma8TimestampParam(now)}
        WHERE
          "id" = ${prisma8TextParam(organizationId)}
          AND "nextInvoiceNumber" = ${sequence}
      `
      .affectedCount()
      .build();

    const result = await tx.execute(plan);

    if (result.affectedRows === 1) {
      return `INV-${String(sequence).padStart(5, '0')}`;
    }
  }

  throw new BadRequestException('Unable to allocate invoice number');
}

export async function writeInvoiceActivityPrisma8(
  tx: DatabaseTransaction,
  input: {
    organizationId: string;
    customerId: string;

    actorUserId: string | null;

    type: InvoiceActivityType;

    title: string;

    description: string | null;

    metadata: InvoiceActivityMetadata;
  },
) {
  return tx.orm.public.CustomerActivity.create({
    organizationId: input.organizationId,

    customerId: input.customerId,

    actorUserId: input.actorUserId,

    _type: input.type,

    title: input.title,

    description: input.description,

    metadata: input.metadata,

    createdAt: toPrisma8Timestamp(),
  });
}

export async function executeInvoiceTransitionCasPrisma8(
  tx: DatabaseTransaction,
  input: {
    organizationId: string;
    invoiceId: string;

    allowedStatuses: InvoiceStatus[];

    nextStatus: InvoiceStatus;

    timestampField: 'sentAt' | 'viewedAt';
  },
) {
  const now = toPrisma8Timestamp();

  /*
   * Current generic transition path only uses:
   *
   * SENT -> VIEWED
   *
   * DRAFT -> SENT has its own email-aware workflow.
   */
  if (
    input.nextStatus === InvoiceStatus.VIEWED &&
    input.timestampField === 'viewedAt'
  ) {
    const plan = db.raw.sql`
        UPDATE "Invoice"
        SET
          "status" = 'VIEWED',
          "viewedAt" = ${prisma8TimestampParam(now)},
          "updatedAt" = ${prisma8TimestampParam(now)}
        WHERE
          "id" = ${prisma8TextParam(input.invoiceId)}
          AND "organizationId" = ${prisma8TextParam(input.organizationId)}
          AND "status" = 'SENT'
      `
      .affectedCount()
      .build();

    const result = await tx.execute(plan);

    return result.affectedRows;
  }

  throw new Error(
    `Unsupported invoice transition CAS: ${input.allowedStatuses.join(
      ',',
    )} -> ${input.nextStatus}/${input.timestampField}`,
  );
}

export async function executeSendInvoiceCasPrisma8(
  tx: DatabaseTransaction,
  organizationId: string,
  invoiceId: string,
) {
  const now = toPrisma8Timestamp();

  const plan = db.raw.sql`
      UPDATE "Invoice"
      SET
        "status" = 'SENT',
        "sentAt" = ${prisma8TimestampParam(now)},
        "updatedAt" = ${prisma8TimestampParam(now)}
      WHERE
        "id" = ${prisma8TextParam(invoiceId)}
        AND "organizationId" = ${prisma8TextParam(organizationId)}
        AND "status" = 'DRAFT'
    `
    .affectedCount()
    .build();

  const result = await tx.execute(plan);

  return result.affectedRows;
}

export async function executeOverdueInvoiceCasPrisma8(
  tx: DatabaseTransaction,
  organizationId: string,
  invoiceId: string,
) {
  const now = toPrisma8Timestamp();

  const plan = db.raw.sql`
      UPDATE "Invoice"
      SET
        "status" = 'OVERDUE',
        "overdueAt" = ${prisma8TimestampParam(now)},
        "updatedAt" = ${prisma8TimestampParam(now)}
      WHERE
        "id" = ${prisma8TextParam(invoiceId)}
        AND "organizationId" = ${prisma8TextParam(organizationId)}
        AND "status" IN (
          'SENT',
          'VIEWED',
          'PARTIALLY_PAID'
        )
        AND "balanceDueCents" > 0
    `
    .affectedCount()
    .build();

  const result = await tx.execute(plan);

  return result.affectedRows;
}

export async function executeVoidInvoiceCasPrisma8(
  tx: DatabaseTransaction,
  organizationId: string,
  invoiceId: string,
) {
  const now = toPrisma8Timestamp();

  const plan = db.raw.sql`
      UPDATE "Invoice"
      SET
        "status" = 'VOIDED',
        "voidedAt" = ${prisma8TimestampParam(now)},
        "updatedAt" = ${prisma8TimestampParam(now)}
      WHERE
        "id" = ${prisma8TextParam(invoiceId)}
        AND "organizationId" = ${prisma8TextParam(organizationId)}
        AND "status" <> 'VOIDED'
        AND "amountPaidCents" = 0
    `
    .affectedCount()
    .build();

  const result = await tx.execute(plan);

  return result.affectedRows;
}

export async function executeVoidPaymentCasPrisma8(
  tx: DatabaseTransaction,
  input: {
    organizationId: string;
    invoiceId: string;
    paymentId: string;
  },
) {
  const now = toPrisma8Timestamp();

  const plan = db.raw.sql`
      UPDATE "Payment"
      SET
        "status" = 'VOIDED',
        "voidedAt" = ${prisma8TimestampParam(now)},
        "updatedAt" = ${prisma8TimestampParam(now)}
      WHERE
        "id" = ${prisma8TextParam(input.paymentId)}
        AND "invoiceId" = ${prisma8TextParam(input.invoiceId)}
        AND "organizationId" = ${prisma8TextParam(input.organizationId)}
        AND "status" = 'RECORDED'
    `
    .affectedCount()
    .build();

  const result = await tx.execute(plan);

  return result.affectedRows;
}

export async function sumRecordedPaymentsPrisma8(
  tx: DatabaseTransaction,
  organizationId: string,
  invoiceId: string,
) {
  const payments = await tx.orm.public.Payment.where({
    organizationId,
    invoiceId,
  })
    .select('status', 'amountCents')
    .all();

  return payments.reduce(
    (total, payment) =>
      payment.status === PaymentStatus.RECORDED
        ? total + payment.amountCents
        : total,
    0,
  );
}

export async function updateInvoicePaymentStatePrisma8(
  tx: DatabaseTransaction,
  input: {
    organizationId: string;
    invoiceId: string;

    amountPaidCents: number;
    balanceDueCents: number;

    nextStatus: InvoiceStatus;

    paidAt: Date | null;
  },
) {
  const now = new Date();

  return tx.orm.public.Invoice.where({
    id: input.invoiceId,

    organizationId: input.organizationId,
  }).update({
    amountPaidCents: input.amountPaidCents,

    balanceDueCents: input.balanceDueCents,

    status: input.nextStatus,

    paidAt:
      input.nextStatus === InvoiceStatus.PAID
        ? toPrisma8Timestamp(input.paidAt ?? now)
        : null,

    updatedAt: toPrisma8Timestamp(now),
  });
}

export async function createPaymentPrisma8(
  tx: DatabaseTransaction,
  input: {
    organizationId: string;
    customerId: string;
    invoiceId: string;

    recordedByUserId: string | null;

    method:
      | 'CASH'
      | 'CHEQUE'
      | 'CREDIT_CARD'
      | 'DEBIT_CARD'
      | 'E_TRANSFER'
      | 'BANK_TRANSFER'
      | 'OTHER';

    currency: string;
    amountCents: number;

    reference: string | null;

    notes: string | null;

    receivedAt: Date;
  },
) {
  const now = toPrisma8Timestamp();

  return tx.orm.public.Payment.create({
    organizationId: input.organizationId,

    customerId: input.customerId,

    invoiceId: input.invoiceId,

    recordedByUserId: input.recordedByUserId,

    status: 'RECORDED',

    method: input.method,

    currency: input.currency,

    amountCents: input.amountCents,

    reference: input.reference,

    notes: input.notes,

    receivedAt: toPrisma8Timestamp(input.receivedAt),

    voidedAt: null,

    createdAt: now,

    updatedAt: now,

    externalPaymentId: null,

    provider: null,

    stripeCheckoutSessionId: null,

    stripePaymentIntentId: null,
  });
}

export async function createInvoiceLineItemPrisma8(
  tx: DatabaseTransaction,
  input: {
    invoiceId: string;
    description: string;

    quantity:
      | number
      | {
          toString(): string;
        };

    unitPriceCents: number;
    lineTotalCents: number;

    sourceJobMaterialId: string | null;

    position: number;
  },
) {
  const now = toPrisma8Timestamp();

  return tx.orm.public.InvoiceLineItem.create({
    invoiceId: input.invoiceId,

    description: input.description,

    quantity: toPrisma8Numeric(input.quantity.toString(), 12, 4),

    unitPriceCents: input.unitPriceCents,

    lineTotalCents: input.lineTotalCents,

    sourceJobMaterialId: input.sourceJobMaterialId,

    position: input.position,

    createdAt: now,

    updatedAt: now,
  });
}

export type InvoiceListOptionsPrisma8 = {
  query?: string;
  status?: string;
  sort?: string;
};

const OUTSTANDING_STATUSES_PRISMA8: InvoiceStatus[] = [
  InvoiceStatus.SENT,
  InvoiceStatus.VIEWED,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.OVERDUE,
];

function requireInvoiceFilterStatus(value: string): InvoiceStatus {
  const invoiceStatus = Object.values(InvoiceStatus).find(
    (status) => status === value,
  );

  if (!invoiceStatus) {
    throw new BadRequestException(
      `Unsupported invoice status filter: ${value}`,
    );
  }

  return invoiceStatus;
}

export async function listInvoicesPrisma8(
  organizationId: string,
  options: InvoiceListOptionsPrisma8 = {},
) {
  /*
   * Keep the database predicate intentionally simple.
   *
   * Prisma 7 previously used nested OR/relation filters
   * for invoice/customer/job search. Until those Prisma 8
   * relation predicates are explicitly proven, hydrate the
   * scoped rows and preserve the same user-visible filtering
   * semantics in JS.
   */
  const baseRows = await db.orm.public.Invoice.where({
    organizationId,
  })
    .select('id', 'createdAt', 'dueDate', 'totalCents', 'balanceDueCents')
    .all();

  const hydrated = [];

  for (const row of baseRows) {
    hydrated.push(await hydrateFullInvoicePrisma8(organizationId, row.id));
  }

  let result = hydrated;

  const query = options.query?.trim().toLocaleLowerCase();

  if (query) {
    result = result.filter((invoice) => {
      const searchable = [
        invoice.number,
        invoice.title,
        invoice.customer.firstName,
        invoice.customer.lastName,
        invoice.customer.companyName,
        invoice.job?.name,
      ];

      return searchable.some(
        (value) => value?.toLocaleLowerCase().includes(query) ?? false,
      );
    });
  }

  const status = options.status?.trim().toUpperCase();

  if (status && status !== 'ALL') {
    if (status === 'OUTSTANDING') {
      result = result.filter((invoice) =>
        OUTSTANDING_STATUSES_PRISMA8.includes(invoice.status),
      );
    } else {
      const invoiceStatus = requireInvoiceFilterStatus(status);

      result = result.filter((invoice) => invoice.status === invoiceStatus);
    }
  }

  const sort = options.sort?.trim().toLowerCase();

  switch (sort) {
    case undefined:
    case '':
    case 'newest':
      result.sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      );
      break;

    case 'oldest':
      result.sort(
        (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
      );
      break;

    case 'due-soonest':
      result.sort((left, right) => {
        const leftDue = left.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;

        const rightDue = right.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;

        if (leftDue !== rightDue) {
          return leftDue - rightDue;
        }

        return right.createdAt.getTime() - left.createdAt.getTime();
      });
      break;

    case 'total-desc':
      result.sort(
        (left, right) =>
          right.totalCents - left.totalCents ||
          right.createdAt.getTime() - left.createdAt.getTime(),
      );
      break;

    case 'balance-desc':
      result.sort(
        (left, right) =>
          right.balanceDueCents - left.balanceDueCents ||
          right.createdAt.getTime() - left.createdAt.getTime(),
      );
      break;

    default:
      throw new BadRequestException(
        `Unsupported invoice sort: ${options.sort}`,
      );
  }

  return result;
}

export async function listInvoicesForJobPrisma8(
  organizationId: string,
  jobId: string,
) {
  const job = await db.orm.public.Job.where({
    id: jobId,

    organizationId,
  })
    .select('id')
    .first();

  if (!job) {
    throw new NotFoundException('Job not found');
  }

  const rows = await db.orm.public.Invoice.where({
    organizationId,
    jobId,
  })
    .select('id', 'createdAt')
    .orderBy((model) => model.createdAt.desc())
    .all();

  const result = [];

  for (const row of rows) {
    result.push(await hydrateFullInvoicePrisma8(organizationId, row.id));
  }

  return result;
}

export async function listInvoicesForCustomerPrisma8(
  organizationId: string,
  customerId: string,
) {
  await requireCustomerForOrganizationPrisma8(organizationId, customerId);

  const rows = await db.orm.public.Invoice.where({
    organizationId,
    customerId,
  })
    .select('id', 'createdAt')
    .orderBy((model) => model.createdAt.desc())
    .all();

  const result = [];

  for (const row of rows) {
    result.push(await hydrateFullInvoicePrisma8(organizationId, row.id));
  }

  return result;
}

export async function getInvoiceSummaryPrisma8(organizationId: string) {
  /*
   * Preserve Prisma 7 summary semantics without relying on
   * unproven Prisma 8 count/groupBy/aggregate APIs.
   */
  const invoices = await db.orm.public.Invoice.where({
    organizationId,
  })
    .select('status', 'currency', 'balanceDueCents', 'amountPaidCents')
    .all();

  let drafts = 0;

  let paid = 0;

  const currencies = new Map<
    string,
    {
      currency: string;
      outstandingMinor: number;
      overdueMinor: number;
      collectedMinor: number;
    }
  >();

  const requireCurrency = (currency: string) => {
    const existing = currencies.get(currency);

    if (existing) {
      return existing;
    }

    const created = {
      currency,

      outstandingMinor: 0,

      overdueMinor: 0,

      collectedMinor: 0,
    };

    currencies.set(currency, created);

    return created;
  };

  for (const invoice of invoices) {
    if (invoice.status === InvoiceStatus.DRAFT) {
      drafts += 1;
    }

    if (invoice.status === InvoiceStatus.PAID) {
      paid += 1;
    }

    if (OUTSTANDING_STATUSES_PRISMA8.includes(invoice.status)) {
      requireCurrency(invoice.currency).outstandingMinor +=
        invoice.balanceDueCents;
    }

    if (invoice.status === InvoiceStatus.OVERDUE) {
      requireCurrency(invoice.currency).overdueMinor += invoice.balanceDueCents;
    }

    if (invoice.status !== InvoiceStatus.VOIDED) {
      requireCurrency(invoice.currency).collectedMinor +=
        invoice.amountPaidCents;
    }
  }

  return {
    drafts,
    paid,

    currencies: [...currencies.values()].sort((left, right) =>
      left.currency.localeCompare(right.currency),
    ),
  };
}

export async function reserveInvoicePublicAccessPrisma8(
  tx: DatabaseTransaction,
  input: {
    organizationId: string;
    invoiceId: string;
    token: string;
  },
) {
  const now = toPrisma8Timestamp();

  const plan = db.raw.sql`
      UPDATE "Invoice"
      SET
        "publicAccessToken" = ${prisma8TextParam(input.token)},
        "publicAccessCreatedAt" = ${prisma8TimestampParam(now)},
        "updatedAt" = ${prisma8TimestampParam(now)}
      WHERE
        "id" = ${prisma8TextParam(input.invoiceId)}
        AND "organizationId" = ${prisma8TextParam(input.organizationId)}
        AND "status" = 'DRAFT'
        AND "publicAccessToken" IS NULL
    `
    .affectedCount()
    .build();

  const result = await tx.execute(plan);

  return result.affectedRows;
}

export async function clearInvoicePublicAccessPrisma8(
  tx: DatabaseTransaction,
  input: {
    organizationId: string;
    invoiceId: string;
    token: string;
  },
) {
  const now = toPrisma8Timestamp();

  const plan = db.raw.sql`
      UPDATE "Invoice"
      SET
        "publicAccessToken" = NULL,
        "publicAccessCreatedAt" = NULL,
        "updatedAt" = ${prisma8TimestampParam(now)}
      WHERE
        "id" = ${prisma8TextParam(input.invoiceId)}
        AND "organizationId" = ${prisma8TextParam(input.organizationId)}
        AND "status" = 'DRAFT'
        AND "publicAccessToken" = ${prisma8TextParam(input.token)}
    `
    .affectedCount()
    .build();

  const result = await tx.execute(plan);

  return result.affectedRows;
}
