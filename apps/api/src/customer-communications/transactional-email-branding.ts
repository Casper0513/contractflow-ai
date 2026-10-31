export type TransactionalEmailIdentity = {
  name: string;
  legalName: string | null;
  email: string | null;
  website: string | null;
};

export function addTransactionalEmailBrandingHtml(
  html: string,
  identity: TransactionalEmailIdentity,
): string {
  const footer = buildTransactionalEmailFooterHtml(identity);

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${footer}</body>`);
  }

  return `${html}${footer}`;
}

export function addTransactionalEmailBrandingText(
  text: string,
  identity: TransactionalEmailIdentity,
): string {
  const lines = buildIdentityLines(identity);

  return [text.trimEnd(), '', '---', ...lines].join('\n');
}

function buildTransactionalEmailFooterHtml(
  identity: TransactionalEmailIdentity,
): string {
  const name = identity.name.trim();
  const legalName = identity.legalName?.trim() || null;
  const email = identity.email?.trim() || null;
  const website = identity.website?.trim() || null;

  return `
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      style="background:#f4f4f5;padding:0 16px 32px;"
    >
      <tr>
        <td align="center">
          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            style="max-width:620px;"
          >
            <tr>
              <td
                align="center"
                style="padding:20px 24px 0;border-top:1px solid #d4d4d8;color:#71717a;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;"
              >
                <div style="font-weight:700;color:#52525b;">
                  ${escapeHtml(name)}
                </div>

                ${
                  legalName && legalName !== name
                    ? `
                      <div>
                        ${escapeHtml(legalName)}
                      </div>
                    `
                    : ''
                }

                ${
                  website
                    ? `
                      <div>
                        <a
                          href="${escapeHtml(website)}"
                          style="color:#52525b;text-decoration:none;"
                        >
                          ${escapeHtml(website)}
                        </a>
                      </div>
                    `
                    : ''
                }

                ${
                  email
                    ? `
                      <div>
                        <a
                          href="mailto:${escapeHtml(email)}"
                          style="color:#52525b;text-decoration:none;"
                        >
                          ${escapeHtml(email)}
                        </a>
                      </div>
                    `
                    : ''
                }
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

function buildIdentityLines(identity: TransactionalEmailIdentity): string[] {
  const name = identity.name.trim();
  const legalName = identity.legalName?.trim() || null;
  const email = identity.email?.trim() || null;
  const website = identity.website?.trim() || null;

  return [
    name,
    legalName && legalName !== name ? legalName : null,
    website,
    email,
  ].filter((value): value is string => Boolean(value));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
