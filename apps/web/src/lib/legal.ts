export const LEGAL = {
  productName: "ContractFlow AI",
  legalName: "CONTRACTFLOW-AI INC.",

  jurisdiction: "Alberta, Canada",

  websiteUrl: "https://app.contractflowops.com",

  supportEmail: "support@contractflowops.com",
  privacyEmail: "privacy@contractflowops.com",
  legalEmail: "legal@contractflowops.com",

  termsEffectiveDate: "October 30, 2026",
  privacyEffectiveDate: "October 30, 2026",
} as const;

export function mailto(email: string): string {
  return `mailto:${email}`;
}
