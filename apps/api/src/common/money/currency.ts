const HISTORICAL_CURRENCY_CODES = new Set(['BGN']);

const NON_TRANSACTIONAL_CURRENCY_CODES = new Set([
  'XAG',
  'XAU',
  'XBA',
  'XBB',
  'XBC',
  'XBD',
  'XDR',
  'XPD',
  'XPT',
  'XSU',
  'XTS',
  'XUA',
  'XXX',
]);

function loadSupportedCurrencies(): readonly string[] {
  const currencies = Intl.supportedValuesOf('currency')
    .map((currency) => currency.trim().toUpperCase())
    .filter(
      (currency) =>
        /^[A-Z]{3}$/.test(currency) &&
        !HISTORICAL_CURRENCY_CODES.has(currency) &&
        !NON_TRANSACTIONAL_CURRENCY_CODES.has(currency),
    );

  return Object.freeze([...new Set(currencies)].sort());
}

export const SUPPORTED_CURRENCIES = loadSupportedCurrencies();

export type SupportedCurrency = string;

const SUPPORTED_CURRENCY_SET = new Set<string>(SUPPORTED_CURRENCIES);

export function normalizeCurrencyCode(currency: string): string {
  return currency.trim().toUpperCase();
}

export function isSupportedCurrency(currency: string): boolean {
  return SUPPORTED_CURRENCY_SET.has(normalizeCurrencyCode(currency));
}

export function assertSupportedCurrency(currency: string): SupportedCurrency {
  const normalized = normalizeCurrencyCode(currency);

  if (!isSupportedCurrency(normalized)) {
    throw new RangeError(
      `Unsupported currency code: ${normalized || '(empty)'}`,
    );
  }

  return normalized;
}
