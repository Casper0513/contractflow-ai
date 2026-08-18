export type InvoiceCalculationLineItem = {
  quantity: number;
  unitPriceCents: number;
};

export type InvoiceCalculationInput = {
  lineItems: InvoiceCalculationLineItem[];
  discountCents?: number;
  taxRate?: number;
};

export type CalculatedInvoiceLineItem = {
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
};

export type InvoiceCalculationResult = {
  lineItems: CalculatedInvoiceLineItem[];
  subtotalCents: number;
  discountCents: number;
  taxableCents: number;
  taxRate: number;
  taxCents: number;
  totalCents: number;
};

export function calculateInvoiceTotals(
  input: InvoiceCalculationInput,
): InvoiceCalculationResult {
  const discountCents = input.discountCents ?? 0;
  const taxRate = input.taxRate ?? 0;

  assertNonNegativeInteger(discountCents, 'discountCents');

  assertValidTaxRate(taxRate);

  const lineItems = input.lineItems.map((lineItem, index) => {
    assertValidQuantity(lineItem.quantity, index);

    assertNonNegativeInteger(
      lineItem.unitPriceCents,
      `lineItems[${index}].unitPriceCents`,
    );

    const lineTotalCents = Math.round(
      lineItem.quantity * lineItem.unitPriceCents,
    );

    assertSafeInteger(lineTotalCents, `lineItems[${index}].lineTotalCents`);

    return {
      quantity: lineItem.quantity,
      unitPriceCents: lineItem.unitPriceCents,
      lineTotalCents,
    };
  });

  const subtotalCents = lineItems.reduce((total, lineItem) => {
    const nextTotal = total + lineItem.lineTotalCents;

    assertSafeInteger(nextTotal, 'subtotalCents');

    return nextTotal;
  }, 0);

  const appliedDiscountCents = Math.min(discountCents, subtotalCents);

  const taxableCents = Math.max(subtotalCents - appliedDiscountCents, 0);

  const taxCents = Math.round(taxableCents * taxRate);

  assertSafeInteger(taxCents, 'taxCents');

  const totalCents = taxableCents + taxCents;

  assertSafeInteger(totalCents, 'totalCents');

  return {
    lineItems,
    subtotalCents,
    discountCents: appliedDiscountCents,
    taxableCents,
    taxRate,
    taxCents,
    totalCents,
  };
}

export function calculateInvoiceBalance(
  totalCents: number,
  amountPaidCents: number,
) {
  assertNonNegativeInteger(totalCents, 'totalCents');

  assertNonNegativeInteger(amountPaidCents, 'amountPaidCents');

  if (amountPaidCents > totalCents) {
    throw new RangeError('amountPaidCents cannot exceed totalCents');
  }

  return {
    amountPaidCents,
    balanceDueCents: totalCents - amountPaidCents,
  };
}

function assertValidQuantity(quantity: number, index: number) {
  if (
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    decimalPlaces(quantity) > 4
  ) {
    throw new RangeError(
      `lineItems[${index}].quantity must be greater than 0 with no more than 4 decimal places`,
    );
  }
}

function assertValidTaxRate(taxRate: number) {
  if (
    !Number.isFinite(taxRate) ||
    taxRate < 0 ||
    taxRate > 1 ||
    decimalPlaces(taxRate) > 4
  ) {
    throw new RangeError(
      'taxRate must be between 0 and 1 with no more than 4 decimal places',
    );
  }
}

function assertNonNegativeInteger(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${field} must be a non-negative safe integer`);
  }
}

function assertSafeInteger(value: number, field: string) {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${field} exceeds the supported integer range`);
  }
}

function decimalPlaces(value: number) {
  if (!Number.isFinite(value)) {
    return Infinity;
  }

  const text = value.toString();

  if (text.includes('e-') || text.includes('E-')) {
    const parts = text.toLowerCase().split('e-');

    return Number(parts[1] ?? 0);
  }

  const decimal = text.split('.')[1];

  return decimal?.length ?? 0;
}
