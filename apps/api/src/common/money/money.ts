import { assertSupportedCurrency, type SupportedCurrency } from './currency';

export type Money = {
  amountMinor: number;
  currency: SupportedCurrency;
};

export function getCurrencyFractionDigits(currency: string): number {
  const normalized = assertSupportedCurrency(currency);

  const fractionDigits = new Intl.NumberFormat('en', {
    style: 'currency',
    currency: normalized,
  }).resolvedOptions().maximumFractionDigits;

  if (fractionDigits === undefined) {
    throw new RangeError(
      `Unable to determine fraction digits for currency: ${normalized}`,
    );
  }

  return fractionDigits;
}

export function getCurrencyMinorUnitFactor(currency: string): number {
  return 10 ** getCurrencyFractionDigits(currency);
}

export function createMoney(amountMinor: number, currency: string): Money {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new RangeError('Money amountMinor must be a safe integer');
  }

  return {
    amountMinor,
    currency: assertSupportedCurrency(currency),
  };
}

export function minorToMajor(amountMinor: number, currency: string): number {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new RangeError('Money amountMinor must be a safe integer');
  }

  return amountMinor / getCurrencyMinorUnitFactor(currency);
}

export function majorToMinor(amountMajor: number, currency: string): number {
  if (!Number.isFinite(amountMajor)) {
    throw new RangeError('Money amountMajor must be finite');
  }

  const factor = getCurrencyMinorUnitFactor(currency);
  const amountMinor = Math.round(amountMajor * factor);

  if (!Number.isSafeInteger(amountMinor)) {
    throw new RangeError('Money amountMinor exceeds safe integer range');
  }

  return amountMinor;
}

export function formatMoney(
  amountMinor: number,
  currency: string,
  locale?: string,
): string {
  const normalized = assertSupportedCurrency(currency);

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: normalized,
  }).format(minorToMajor(amountMinor, normalized));
}
