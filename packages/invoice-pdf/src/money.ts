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
