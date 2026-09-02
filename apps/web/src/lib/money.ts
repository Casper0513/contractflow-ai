export type CurrencyMinorAmount = {
  currency: string;
  amountMinor: number;
};

export function getCurrencyFractionDigits(currency: string): number {
  return (
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2
  );
}

export function getCurrencyMinorUnitFactor(currency: string): number {
  return 10 ** getCurrencyFractionDigits(currency);
}

export function minorToMajor(amountMinor: number, currency: string): number {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new RangeError("Money amountMinor must be a safe integer");
  }

  return amountMinor / getCurrencyMinorUnitFactor(currency);
}

export function majorToMinor(amountMajor: number, currency: string): number {
  if (!Number.isFinite(amountMajor)) {
    throw new RangeError("Money amountMajor must be finite");
  }

  const amountMinor = Math.round(amountMajor * getCurrencyMinorUnitFactor(currency));

  if (!Number.isSafeInteger(amountMinor)) {
    throw new RangeError("Money amountMinor exceeds safe integer range");
  }

  return amountMinor;
}

export function getCurrencyInputStep(currency: string): string {
  const fractionDigits = getCurrencyFractionDigits(currency);

  if (fractionDigits === 0) {
    return "1";
  }

  return `0.${"0".repeat(fractionDigits - 1)}1`;
}

export function minorToMajorInputValue(amountMinor: number, currency: string): string {
  const fractionDigits = getCurrencyFractionDigits(currency);

  return minorToMajor(amountMinor, currency).toFixed(fractionDigits);
}

export function formatMinorAmount(
  amountMinor: number,
  currency: string,
  locale = "en-CA",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(minorToMajor(amountMinor, currency));
}

export function groupMinorAmountsByCurrency<T>(
  items: readonly T[],
  getCurrency: (item: T) => string,
  getAmountMinor: (item: T) => number,
): CurrencyMinorAmount[] {
  const totals = new Map<string, number>();

  for (const item of items) {
    const currency = getCurrency(item);

    totals.set(currency, (totals.get(currency) ?? 0) + getAmountMinor(item));
  }

  return [...totals.entries()]
    .map(([currency, amountMinor]) => ({
      currency,
      amountMinor,
    }))
    .sort((left, right) => left.currency.localeCompare(right.currency));
}

export function formatCurrencyMinorAmounts(
  amounts: readonly CurrencyMinorAmount[],
): string {
  const nonZero = amounts.filter((item) => item.amountMinor !== 0);

  if (nonZero.length === 0) {
    return "0";
  }

  if (nonZero.length === 1) {
    const item = nonZero[0];

    if (!item) {
      return "0";
    }

    return formatMinorAmount(item.amountMinor, item.currency);
  }

  return nonZero
    .map(
      (item) => `${item.currency} ${formatMinorAmount(item.amountMinor, item.currency)}`,
    )
    .join(" · ");
}
