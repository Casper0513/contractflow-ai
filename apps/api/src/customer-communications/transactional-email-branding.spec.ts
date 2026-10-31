import {
  addTransactionalEmailBrandingHtml,
  addTransactionalEmailBrandingText,
} from './transactional-email-branding';

describe('transactional email branding', () => {
  const identity = {
    name: 'ContractFlow AI',
    legalName: 'CONTRACTFLOW-AI INC.',
    email: 'support@contractflowops.com',
    website: 'https://app.contractflowops.com',
  };

  it('adds the business and legal identity to HTML email content', () => {
    const result = addTransactionalEmailBrandingHtml(
      '<!doctype html><html><body><p>Hello</p></body></html>',
      identity,
    );

    expect(result).toContain('ContractFlow AI');
    expect(result).toContain('CONTRACTFLOW-AI INC.');
    expect(result).toContain('https://app.contractflowops.com');
    expect(result).toContain('support@contractflowops.com');

    expect(result.indexOf('CONTRACTFLOW-AI INC.')).toBeLessThan(
      result.indexOf('</body>'),
    );
  });

  it('adds the business and legal identity to plain-text email content', () => {
    const result = addTransactionalEmailBrandingText(
      'Hello customer',
      identity,
    );

    expect(result).toContain('Hello customer');
    expect(result).toContain('ContractFlow AI');
    expect(result).toContain('CONTRACTFLOW-AI INC.');
    expect(result).toContain('https://app.contractflowops.com');
    expect(result).toContain('support@contractflowops.com');
  });

  it('does not repeat the legal name when it matches the business name', () => {
    const result = addTransactionalEmailBrandingText('Hello customer', {
      name: 'Example Ltd.',
      legalName: 'Example Ltd.',
      email: null,
      website: null,
    });

    expect(result.match(/Example Ltd\./g)).toHaveLength(1);
  });

  it('escapes organization-controlled values in HTML output', () => {
    const result = addTransactionalEmailBrandingHtml(
      '<html><body>Hello</body></html>',
      {
        name: '<Example & Co>',
        legalName: '"Example" Ltd.',
        email: 'office@example.com',
        website: 'https://example.com/?a=1&b=2',
      },
    );

    expect(result).toContain('&lt;Example &amp; Co&gt;');
    expect(result).toContain('&quot;Example&quot; Ltd.');
    expect(result).toContain('a=1&amp;b=2');
  });
});
