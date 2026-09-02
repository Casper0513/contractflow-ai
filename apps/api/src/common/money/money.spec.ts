import {
  assertSupportedCurrency,
  isSupportedCurrency,
  normalizeCurrencyCode,
  SUPPORTED_CURRENCIES,
} from './currency';
import {
  createMoney,
  formatMoney,
  getCurrencyFractionDigits,
  getCurrencyMinorUnitFactor,
  majorToMinor,
  minorToMajor,
} from './money';

describe('currency utilities', () => {
  it('normalizes ISO-style currency codes', () => {
    expect(normalizeCurrencyCode(' cad ')).toBe('CAD');
    expect(normalizeCurrencyCode('usd')).toBe('USD');
  });

  it('accepts supported currencies', () => {
    expect(isSupportedCurrency('CAD')).toBe(true);
    expect(isSupportedCurrency('usd')).toBe(true);
    expect(isSupportedCurrency('JPY')).toBe(true);
  });

  it('rejects unsupported currencies', () => {
    expect(isSupportedCurrency('XYZ')).toBe(false);

    expect(() => assertSupportedCurrency('XYZ')).toThrow(
      'Unsupported currency code: XYZ',
    );
  });
});

describe('money utilities', () => {
  it('uses two decimal places for CAD and USD', () => {
    expect(getCurrencyFractionDigits('CAD')).toBe(2);
    expect(getCurrencyFractionDigits('USD')).toBe(2);

    expect(getCurrencyMinorUnitFactor('CAD')).toBe(100);
    expect(getCurrencyMinorUnitFactor('USD')).toBe(100);
  });

  it('uses zero decimal places for JPY', () => {
    expect(getCurrencyFractionDigits('JPY')).toBe(0);
    expect(getCurrencyMinorUnitFactor('JPY')).toBe(1);
  });

  it('converts major amounts to minor units', () => {
    expect(majorToMinor(49.99, 'CAD')).toBe(4999);
    expect(majorToMinor(49.99, 'USD')).toBe(4999);
    expect(majorToMinor(5000, 'JPY')).toBe(5000);
  });

  it('converts minor units to major amounts', () => {
    expect(minorToMajor(4999, 'CAD')).toBe(49.99);
    expect(minorToMajor(4999, 'USD')).toBe(49.99);
    expect(minorToMajor(5000, 'JPY')).toBe(5000);
  });

  it('creates normalized Money values', () => {
    expect(createMoney(4999, 'cad')).toEqual({
      amountMinor: 4999,
      currency: 'CAD',
    });
  });

  it('rejects non-integer minor amounts', () => {
    expect(() => createMoney(49.99, 'CAD')).toThrow(
      'Money amountMinor must be a safe integer',
    );
  });

  it('formats two-decimal currencies', () => {
    expect(formatMoney(4999, 'CAD', 'en-CA')).toContain('49.99');
  });

  it('formats zero-decimal currencies without dividing by 100', () => {
    const formatted = formatMoney(5000, 'JPY', 'ja-JP');

    expect(formatted).toContain('5,000');
  });
});

describe('global currency catalog', () => {
  it('supports a broad international currency set', () => {
    expect(isSupportedCurrency('CAD')).toBe(true);
    expect(isSupportedCurrency('USD')).toBe(true);
    expect(isSupportedCurrency('EUR')).toBe(true);
    expect(isSupportedCurrency('GBP')).toBe(true);
    expect(isSupportedCurrency('JPY')).toBe(true);
    expect(isSupportedCurrency('AUD')).toBe(true);
    expect(isSupportedCurrency('NZD')).toBe(true);
    expect(isSupportedCurrency('CHF')).toBe(true);
    expect(isSupportedCurrency('INR')).toBe(true);
    expect(isSupportedCurrency('KRW')).toBe(true);
    expect(isSupportedCurrency('ZAR')).toBe(true);
    expect(isSupportedCurrency('MXN')).toBe(true);
    expect(isSupportedCurrency('BRL')).toBe(true);
  });

  it('does not allow precious-metal, test, or no-currency codes', () => {
    expect(isSupportedCurrency('XAU')).toBe(false);
    expect(isSupportedCurrency('XAG')).toBe(false);
    expect(isSupportedCurrency('XTS')).toBe(false);
    expect(isSupportedCurrency('XXX')).toBe(false);
  });

  it('does not allow currencies that are historical for new organizations', () => {
    expect(isSupportedCurrency('BGN')).toBe(false);
  });

  it('exposes a genuinely global catalog', () => {
    expect(SUPPORTED_CURRENCIES.length).toBeGreaterThan(100);
  });
});
