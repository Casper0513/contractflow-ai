export const LEGAL = {
  productName: "ContractFlow AI",
  operatingName: "ContractFlow",
  legalName: "CONTRACTFLOW-AI INC.",
  corporationNumber: "1831536-1",

  jurisdiction: "Alberta, Canada",
  businessAddress: "100-4810 50 Avenue, Suite 148, Leduc, AB T9E 6X9, Canada",

  websiteUrl: "https://app.contractflowops.com",

  supportEmail: "support@contractflowops.com",
  privacyEmail: "privacy@contractflowops.com",
  legalEmail: "legal@contractflowops.com",

  privacyOfficer: "Privacy Officer, CONTRACTFLOW-AI INC.",

  termsEffectiveDate: "November 8, 2026",
  privacyEffectiveDate: "November 8, 2026",
  aiDisclosureEffectiveDate: "November 8, 2026",
  subprocessorsUpdatedDate: "November 8, 2026",
} as const;

export function mailto(email: string): string {
  return `mailto:${email}`;
}
