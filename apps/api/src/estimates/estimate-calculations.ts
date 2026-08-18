import { Prisma } from '@contractflow/db';

type EstimateCalculationLineItem = {
  quantity: number;
  unitPriceCents: number;
};

type CalculateEstimateTotalsInput = {
  lineItems: EstimateCalculationLineItem[];
  discountCents?: number;
  taxRate?: number;
};

export type CalculatedEstimateLineItem = {
  quantity: Prisma.Decimal;
  unitPriceCents: number;
  lineTotalCents: number;
};

export type EstimateTotals = {
  lineItems: CalculatedEstimateLineItem[];

  subtotalCents: number;
  discountCents: number;

  taxRate: Prisma.Decimal;
  taxCents: number;

  totalCents: number;
};

export function calculateEstimateTotals(
  input: CalculateEstimateTotalsInput,
): EstimateTotals {
  const discountCents = input.discountCents ?? 0;

  const taxRate = new Prisma.Decimal(input.taxRate ?? 0);

  const lineItems = input.lineItems.map((lineItem) => {
    const quantity = new Prisma.Decimal(lineItem.quantity);

    const rawLineTotal = quantity.mul(lineItem.unitPriceCents);

    const lineTotalCents = rawLineTotal
      .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
      .toNumber();

    return {
      quantity,
      unitPriceCents: lineItem.unitPriceCents,
      lineTotalCents,
    };
  });

  const subtotalCents = lineItems.reduce(
    (total, lineItem) => total + lineItem.lineTotalCents,
    0,
  );

  const taxableCents = Math.max(subtotalCents - discountCents, 0);

  const taxCents = new Prisma.Decimal(taxableCents)
    .mul(taxRate)
    .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
    .toNumber();

  const totalCents = taxableCents + taxCents;

  return {
    lineItems,

    subtotalCents,
    discountCents,

    taxRate,
    taxCents,

    totalCents,
  };
}
