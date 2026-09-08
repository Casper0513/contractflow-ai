import "server-only";

import { cookies, headers } from "next/headers";

import {
  defaultLocale,
  getTextDirection,
  isSupportedLocale,
  type SupportedLocale,
} from "./config";

const LOCALE_COOKIE = "contractflow-locale";

export async function getRequestLocale(): Promise<SupportedLocale> {
  const cookieStore = await cookies();
  const storedLocale = cookieStore.get(LOCALE_COOKIE)?.value;

  if (isSupportedLocale(storedLocale)) {
    return storedLocale;
  }

  const headerStore = await headers();
  const acceptLanguage = headerStore.get("accept-language");

  return resolveLocaleFromAcceptLanguage(acceptLanguage);
}

export function getRequestDirection(locale: SupportedLocale): "ltr" | "rtl" {
  return getTextDirection(locale);
}

export function resolveLocaleFromAcceptLanguage(
  value: string | null | undefined,
): SupportedLocale {
  if (!value) {
    return defaultLocale;
  }

  const candidates = value
    .split(",")
    .map((entry) => entry.trim().split(";")[0]?.trim())
    .filter((entry): entry is string => Boolean(entry));

  for (const candidate of candidates) {
    if (isSupportedLocale(candidate)) {
      return candidate;
    }

    const normalized = normalizeLocale(candidate);

    if (normalized) {
      return normalized;
    }
  }

  return defaultLocale;
}

function normalizeLocale(value: string): SupportedLocale | null {
  const normalized = value.replace("_", "-");

  const exactMap: Record<string, SupportedLocale> = {
    en: "en",
    fr: "fr",
    es: "es",
    de: "de",
    pt: "pt",
    it: "it",
    nl: "nl",
    pl: "pl",
    ja: "ja",
    ko: "ko",
    ar: "ar",
    hi: "hi",
    "zh-cn": "zh-CN",
    "zh-sg": "zh-CN",
    "zh-hans": "zh-CN",
    "zh-tw": "zh-TW",
    "zh-hk": "zh-TW",
    "zh-mo": "zh-TW",
    "zh-hant": "zh-TW",
  };

  const lower = normalized.toLowerCase();

  if (exactMap[lower]) {
    return exactMap[lower];
  }

  const base = lower.split("-")[0];

  if (base && exactMap[base]) {
    return exactMap[base];
  }

  return null;
}
