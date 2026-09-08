export const supportedLocales = [
  "en",
  "fr",
  "es",
  "de",
  "pt",
  "it",
  "nl",
  "pl",
  "ja",
  "ko",
  "zh-CN",
  "zh-TW",
  "ar",
  "hi",
] as const;

export type SupportedLocale = (typeof supportedLocales)[number];

export const defaultLocale: SupportedLocale = "en";

export const rtlLocales = new Set<SupportedLocale>(["ar"]);

export function isSupportedLocale(
  value: string | null | undefined,
): value is SupportedLocale {
  return !!value && supportedLocales.includes(value as SupportedLocale);
}

export function getTextDirection(locale: SupportedLocale): "ltr" | "rtl" {
  return rtlLocales.has(locale) ? "rtl" : "ltr";
}
