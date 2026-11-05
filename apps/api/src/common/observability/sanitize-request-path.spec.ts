import { sanitizeRequestPath } from './sanitize-request-path';

describe('sanitizeRequestPath', () => {
  it('redacts public invoice access tokens', () => {
    const token = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

    expect(
      sanitizeRequestPath(
        `/api/public/invoices/${token}`,
        `/api/public/invoices/${token}`,
      ),
    ).toBe('/api/public/invoices/:token');
  });

  it('preserves suffixes after a public invoice token', () => {
    const token = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

    expect(
      sanitizeRequestPath(
        `/api/public/invoices/${token}/pdf`,
        `/api/public/invoices/${token}/pdf`,
      ),
    ).toBe('/api/public/invoices/:token/pdf');
  });

  it('redacts public estimate access tokens and strips query strings', () => {
    const token = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

    expect(
      sanitizeRequestPath(
        `/api/public/estimates/${token}/approve?source=email`,
        `/api/public/estimates/${token}/approve`,
      ),
    ).toBe('/api/public/estimates/:token/approve');
  });

  it('leaves unrelated API paths unchanged', () => {
    expect(
      sanitizeRequestPath(
        '/api/customers/customer_1',
        '/api/customers/customer_1',
      ),
    ).toBe('/api/customers/customer_1');
  });
});
