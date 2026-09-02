const HISTORICAL_CURRENCY_CODES = new Set(["BGN"]);

const NON_TRANSACTIONAL_CURRENCY_CODES = new Set([
  "XAG",
  "XAU",
  "XBA",
  "XBB",
  "XBC",
  "XBD",
  "XDR",
  "XPD",
  "XPT",
  "XSU",
  "XTS",
  "XUA",
  "XXX",
]);

function loadSupportedCurrencies(): readonly string[] {
  const currencies = Intl.supportedValuesOf("currency")
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

export function getCurrencyDisplayName(currency: string): string {
  try {
    const displayNames = new Intl.DisplayNames(["en"], {
      type: "currency",
    });

    return displayNames.of(currency) ?? currency;
  } catch {
    return currency;
  }
}
